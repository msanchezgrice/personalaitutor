#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectId = process.env.POSTHOG_PROJECT_ID?.trim() || "330799";
const host = (process.env.POSTHOG_HOST?.trim() || "https://us.posthog.com").replace(/\/+$/, "");
const configPath = path.resolve(
  process.cwd(),
  process.env.POSTHOG_DASHBOARD_CONFIG?.trim() || "docs/posthog/dashboard_blueprint.json",
);

const apiKey = process.env.POSTHOG_API_KEY?.trim() || process.env.POSTHOG_CLI_API_KEY?.trim() || "";
const sessionId = process.env.POSTHOG_SESSION_ID?.trim() || "";
const csrfToken = process.env.POSTHOG_CSRF_TOKEN?.trim() || "";

if (!apiKey && !(sessionId && csrfToken)) {
  console.error(
    "Missing PostHog auth. Set POSTHOG_API_KEY (preferred) or POSTHOG_SESSION_ID + POSTHOG_CSRF_TOKEN.",
  );
  process.exit(1);
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function authHeaders(withJson = false) {
  const headers = {};
  if (withJson) headers["Content-Type"] = "application/json";

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    return headers;
  }

  headers.Cookie = `sessionid=${sessionId}; posthog_csrftoken=${csrfToken}`;
  headers["X-CSRFToken"] = csrfToken;
  headers.Referer = `${host}/project/${projectId}/`;
  return headers;
}

async function apiRequest(pathname, options = {}) {
  const response = await fetch(`${host}/api/projects/${projectId}${pathname}`, {
    ...options,
    headers: {
      ...authHeaders(Boolean(options.body)),
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${pathname}: ${text.slice(0, 500)}`);
  }

  return text ? JSON.parse(text) : null;
}

async function listDashboards() {
  const payload = await apiRequest("/dashboards/?limit=200");
  return payload?.results ?? [];
}

async function getDashboard(dashboardId) {
  return apiRequest(`/dashboards/${dashboardId}/`);
}

async function createDashboard(input) {
  return apiRequest("/dashboards/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function patchDashboard(dashboardId, input) {
  return apiRequest(`/dashboards/${dashboardId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

async function listInsights() {
  const payload = await apiRequest("/insights/?limit=200");
  return payload?.results ?? [];
}

async function listCohorts() {
  const payload = await apiRequest("/cohorts/?limit=200");
  return payload?.results ?? [];
}

async function createCohort(input) {
  return apiRequest("/cohorts/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function patchCohort(cohortId, input) {
  return apiRequest(`/cohorts/${cohortId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

async function createInsight(input) {
  return apiRequest("/insights/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function patchInsight(insightId, input) {
  return apiRequest(`/insights/${insightId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

async function deleteInsightById(insightId) {
  return patchInsight(insightId, { deleted: true });
}

function resolveProperties(properties, cohortsByName) {
  return (properties ?? []).map((property) => {
    if (property?.type !== "cohort" || !property?.ref) return property;
    const cohort = cohortsByName.get(property.ref);
    if (!cohort?.id) {
      throw new Error(`Missing cohort reference: ${property.ref}`);
    }

    const { ref, ...rest } = property;
    return {
      ...rest,
      value: cohort.id,
    };
  });
}

function materializeInsightFilters(tileInsight, defaultProperties, cohortsByName) {
  const filters = JSON.parse(JSON.stringify(tileInsight));
  const properties = [
    ...resolveProperties(defaultProperties, cohortsByName),
    ...resolveProperties(filters.properties, cohortsByName),
  ];

  if (properties.length) {
    filters.properties = properties;
  } else {
    delete filters.properties;
  }

  return filters;
}

function insightPayload(tile, dashboardId, existingInsight, defaultProperties, cohortsByName) {
  const currentDashboards = Array.isArray(existingInsight?.dashboards) ? existingInsight.dashboards : [];
  return {
    name: tile.name,
    description: tile.description ?? null,
    filters: materializeInsightFilters(tile.insight, defaultProperties, cohortsByName),
    dashboards: dedupe([...currentDashboards, dashboardId]),
  };
}

async function main() {
  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw);

  const dashboards = await listDashboards();
  const dashboardsByName = new Map(dashboards.map((dashboard) => [dashboard.name, dashboard]));
  const insights = await listInsights();
  const insightsByName = new Map(insights.map((insight) => [insight.name, insight]));
  const cohorts = await listCohorts();
  const cohortsByName = new Map(cohorts.map((cohort) => [cohort.name, cohort]));
  const defaultProperties = config.default_properties ?? [];

  for (const dashboardName of config.unpin_dashboards ?? []) {
    const existing = dashboardsByName.get(dashboardName);
    if (!existing || existing.pinned === false) continue;
    await patchDashboard(existing.id, { pinned: false });
    console.log(`Unpinned dashboard: ${dashboardName}`);
  }

  for (const insightName of config.delete_insights ?? []) {
    const existing = insightsByName.get(insightName);
    if (!existing || existing.deleted) continue;
    await deleteInsightById(existing.id);
    console.log(`Deleted insight: ${insightName}`);
  }

  for (const cohortBlueprint of config.cohorts ?? []) {
    const existing = cohortsByName.get(cohortBlueprint.name);
    const payload = {
      name: cohortBlueprint.name,
      description: cohortBlueprint.description ?? "",
      groups: cohortBlueprint.groups ?? [],
      is_static: cohortBlueprint.is_static ?? false,
    };
    const cohort = existing
      ? await patchCohort(existing.id, payload)
      : await createCohort(payload);
    cohortsByName.set(cohort.name, cohort);
    console.log(`${existing ? "Updated" : "Created"} cohort: ${cohort.name}`);
  }

  for (const dashboardBlueprint of config.dashboards ?? []) {
    const existingDashboard = dashboardsByName.get(dashboardBlueprint.name);
    const dashboard = existingDashboard
      ? await patchDashboard(existingDashboard.id, {
          name: dashboardBlueprint.name,
          description: dashboardBlueprint.description ?? "",
          pinned: dashboardBlueprint.pinned ?? true,
        })
      : await createDashboard({
          name: dashboardBlueprint.name,
          description: dashboardBlueprint.description ?? "",
          pinned: dashboardBlueprint.pinned ?? true,
        });

    dashboardsByName.set(dashboard.name, dashboard);
    console.log(`${existingDashboard ? "Updated" : "Created"} dashboard: ${dashboard.name}`);

    const currentDetail = await getDashboard(dashboard.id);
    const currentTileInsights = (currentDetail.tiles ?? [])
      .map((tile) => tile?.insight)
      .filter(Boolean);
    const desiredNames = new Set(dashboardBlueprint.tiles.map((tile) => tile.name));

    for (const currentInsight of currentTileInsights) {
      if (desiredNames.has(currentInsight.name)) continue;
      const remainingDashboards = (currentInsight.dashboards ?? []).filter((value) => value !== dashboard.id);
      await patchInsight(currentInsight.id, { dashboards: remainingDashboards });
      console.log(`Detached stale tile from ${dashboard.name}: ${currentInsight.name}`);
    }

    for (const tile of dashboardBlueprint.tiles) {
      const existingInsight = insightsByName.get(tile.name);
      const payload = insightPayload(tile, dashboard.id, existingInsight, defaultProperties, cohortsByName);
      const nextInsight = existingInsight
        ? await patchInsight(existingInsight.id, payload)
        : await createInsight(payload);
      insightsByName.set(tile.name, nextInsight);
      console.log(`${existingInsight ? "Updated" : "Created"} insight: ${tile.name}`);
    }
  }

  console.log("PostHog dashboard blueprint applied.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
