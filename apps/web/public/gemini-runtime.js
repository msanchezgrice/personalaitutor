(function () {
  var currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
  if (document && document.documentElement) {
    document.documentElement.setAttribute("data-path", currentPath);
  }
  if (document && document.body) {
    document.body.setAttribute("data-path", currentPath);
  }
  var CTX_KEY = "ai_tutor_user_ctx_v1";
  var isDashboardPath = currentPath === "/dashboard" || currentPath.indexOf("/dashboard/") === 0;
  var DASHBOARD_SUMMARY_CACHE_PREFIX = "ai_tutor_dashboard_summary_v2:";
  var DASHBOARD_SNAPSHOT_CACHE_PREFIX = "ai_tutor_dashboard_snapshot_v2:";
  var SOCIAL_DRAFTS_CACHE_PREFIX = "ai_tutor_social_drafts_v1:";
  var SUMMARY_CACHE_TTL_MS = 120000;
  var SNAPSHOT_CACHE_TTL_MS = 1800000;
  var SOCIAL_DRAFTS_CACHE_TTL_MS = 600000;
  var SIGN_UP_INTENT_KEY = "ai_tutor_clerk_signup_intent_v1";
  var PENDING_ONBOARDING_SESSION_KEY = "ai_tutor_pending_onboarding_session_v1";
  var ONBOARDING_ASSESSMENT_FUNNEL = "onboarding_assessment";

  function normalizedPath(pathname) {
    return (pathname || "/").replace(/\/+$/, "") || "/";
  }

  function readSessionObject(key) {
    try {
      var raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeSessionObject(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function removeSessionObject(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      return null;
    }
  }

  function uuidv4() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
      var random = Math.floor(Math.random() * 16);
      var value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function readCtx() {
    try {
      var raw = window.localStorage.getItem(CTX_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveCtx(ctx) {
    try {
      window.localStorage.setItem(CTX_KEY, JSON.stringify(ctx));
    } catch {
      return null;
    }
  }

  function ensureCtx() {
    var existing = readCtx();
    if (existing && typeof existing === "object") {
      if (!existing.userId) {
        existing.sessionId = null;
        existing.projectId = null;
        existing.handle = null;
        existing.avatarUrl = null;
      }
      return existing;
    }

    var created = {
      userId: null,
      name: "New Learner",
      handle: null,
      sessionId: null,
      projectId: null,
      careerPathId: "product-management",
      avatarUrl: null,
      email: null,
    };
    saveCtx(created);
    return created;
  }

  var ctx = ensureCtx();
  var hasAppliedAuthCtx = false;
  var restoredDashboardSnapshot = false;
  var lastPosthogIdentifiedUserId = null;

  function posthogClient() {
    if (!window || !window.posthog) return null;
    if (typeof window.posthog.capture !== "function") return null;
    return window.posthog;
  }

  function baseAnalyticsProps(properties) {
    var base = {
      app: "web",
      path: currentPath,
    };
    if (ctx && ctx.userId) base.user_id = ctx.userId;
    if (ctx && ctx.sessionId) base.session_id = ctx.sessionId;
    if (ctx && ctx.handle) base.handle = ctx.handle;
    return Object.assign(base, properties || {});
  }

  function captureEvent(eventName, properties) {
    var posthog = posthogClient();
    if (!posthog || !eventName) return;
    try {
      posthog.capture(eventName, baseAnalyticsProps(properties));
    } catch {
      return null;
    }
  }

  function trackFunnelStep(step, properties) {
    if (!step) return;
    captureEvent("onboarding_assessment_funnel_step", Object.assign({
      funnel: ONBOARDING_ASSESSMENT_FUNNEL,
      step: step,
    }, properties || {}));
  }

  function identifyPosthogUser() {
    if (!ctx || !ctx.userId) return;
    var posthog = posthogClient();
    if (!posthog || typeof posthog.identify !== "function") return;

    var distinctId = String(ctx.userId);

    var personProps = {};
    if (ctx.email) personProps.email = ctx.email;
    if (ctx.name) personProps.name = ctx.name;
    if (ctx.handle) personProps.handle = ctx.handle;
    if (ctx.careerPathId) personProps.career_path_id = ctx.careerPathId;

    try {
      if (lastPosthogIdentifiedUserId === distinctId) {
        if (typeof posthog.setPersonProperties === "function" && Object.keys(personProps).length) {
          posthog.setPersonProperties(personProps);
        }
        return;
      }

      posthog.identify(distinctId, personProps);
      lastPosthogIdentifiedUserId = distinctId;
    } catch {
      return null;
    }
  }

  function markSignUpIntent() {
    writeSessionObject(SIGN_UP_INTENT_KEY, {
      startedAt: Date.now(),
      referrer: document && document.referrer ? document.referrer : null,
    });
  }

  function readSignUpIntent() {
    return readSessionObject(SIGN_UP_INTENT_KEY);
  }

  function clearSignUpIntent() {
    removeSessionObject(SIGN_UP_INTENT_KEY);
  }

  function readPendingOnboardingSessionId() {
    var fromUrl = null;
    try {
      var params = new URLSearchParams(window.location.search || "");
      var urlSession = params.get("onboardingSessionId");
      if (urlSession) fromUrl = urlSession;
    } catch {
      fromUrl = null;
    }
    if (fromUrl) return fromUrl;

    var pending = readSessionObject(PENDING_ONBOARDING_SESSION_KEY);
    if (!pending || typeof pending !== "object") return null;
    if (typeof pending.sessionId !== "string" || !pending.sessionId.trim()) return null;
    return pending.sessionId.trim();
  }

  function clearPendingOnboardingSession() {
    removeSessionObject(PENDING_ONBOARDING_SESSION_KEY);
  }

  function maybeTrackAuthEntryEvents() {
    if (currentPath === "/sign-up") {
      markSignUpIntent();
      captureEvent("clerk_sign_up_started", { auth_provider: "clerk" });
      captureEvent("clerk_sign_up_viewed", { auth_provider: "clerk" });
      captureEvent("auth_clerk_sign_up_viewed", { auth_provider: "clerk" });
      trackFunnelStep("clerk_sign_up_viewed", { auth_provider: "clerk" });
      return;
    }

    if (currentPath === "/sign-in") {
      captureEvent("auth_clerk_sign_in_viewed", { auth_provider: "clerk" });
    }
  }

  function maybeTrackSignUpCompletion(source) {
    if (!ctx || !ctx.userId) return;
    if (currentPath !== "/onboarding") return;
    var intent = readSignUpIntent();
    if (!intent || !intent.startedAt) return;

    captureEvent("clerk_sign_up_completed", {
      auth_provider: "clerk",
      source: source || "runtime",
      signup_started_at: intent.startedAt,
    });
    captureEvent("auth_clerk_sign_up_completed", {
      auth_provider: "clerk",
      source: source || "runtime",
      signup_started_at: intent.startedAt,
    });
    trackFunnelStep("clerk_sign_up_completed", {
      auth_provider: "clerk",
      source: source || "runtime",
    });
    clearSignUpIntent();
  }

  function maybeTrackDashboardWelcomeStep() {
    if (!isDashboardPath) return;
    var params = new URLSearchParams(window.location.search || "");
    if (params.get("welcome") !== "1") return;
    captureEvent("dashboard_welcome_viewed", {
      source: "assessment_redirect",
      situation: ctx && ctx.situation ? ctx.situation : null,
      career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : null,
    });
    trackFunnelStep("dashboard_welcome_viewed", {
      source: "assessment_redirect",
      situation: ctx && ctx.situation ? ctx.situation : null,
      career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : null,
    });
  }

  function cacheScope() {
    if (!ctx || !ctx.userId) return null;
    return String(ctx.userId);
  }

  function isNarrowViewport() {
    if (!window || typeof window.matchMedia !== "function") {
      return window.innerWidth <= 1024;
    }
    return window.matchMedia("(max-width: 1024px)").matches;
  }

  function dashboardSummaryCacheKey() {
    var scope = cacheScope();
    if (!scope) return null;
    return DASHBOARD_SUMMARY_CACHE_PREFIX + scope;
  }

  function readDashboardSummaryCache() {
    var key = dashboardSummaryCacheKey();
    if (!key) return null;
    var payload = readSessionObject(key);
    if (!payload || !payload.summary || !payload.ts) return null;
    if (Date.now() - Number(payload.ts) > SUMMARY_CACHE_TTL_MS) return null;
    return payload.summary;
  }

  function writeDashboardSummaryCache(summary) {
    var key = dashboardSummaryCacheKey();
    if (!key || !summary) return;
    writeSessionObject(key, { ts: Date.now(), summary: summary });
  }

  function dashboardSnapshotCacheKey(pathname) {
    var scope = cacheScope();
    if (!scope) return null;
    return DASHBOARD_SNAPSHOT_CACHE_PREFIX + scope + ":" + normalizedPath(pathname);
  }

  function socialDraftCacheKey(projectId) {
    var scope = cacheScope();
    if (!scope) return null;
    return SOCIAL_DRAFTS_CACHE_PREFIX + scope + ":" + String(projectId || "none");
  }

  function readSocialDraftCache(projectId) {
    var key = socialDraftCacheKey(projectId);
    if (!key) return null;
    var payload = readSessionObject(key);
    if (!payload || !payload.ts || !payload.drafts) return null;
    if (Date.now() - Number(payload.ts) > SOCIAL_DRAFTS_CACHE_TTL_MS) return null;
    return payload.drafts;
  }

  function writeSocialDraftCache(projectId, drafts) {
    var key = socialDraftCacheKey(projectId);
    if (!key || !drafts) return;
    writeSessionObject(key, { ts: Date.now(), drafts: drafts });
  }

  function persistDashboardSnapshot(pathname) {
    if (!isDashboardPath) return;
    if (isNarrowViewport()) return;
    var key = dashboardSnapshotCacheKey(pathname || currentPath);
    if (!key) return;
    var aside = document.querySelector("aside");
    var main = document.querySelector("main");
    if (!aside || !main) return;
    writeSessionObject(key, {
      ts: Date.now(),
      path: normalizedPath(pathname || currentPath),
      theme: document.documentElement.getAttribute("data-theme") || "light",
      asideClass: aside.className || "",
      mainClass: main.className || "",
      asideHtml: aside.innerHTML || "",
      mainHtml: main.innerHTML || "",
    });
    captureEvent("dashboard_snapshot_persisted", { path: normalizedPath(pathname || currentPath) });
  }

  function showDashboardSkeletons() {
    if (!isDashboardPath || restoredDashboardSnapshot) return;
    var cards = document.querySelectorAll("main .glass, main .glass-panel, main .panel");
    Array.prototype.forEach.call(cards, function (node) {
      node.classList.add("runtime-skeleton");
    });
  }

  function clearDashboardSkeletons() {
    if (!isDashboardPath) return;
    Array.prototype.forEach.call(document.querySelectorAll(".runtime-skeleton"), function (node) {
      node.classList.remove("runtime-skeleton");
    });
  }

  function restoreDashboardSnapshot() {
    if (!isDashboardPath) return false;
    if (isNarrowViewport()) return false;
    var key = dashboardSnapshotCacheKey(currentPath);
    if (!key) return false;
    var payload = readSessionObject(key);
    if (!payload || !payload.ts || !payload.asideHtml || !payload.mainHtml) return false;
    if (Date.now() - Number(payload.ts) > SNAPSHOT_CACHE_TTL_MS) return false;
    var aside = document.querySelector("aside");
    var main = document.querySelector("main");
    if (!aside || !main) return false;
    if (typeof payload.asideClass === "string" && payload.asideClass) aside.className = payload.asideClass;
    if (typeof payload.mainClass === "string" && payload.mainClass) main.className = payload.mainClass;
    aside.innerHTML = payload.asideHtml;
    main.innerHTML = payload.mainHtml;
    if (payload.theme === "dark" || payload.theme === "light") {
      document.documentElement.setAttribute("data-theme", payload.theme);
      document.documentElement.style.colorScheme = payload.theme === "dark" ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-runtime-ready", "1");
    captureEvent("dashboard_snapshot_restored", { path: currentPath });
    return true;
  }

  function wireDashboardSnapshotPersistence() {
    if (!isDashboardPath) return;
    if (isNarrowViewport()) return;
    if (document.documentElement.getAttribute("data-snapshot-cache-wired") === "1") return;
    document.documentElement.setAttribute("data-snapshot-cache-wired", "1");

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var target = event.target;
      if (!target || !target.closest) return;
      var link = target.closest("a[href]");
      if (!link) return;
      if (link.getAttribute("target") === "_blank") return;
      var href = link.getAttribute("href");
      if (!href || href.indexOf("javascript:") === 0) return;
      try {
        var url = new URL(href, window.location.origin);
        var nextPath = normalizedPath(url.pathname);
        if (nextPath === currentPath) return;
        if (nextPath === "/dashboard" || nextPath.indexOf("/dashboard/") === 0) {
          persistDashboardSnapshot(currentPath);
        }
      } catch {
        return;
      }
    }, true);

    window.addEventListener("pagehide", function () {
      persistDashboardSnapshot(currentPath);
    });
  }

  restoredDashboardSnapshot = restoreDashboardSnapshot();
  wireDashboardSnapshotPersistence();
  showDashboardSkeletons();

  function applyCtxImmediately() {
    if (!ctx || !ctx.name || !isDashboardPath) return;
    var sidebarProfileLink = document.querySelector("aside a[href='/dashboard/profile/'], aside a[href='/dashboard/profile']");
    if (sidebarProfileLink) {
      var nameEl = sidebarProfileLink.querySelector(".font-medium");
      var roleEl = sidebarProfileLink.querySelector(".text-xs");
      if (nameEl) nameEl.textContent = ctx.name;
      if (roleEl && ctx.headline) roleEl.textContent = ctx.headline;
      var sidebarAvatar = sidebarProfileLink.querySelector("img");
      if (sidebarAvatar && ctx.avatarUrl) {
        sidebarAvatar.setAttribute("src", ctx.avatarUrl);
        sidebarAvatar.setAttribute("alt", ctx.name);
      }
    }
    if (ctx.handle) {
      Array.prototype.forEach.call(
        document.querySelectorAll("a[href='/u/alex-chen-ai/'], a[href='/u/test-user-0001/'], a[href='/u/alex-chen-ai'], a[href='/u/test-user-0001']"),
        function (node) {
          node.setAttribute("href", "/u/" + ctx.handle + "/");
        },
      );
    }
    renameSocialNavLabels();
  }

  // Patch sidebar from cached ctx immediately (before any async API calls)
  // so users don't see placeholder "Alex Chen" flash on tab switch.
  applyCtxImmediately();

  function byText(selector, text) {
    return Array.prototype.find.call(document.querySelectorAll(selector), function (el) {
      return (el.textContent || "").trim().indexOf(text) !== -1;
    });
  }

  function setText(node, value) {
    if (!node) return;
    node.textContent = value;
  }

  function setHref(node, value) {
    if (!node || !value) return;
    node.setAttribute("href", value);
  }

  function renameSocialNavLabels() {
    Array.prototype.forEach.call(
      document.querySelectorAll("a[href='/dashboard/social/'], a[href='/dashboard/social']"),
      function (node) {
        if (typeof node.innerHTML === "string" && node.innerHTML.indexOf("Social Hooks") !== -1) {
          node.innerHTML = node.innerHTML.replace(/Social Hooks/g, "Social Media");
        }
      },
    );
  }

  function normalizeUrl(value) {
    var raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "";
    if (!/^https?:\/\//i.test(raw)) {
      raw = "https://" + raw;
    }
    try {
      return new URL(raw).toString();
    } catch {
      return "";
    }
  }

  function toast(message, isError) {
    var node = document.createElement("div");
    node.textContent = message;
    node.style.position = "fixed";
    node.style.right = "16px";
    node.style.bottom = "16px";
    node.style.zIndex = "9999";
    node.style.padding = "10px 14px";
    node.style.borderRadius = "10px";
    node.style.fontSize = "12px";
    node.style.border = "1px solid " + (isError ? "rgba(239,68,68,0.5)" : "rgba(16,185,129,0.5)");
    node.style.background = isError ? "rgba(127,29,29,0.9)" : "rgba(6,78,59,0.9)";
    node.style.color = "#fff";
    document.body.appendChild(node);
    window.setTimeout(function () {
      node.remove();
    }, 2800);
  }

  function isUnauthenticatedError(err) {
    if (!err) return false;
    if (err.code === "UNAUTHENTICATED") return true;
    if (typeof err.message === "string" && err.message.toLowerCase().indexOf("sign in required") !== -1) return true;
    return false;
  }

  async function performSignOut() {
    captureEvent("auth_sign_out_clicked", { auth_provider: "clerk" });
    var posthog = posthogClient();
    if (posthog && typeof posthog.reset === "function") {
      try {
        posthog.reset();
        lastPosthogIdentifiedUserId = null;
      } catch {
        // keep sign-out flow moving even if analytics reset fails
      }
    }
    try {
      if (window.Clerk && typeof window.Clerk.signOut === "function") {
        await window.Clerk.signOut({ redirectUrl: "/" });
        captureEvent("auth_sign_out_completed", { auth_provider: "clerk", method: "clerk_client" });
        return;
      }
    } catch {
      // fall through to sign-out route
    }
    captureEvent("auth_sign_out_fallback_redirect", { auth_provider: "clerk", method: "sign_out_route" });
    try {
      window.location.href = "/sign-out";
      return;
    } catch {
      captureEvent("auth_sign_out_failed", { auth_provider: "clerk", reason: "redirect_failed" });
      toast("Sign-out unavailable right now. Please retry.", true);
    }
  }

  function ensureGlobalSignOutControl(isSignedIn) {
    var existing = document.getElementById("global-sign-out");
    if (existing) existing.remove();
    return;
  }

  function redirectToSignIn(path) {
    window.location.href = "/sign-in?redirect_url=" + encodeURIComponent(path || "/dashboard/");
  }

  function requestHeaders(json) {
    var headers = {
      "cache-control": "no-store",
    };
    if (ctx.userId) {
      headers["x-user-id"] = ctx.userId;
    }
    if (json) headers["content-type"] = "application/json";
    return headers;
  }

  function pathWithUserId(path) {
    if (!ctx.userId) return path;
    var delimiter = path.indexOf("?") === -1 ? "?" : "&";
    return path + delimiter + "userId=" + encodeURIComponent(ctx.userId);
  }

  var authRequiredPaths = [
    "/dashboard",
    "/dashboard/chat",
    "/dashboard/projects",
    "/dashboard/social",
    "/dashboard/updates",
    "/dashboard/profile",
  ];

  function needsAuth() {
    return Array.isArray(authRequiredPaths) && authRequiredPaths.indexOf(currentPath) !== -1;
  }

  function readTheme() {
    try {
      var explicit = window.localStorage.getItem("ai_theme");
      if (explicit === "light" || explicit === "dark") return explicit;
      var legacy = window.localStorage.getItem("theme");
      if (legacy === "light") return "light";
    } catch {
      return "light";
    }
    return "light";
  }

  function persistTheme(theme) {
    try {
      window.localStorage.setItem("ai_theme", theme);
      window.localStorage.setItem("theme", theme);
    } catch {
      return null;
    }
  }

  function syncThemeToggleUi(theme) {
    var icon = document.getElementById("theme-icon");
    var toggle = document.getElementById("theme-toggle");
    if (icon) {
      icon.classList.remove("fa-sun", "fa-moon");
      icon.classList.add(theme === "light" ? "fa-moon" : "fa-sun");
    }
    if (toggle) {
      if (theme === "light") {
        toggle.classList.remove("text-white", "border-white/10", "bg-white/10", "hover:bg-white/20");
        toggle.classList.add("text-gray-800", "border-gray-300", "bg-white", "hover:bg-gray-100");
      } else {
        toggle.classList.remove("text-gray-800", "border-gray-300", "bg-white", "hover:bg-gray-100");
        toggle.classList.add("text-white", "border-white/10", "bg-white/10", "hover:bg-white/20");
      }
    }
  }

  function wireThemeToggle(attempt) {
    var themeToggle = document.getElementById("theme-toggle");
    if (!themeToggle) {
      if ((attempt || 0) < 6) {
        window.setTimeout(function () {
          wireThemeToggle((attempt || 0) + 1);
        }, 120);
      }
      return;
    }

    var current = readTheme();
    document.documentElement.setAttribute("data-theme", current);
    syncThemeToggleUi(current);

    themeToggle.addEventListener("click", function () {
      var theme = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      persistTheme(theme);
      syncThemeToggleUi(theme);
      captureEvent("theme_toggled", { theme: theme });
    });
  }

  async function syncAuthContext() {
    if (!needsAuth()) return null;
    var data = await getJson("/api/auth/session");
    if (!data || !data.auth) return null;
    var incomingUserId = data.auth.userId || null;
    if (incomingUserId && ctx.userId && incomingUserId !== ctx.userId) {
      ctx.sessionId = null;
      ctx.projectId = null;
      ctx.handle = null;
    }
    ctx.userId = incomingUserId || ctx.userId;
    if (data.auth.name) ctx.name = data.auth.name;
    if (data.auth.avatarUrl) ctx.avatarUrl = data.auth.avatarUrl;
    if (data.auth.email) ctx.email = data.auth.email;
    if (data.summary && data.summary.user && data.summary.user.handle) {
      ctx.handle = data.summary.user.handle;
      ctx.headline = headlineForUser(data.summary.user);
      if (data.summary.user.avatarUrl) ctx.avatarUrl = data.summary.user.avatarUrl;
    }
    if (data.summary) {
      writeDashboardSummaryCache(data.summary);
    }
    saveCtx(ctx);
    identifyPosthogUser();
    maybeTrackSignUpCompletion("sync_auth_context");
    captureEvent("auth_session_synced", {
      scope: "required_path",
      has_summary: Boolean(data.summary),
    });
    hasAppliedAuthCtx = true;
    applyCtxImmediately();
    return data;
  }

  async function maybeClaimOnboardingSession() {
    if (!ctx || !ctx.userId) return;
    var sessionToClaim = readPendingOnboardingSessionId();
    if (!sessionToClaim) return;

    try {
      var result = await postJson("/api/onboarding/claim", { sessionId: sessionToClaim });
      if (result && result.session) {
        ctx.sessionId = result.session.id || ctx.sessionId;
        if (result.session.careerPathId) ctx.careerPathId = result.session.careerPathId;
        if (result.session.situation) ctx.situation = result.session.situation;
        if (Array.isArray(result.session.goals)) ctx.onboardingGoals = result.session.goals;
      }
      if (result && result.user) {
        if (result.user.id) ctx.userId = result.user.id;
        if (result.user.handle) ctx.handle = result.user.handle;
        if (result.user.name) ctx.name = result.user.name;
        if (result.user.avatarUrl) ctx.avatarUrl = result.user.avatarUrl;
      }
      saveCtx(ctx);

      try {
        var summaryPayload = await getJson("/api/dashboard/summary");
        if (summaryPayload && summaryPayload.summary) {
          writeDashboardSummaryCache(summaryPayload.summary);
        }
      } catch {
        // Non-blocking refresh.
      }

      clearPendingOnboardingSession();
      captureEvent("onboarding_session_claimed", {
        session_id: sessionToClaim,
        migrated: Boolean(result && result.migrated),
      });
      trackFunnelStep("onboarding_session_claimed", {
        session_id: sessionToClaim,
        migrated: Boolean(result && result.migrated),
      });

      try {
        var params = new URLSearchParams(window.location.search || "");
        if (params.has("onboardingSessionId")) {
          params.delete("onboardingSessionId");
          var nextSearch = params.toString();
          var next = window.location.pathname + (nextSearch ? "?" + nextSearch : "");
          window.history.replaceState({}, "", next);
        }
      } catch {
        return;
      }
    } catch (err) {
      captureEvent("onboarding_session_claim_failed", {
        session_id: sessionToClaim,
        reason: err && err.message ? err.message : "unknown_error",
      });
    }
  }

  function applyLandingAuthUi(summary) {
    if (currentPath !== "/") return;
    var navLogIn = Array.prototype.find.call(document.querySelectorAll("a"), function (node) {
      var text = (node.textContent || "").trim().toLowerCase();
      var href = node.getAttribute("href") || "";
      return text === "log in" || href.indexOf("/sign-in") === 0;
    });
    if (!navLogIn) return;

    var isSignedIn = Boolean(summary && summary.user && summary.user.handle);
    if (!isSignedIn) {
      navLogIn.setAttribute("href", "/sign-in?redirect_url=/dashboard/");
      navLogIn.textContent = "Log In";
      return;
    }

    navLogIn.setAttribute("href", "/dashboard/");
    navLogIn.textContent = "Dashboard";
  }

  async function trySyncLandingAuth() {
    if (currentPath !== "/") return;
    try {
      var data = await getJson("/api/auth/session");
      if (data && data.summary) {
        if (data.auth && data.auth.userId) ctx.userId = data.auth.userId;
        if (data.auth && data.auth.name) ctx.name = data.auth.name;
        if (data.auth && data.auth.avatarUrl) ctx.avatarUrl = data.auth.avatarUrl;
        if (data.summary.user && data.summary.user.handle) ctx.handle = data.summary.user.handle;
        saveCtx(ctx);
        identifyPosthogUser();
        maybeTrackSignUpCompletion("landing_auth");
        applyLandingAuthUi(data.summary);
        ensureGlobalSignOutControl(true);
        captureEvent("auth_session_synced", { scope: "landing", signed_in: true });
      } else {
        ctx.userId = null;
        ctx.handle = null;
        ctx.sessionId = null;
        ctx.projectId = null;
        ctx.avatarUrl = null;
        ctx.email = null;
        saveCtx(ctx);
        lastPosthogIdentifiedUserId = null;
        applyLandingAuthUi(null);
        ensureGlobalSignOutControl(false);
        captureEvent("auth_session_synced", { scope: "landing", signed_in: false });
      }
    } catch {
      ctx.userId = null;
      ctx.handle = null;
      ctx.sessionId = null;
      ctx.projectId = null;
      ctx.avatarUrl = null;
      ctx.email = null;
      saveCtx(ctx);
      lastPosthogIdentifiedUserId = null;
      applyLandingAuthUi(null);
      ensureGlobalSignOutControl(false);
      captureEvent("auth_session_sync_failed", { scope: "landing" });
    }
  }

  async function syncOptionalAuthUi() {
    if (needsAuth() || currentPath === "/") return;
    try {
      var data = await getJson("/api/auth/session");
      if (data && data.auth) {
        if (data.auth.userId) ctx.userId = data.auth.userId;
        if (data.auth.name) ctx.name = data.auth.name;
        if (data.auth.avatarUrl) ctx.avatarUrl = data.auth.avatarUrl;
        if (data.auth.email) ctx.email = data.auth.email;
        if (data.summary && data.summary.user && data.summary.user.handle) ctx.handle = data.summary.user.handle;
        saveCtx(ctx);
        identifyPosthogUser();
        maybeTrackSignUpCompletion("optional_auth");
        ensureGlobalSignOutControl(true);
        captureEvent("auth_session_synced", { scope: "optional", signed_in: true });
        return;
      }
    } catch {
      // not signed in
    }
    lastPosthogIdentifiedUserId = null;
    ensureGlobalSignOutControl(false);
    captureEvent("auth_session_synced", { scope: "optional", signed_in: false });
  }

  async function postJson(url, body) {
    var payload = body || {};
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      var cleaned = {};
      Object.keys(payload).forEach(function (key) {
        var value = payload[key];
        if (value !== null && value !== undefined) {
          cleaned[key] = value;
        }
      });
      payload = cleaned;
    }
    var res = await fetch(url, {
      method: "POST",
      headers: requestHeaders(true),
      cache: "no-store",
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      var details = data && data.error && data.error.details ? data.error.details : {};
      var message = data && data.error && data.error.message ? data.error.message : "Request failed";
      var err = new Error(message);
      err.code = data && data.error ? data.error.code : "REQUEST_FAILED";
      err.details = details;
      throw err;
    }
    return data;
  }

  async function getJson(url) {
    var res = await fetch(url, {
      method: "GET",
      headers: requestHeaders(false),
      cache: "no-store",
      credentials: "same-origin",
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      var details = data && data.error && data.error.details ? data.error.details : {};
      var message = data && data.error && data.error.message ? data.error.message : "Request failed";
      var err = new Error(message);
      err.code = data && data.error ? data.error.code : "REQUEST_FAILED";
      err.details = details;
      throw err;
    }
    return data;
  }

  function projectStateRank(state) {
    if (state === "showcased") return 5;
    if (state === "built") return 4;
    if (state === "building") return 3;
    if (state === "planned") return 2;
    if (state === "idea") return 1;
    return 0;
  }

  function headlineForUser(user) {
    if (!user || !user.headline) return "AI Builder";
    return user.headline;
  }

  function updateSharedUserUi(summary) {
    if (!summary || !summary.user) return;
    var user = summary.user;
    ctx.handle = user.handle;
    ctx.name = user.name;
    ctx.headline = headlineForUser(user);
    if (user.avatarUrl) ctx.avatarUrl = user.avatarUrl;
    saveCtx(ctx);

    var sidebarProfileLink = document.querySelector("aside a[href='/dashboard/profile/'], aside a[href='/dashboard/profile']");
    if (sidebarProfileLink) {
      var nameEl = sidebarProfileLink.querySelector(".font-medium");
      var roleEl = sidebarProfileLink.querySelector(".text-xs");
      setText(nameEl, user.name);
      setText(roleEl, headlineForUser(user));
      var avatar = sidebarProfileLink.querySelector("img");
      if (avatar) {
        avatar.setAttribute("alt", user.name);
        if (ctx.avatarUrl) avatar.setAttribute("src", ctx.avatarUrl);
      }
    }

    var publicProfileLinks = document.querySelectorAll("a[href='/u/alex-chen-ai/'], a[href='/u/test-user-0001/'], a[href='/u/alex-chen-ai'], a[href='/u/test-user-0001']");
    Array.prototype.forEach.call(publicProfileLinks, function (link) {
      setHref(link, "/u/" + user.handle + "/");
    });

    var greeting = Array.prototype.find.call(document.querySelectorAll("header h1"), function (el) {
      var text = (el.textContent || "").toLowerCase();
      return text.indexOf("good morning") !== -1 || text.indexOf("good afternoon") !== -1 || text.indexOf("good evening") !== -1;
    });

    if (greeting) {
      var firstName = user.name.split(" ")[0] || user.name;
      greeting.textContent = "Good Morning, " + firstName + " 👋";
    }

    if (ctx.avatarUrl && isDashboardPath) {
      Array.prototype.forEach.call(
        document.querySelectorAll("aside img[src='/assets/avatar.png'], aside a[href='/dashboard/profile'] img[src='/assets/avatar.png'], aside a[href='/dashboard/profile/'] img[src='/assets/avatar.png']"),
        function (node) {
          node.setAttribute("src", ctx.avatarUrl);
          if (!node.getAttribute("alt")) node.setAttribute("alt", user.name);
        },
      );
    }

    if (isDashboardPath) {
      renameSocialNavLabels();
      var staleSidebarSignOut = document.getElementById("dashboard-sidebar-settings");
      if (staleSidebarSignOut) staleSidebarSignOut.remove();
      var aside = document.querySelector("aside");
      if (aside) {
        Array.prototype.forEach.call(aside.querySelectorAll("a,button"), function (node) {
          var text = (node.textContent || "").trim().toLowerCase();
          if (text === "sign out" || text === "log out") {
            node.remove();
          }
        });
      }
      ensureDashboardSettingsMenu();
      ensureMobileDashboardNav();
    }
  }

  function ensureDashboardSettingsMenu() {
    if (!isDashboardPath) return;
    if (document.getElementById("dashboard-settings-menu")) return;

    var header = document.querySelector("main header");
    if (!header) return;

    var rightControls = header.querySelector(".flex.items-center.gap-4") || header.querySelector(".flex.items-center.gap-2");
    if (!rightControls) {
      rightControls = document.createElement("div");
      rightControls.className = "flex items-center gap-2";
      header.appendChild(rightControls);
    }

    var menu = document.createElement("div");
    menu.id = "dashboard-settings-menu";
    menu.className = "relative";
    menu.innerHTML =
      '<button type="button" class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-gray-300" data-settings-toggle="1">' +
      '<i class="fa-solid fa-gear"></i><span class="hidden md:inline">Settings</span></button>' +
      '<div class="hidden absolute right-0 top-full mt-2 min-w-[170px] rounded-xl border border-white/10 bg-[#0f111a]/95 backdrop-blur-xl shadow-2xl p-1 z-40" data-settings-panel="1">' +
      '<a href="/dashboard/profile/" class="block px-3 py-2 text-sm text-gray-200 rounded-lg hover:bg-white/10"><i class="fa-regular fa-user mr-2"></i>Profile Settings</a>' +
      '<button type="button" class="w-full text-left px-3 py-2 text-sm text-red-300 rounded-lg hover:bg-red-500/20" data-sign-out="1"><i class="fa-solid fa-right-from-bracket mr-2"></i>Sign Out</button>' +
      "</div>";

    rightControls.appendChild(menu);
    var toggle = menu.querySelector("[data-settings-toggle='1']");
    var panel = menu.querySelector("[data-settings-panel='1']");
    var signOut = menu.querySelector("[data-sign-out='1']");

    if (toggle && panel) {
      toggle.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        panel.classList.toggle("hidden");
      });

      document.addEventListener("click", function (event) {
        if (!menu.contains(event.target)) {
          panel.classList.add("hidden");
        }
      });
    }

    if (signOut) {
      signOut.addEventListener("click", async function () {
        void performSignOut();
      });
    }
  }

  function ensureMobileDashboardNav() {
    if (!isDashboardPath) return;
    var shell = document.querySelector("[data-gemini-shell='1']");
    if (!shell) return;
    var aside = shell.querySelector(":scope > aside");
    var main = shell.querySelector(":scope > main");
    if (!aside || !main) return;

    var header = main.querySelector(":scope > header");
    if (!header) return;

    var existingOverlay = document.querySelector(".dashboard-mobile-nav-overlay");
    if (!existingOverlay) {
      var overlay = document.createElement("button");
      overlay.type = "button";
      overlay.className = "dashboard-mobile-nav-overlay";
      overlay.setAttribute("aria-label", "Close menu");
      overlay.addEventListener("click", function () {
        document.documentElement.setAttribute("data-mobile-nav", "closed");
      });
      document.body.appendChild(overlay);
    }

    var leftCluster = header.querySelector(".flex.items-center.gap-4") || header.querySelector("div");
    if (!leftCluster) leftCluster = header;

    var toggleButton = header.querySelector("[data-mobile-nav-toggle='1']");
    if (!toggleButton) {
      toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.setAttribute("data-mobile-nav-toggle", "1");
      toggleButton.setAttribute("aria-label", "Open menu");
      toggleButton.className =
        "hidden lg:hidden mr-3 h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-gray-200";
      toggleButton.innerHTML = '<i class="fa-solid fa-bars text-sm"></i>';
      if (leftCluster.firstChild) {
        leftCluster.insertBefore(toggleButton, leftCluster.firstChild);
      } else {
        leftCluster.appendChild(toggleButton);
      }
    }

    var closeMobileMenu = function () {
      document.documentElement.setAttribute("data-mobile-nav", "closed");
    };

    toggleButton.onclick = function () {
      var isOpen = document.documentElement.getAttribute("data-mobile-nav") === "open";
      document.documentElement.setAttribute("data-mobile-nav", isOpen ? "closed" : "open");
      captureEvent("dashboard_mobile_nav_toggled", { is_open: !isOpen });
    };

    Array.prototype.forEach.call(aside.querySelectorAll("a[href]"), function (node) {
      if (node.getAttribute("data-mobile-nav-bound") === "1") return;
      node.setAttribute("data-mobile-nav-bound", "1");
      node.addEventListener("click", function () {
        closeMobileMenu();
      });
    });

    if (!isNarrowViewport()) {
      document.documentElement.setAttribute("data-mobile-nav", "closed");
    } else if (!document.documentElement.getAttribute("data-mobile-nav")) {
      document.documentElement.setAttribute("data-mobile-nav", "closed");
    }

    if (document.documentElement.getAttribute("data-mobile-nav-resize-wired") !== "1") {
      document.documentElement.setAttribute("data-mobile-nav-resize-wired", "1");
      window.addEventListener("resize", function () {
        if (!isDashboardPath) return;
        ensureMobileDashboardNav();
      });
    }
  }

  async function ensureSession() {
    if (ctx.sessionId) return { id: ctx.sessionId, userId: ctx.userId, onboardingOptions: ctx.onboardingOptions || [] };

    var baseHandle = ctx.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "learner";

    var data = await postJson("/api/onboarding/start", {
      name: ctx.name,
      handleBase: baseHandle,
      careerPathId: ctx.careerPathId || "product-management",
      avatarUrl: ctx.avatarUrl || null,
    });

    ctx.sessionId = data.session.id;
    if (data.user && data.user.id) ctx.userId = data.user.id;
    if (data.user && data.user.handle) ctx.handle = data.user.handle;
    if (data.user && data.user.name) ctx.name = data.user.name;
    if (data.user && data.user.avatarUrl) ctx.avatarUrl = data.user.avatarUrl;
    if (Array.isArray(data.onboardingOptions)) ctx.onboardingOptions = data.onboardingOptions;
    saveCtx(ctx);
    identifyPosthogUser();
    captureEvent("onboarding_session_initialized", {
      session_id: data.session.id,
      career_path_id: ctx.careerPathId || "product-management",
      source: "onboarding_start",
    });
    trackFunnelStep("onboarding_session_initialized", {
      session_id: data.session.id,
      career_path_id: ctx.careerPathId || "product-management",
      source: "onboarding_start",
    });

    return {
      id: data.session.id,
      userId: data.session.userId || ctx.userId,
      onboardingOptions: Array.isArray(data.onboardingOptions) ? data.onboardingOptions : [],
    };
  }

  async function getDashboardSummary() {
    var cached = readDashboardSummaryCache();
    if (cached) {
      captureEvent("dashboard_summary_cache_hit", { source: "session_storage" });
      void (async function refreshDashboardSummary() {
        try {
          var fresh = await getJson("/api/dashboard/summary");
          if (fresh && fresh.summary) {
            writeDashboardSummaryCache(fresh.summary);
            captureEvent("dashboard_summary_refreshed", { source: "network" });
          }
        } catch {
          return null;
        }
      })();
      return cached;
    }

    try {
      var response = await getJson("/api/dashboard/summary");
      if (response && response.summary) {
        writeDashboardSummaryCache(response.summary);
        captureEvent("dashboard_summary_loaded", { source: "network" });
      }
      return response.summary;
    } catch (err) {
      await ensureSession();
      var retry = await getJson("/api/dashboard/summary");
      if (retry && retry.summary) {
        writeDashboardSummaryCache(retry.summary);
        captureEvent("dashboard_summary_loaded", { source: "network_after_session" });
      }
      return retry.summary;
    }
  }

  async function ensurePrimaryProject(summary) {
    var projects = (summary && summary.projects) || [];
    var ranked = projects.slice().sort(function (a, b) {
      return projectStateRank(b.state) - projectStateRank(a.state);
    });

    if (ranked.length) {
      ctx.projectId = ranked[0].id;
      saveCtx(ctx);
      return ranked[0];
    }

    var created = await postJson("/api/projects", {
      title: "Customer Support Copilot",
      description: "Automated responder project scaffolded from onboarding.",
      userId: ctx.userId,
      slug: "customer-support-copilot",
    });
    ctx.projectId = created.project.id;
    saveCtx(ctx);
    return created.project;
  }

  async function hydrateDashboardHome() {
    captureEvent("dashboard_tab_viewed", { tab: "home" });
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);
    var topRecommendation = Array.isArray(summary.moduleRecommendations) && summary.moduleRecommendations.length
      ? summary.moduleRecommendations[0]
      : null;

    var projects = summary.projects || [];
    var active = projects.find(function (project) {
      return project.state === "building" || project.state === "planned" || project.state === "idea";
    }) || projects[0] || null;

    var completed = projects.find(function (project) {
      return project.state === "built" || project.state === "showcased";
    }) || projects[1] || null;

    var tutorBanner = document.querySelector("div.glass-panel.p-6.rounded-2xl.mb-8");
    if (tutorBanner && topRecommendation) {
      var bannerTitle = tutorBanner.querySelector("h3");
      var bannerBody = tutorBanner.querySelector("p.text-sm.text-gray-400");
      var bannerCta = tutorBanner.querySelector("a.btn");
      if (bannerTitle) {
        bannerTitle.innerHTML = '<span class="text-emerald-400">My AI Skill Tutor:</span> Start your recommended module: ' + topRecommendation.title + ".";
      }
      if (bannerBody) {
        bannerBody.textContent = topRecommendation.summary + " Added from your onboarding assessment.";
      }
      if (bannerCta) {
        bannerCta.textContent = "Start Recommended Module";
        setHref(bannerCta, "/dashboard/chat/?module=" + encodeURIComponent(topRecommendation.id));
      }
    }

    var cards = document.querySelectorAll("section .grid.sm\\:grid-cols-2 > a");
    if (cards[0] && active) {
      var title = cards[0].querySelector("h3");
      var desc = cards[0].querySelector("p.text-xs");
      setText(title, active.title);
      setText(desc, active.description);
      setHref(cards[0], "/dashboard/projects/");
    }

    if (cards[1] && completed) {
      var title2 = cards[1].querySelector("h3");
      var desc2 = cards[1].querySelector("p.text-xs");
      setText(title2, completed.title);
      setText(desc2, completed.description);
      setHref(cards[1], "/dashboard/projects/");
    }

    var skillStack = Array.prototype.find.call(document.querySelectorAll("section .glass.p-6.rounded-xl"), function (node) {
      return (node.textContent || "").indexOf("Add Target Skill") !== -1;
    });

    if (skillStack && summary.user && Array.isArray(summary.user.skills) && summary.user.skills.length) {
      var addTarget = Array.prototype.find.call(skillStack.children, function (child) {
        return (child.textContent || "").indexOf("Add Target Skill") !== -1;
      });
      skillStack.innerHTML = "";
      summary.user.skills.slice(0, 3).forEach(function (skill, index) {
        var pill = document.createElement("div");
        if (index === 0 && skill.status === "verified") {
          pill.className = "flex border border-emerald-500/30 bg-emerald-500/10 rounded-full items-center pl-1 pr-3 py-1";
          pill.innerHTML = '<img src="/assets/badge.png" class="w-6 h-6 mr-1" alt="verified"><span class="text-xs font-medium text-emerald-400"></span>';
          var label = pill.querySelector("span");
          setText(label, skill.skill);
        } else {
          pill.className = "flex border border-white/10 bg-white/5 rounded-full items-center px-3 py-1.5";
          pill.innerHTML = '<span class="text-xs text-gray-300"></span>';
          var text = skill.skill + " (" + Math.round((skill.score || 0) * 100) + "%)";
          setText(pill.querySelector("span"), text);
        }
        skillStack.appendChild(pill);
      });

      if (addTarget) skillStack.appendChild(addTarget);
    } else if (skillStack && Array.isArray(summary.moduleRecommendations) && summary.moduleRecommendations.length) {
      var addTargetSkill = Array.prototype.find.call(skillStack.children, function (child) {
        return (child.textContent || "").indexOf("Add Target Skill") !== -1;
      });
      skillStack.innerHTML = "";
      summary.moduleRecommendations.slice(0, 3).forEach(function (track, index) {
        var fallback = document.createElement("div");
        fallback.className = index === 0
          ? "flex border border-emerald-500/30 bg-emerald-500/10 rounded-full items-center px-3 py-1.5"
          : "flex border border-white/10 bg-white/5 rounded-full items-center px-3 py-1.5";
        var pct = index === 0 ? "20%" : index === 1 ? "10%" : "5%";
        fallback.innerHTML = '<span class="text-xs ' + (index === 0 ? "text-emerald-400" : "text-gray-300") + '"></span>';
        setText(fallback.querySelector("span"), track.title + " (" + pct + ")");
        skillStack.appendChild(fallback);
      });
      if (addTargetSkill) skillStack.appendChild(addTargetSkill);
    }

    var socialQuote = document.querySelector("section p.text-sm.text-gray-300.mb-4.italic");
    if (socialQuote) {
      window.setTimeout(function () {
        void (async function hydrateSocialQuote() {
          try {
            var drafts = await postJson("/api/social/drafts/generate", { userId: ctx.userId, projectId: active ? active.id : null });
            var linkedinDraft = (drafts.drafts || []).find(function (entry) { return entry.platform === "linkedin"; });
            if (linkedinDraft) {
              socialQuote.textContent = '"' + linkedinDraft.text.slice(0, 160) + '..."';
            }
          } catch {
            return null;
          }
        })();
      }, 10);
    }
  }

  async function hydrateProjectsPage() {
    captureEvent("dashboard_tab_viewed", { tab: "projects" });
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);

    var projects = (summary.projects || []).slice();
    var active = projects.find(function (project) {
      return project.state === "building" || project.state === "planned" || project.state === "idea";
    }) || projects[0] || null;

    var activeBanner = document.querySelector("a[href='/dashboard/chat/'].glass-panel");
    if (activeBanner && active) {
      var title = activeBanner.querySelector("h3");
      var desc = activeBanner.querySelector("p.text-sm.text-gray-400");
      setText(title, active.title);
      setText(desc, active.description);
      var pct = activeBanner.querySelector(".absolute.inset-0.flex.items-center.justify-center");
      if (pct) {
        var progress = Math.min(95, Math.max(20, active.buildLog ? active.buildLog.length * 12 : 40));
        setText(pct, progress + "%");
      }
    }

    var completed = projects.filter(function (project) {
      return project.state === "built" || project.state === "showcased";
    });

    var grid = document.querySelector("section .grid.md\\:grid-cols-2.gap-6");
    if (grid) {
      var template = grid.children[0] ? grid.children[0].cloneNode(true) : null;
      grid.innerHTML = "";

      var rows = completed.length ? completed.slice(0, 6) : (active ? [active] : []);
      rows.forEach(function (project) {
        if (!template) return;
        var card = template.cloneNode(true);
        var title = card.querySelector("h3");
        var desc = card.querySelector("p.text-sm.text-gray-400");
        setText(title, project.title);
        setText(desc, project.description);

        var publicLink = card.querySelector("a[href*='/u/']");
        if (publicLink && ctx.handle) {
          setHref(publicLink, "/u/" + ctx.handle + "/projects/" + project.slug + "/");
        }

        var copyBtn = card.querySelector("button[title='Copy Link']");
        if (copyBtn && ctx.handle) {
          copyBtn.dataset.copyUrl = window.location.origin + "/u/" + ctx.handle + "/projects/" + project.slug + "/";
        }

        grid.appendChild(card);
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("button[title='Copy Link']"), function (button) {
      button.addEventListener("click", async function () {
        var value = button.dataset.copyUrl;
        if (!value) {
          var row = button.closest("div.flex.items-center.gap-3");
          var link = row ? row.querySelector("a[href]") : null;
          if (link) {
            var href = link.getAttribute("href") || "";
            value = href.startsWith("http") ? href : window.location.origin + href;
          }
        }

        if (!value) return;
        try {
          await navigator.clipboard.writeText(value);
          toast("Project link copied.", false);
        } catch {
          toast("Clipboard unavailable.", true);
        }
      });
    });
  }

  function createBubble(html, isUser) {
    var wrapper = document.createElement("div");
    var theme = document.documentElement.getAttribute("data-theme") || "dark";
    wrapper.className = isUser
      ? "flex items-start justify-end gap-4 max-w-4xl ml-auto"
      : "flex items-start gap-4 max-w-4xl";

    if (isUser) {
      var userAvatar = ctx.avatarUrl || "/assets/avatar.png";
      var userAlt = ctx.name || "Learner";
      wrapper.innerHTML =
        '<div class="chat-user-bubble bg-emerald-600 text-white p-5 rounded-2xl rounded-tr-sm text-sm shadow-[0_5px_15px_rgba(16,185,129,0.2)]"></div>' +
        '<img src="' + userAvatar + '" class="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0 mt-1" alt="' + userAlt + '">';
      wrapper.querySelector("div").innerHTML = html;
      if (theme === "light") {
        wrapper.querySelector(".chat-user-bubble").classList.add("chat-user-bubble-light");
      }
    } else {
      wrapper.innerHTML =
        '<div class="w-8 h-8 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]"><i class="fa-solid fa-robot text-white text-[10px]"></i></div>' +
        '<div class="chat-ai-bubble glass p-5 rounded-2xl rounded-tl-sm text-sm border-emerald-500/20 bg-emerald-500/5"></div>';
      wrapper.querySelector("div.glass").innerHTML = html;
      if (theme === "light") {
        wrapper.querySelector(".chat-ai-bubble").classList.add("chat-ai-bubble-light");
      }
    }

    return wrapper;
  }

  async function hydrateChatPage() {
    captureEvent("dashboard_tab_viewed", { tab: "chat" });
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);
    var projectPromise = ensurePrimaryProject(summary);

    var subtitle = document.querySelector("header .text-xs.text-gray-400");
    projectPromise.then(function (project) {
      if (subtitle && project) {
        subtitle.textContent = project.title + " • Active Build";
      }
    }).catch(function () {
      return null;
    });

    var history = document.querySelector("main .flex-1.overflow-y-auto");
    var textarea = document.querySelector("textarea");
    var sendBtn = Array.prototype.find.call(document.querySelectorAll("button"), function (btn) {
      return btn.querySelector(".fa-paper-plane");
    });

    if (!history || !textarea || !sendBtn) return;

    var sending = false;
    history.innerHTML = "";
    var introBubble = createBubble("<p></p>", false);
    var introParagraph = introBubble.querySelector("p");
    setText(
      introParagraph,
      "Welcome back. I’m your AI Tutor. Share what you’re trying to build and I’ll map the next steps with proof artifacts."
    );
    history.appendChild(introBubble);
    history.scrollTop = history.scrollHeight;
    projectPromise
      .then(function (project) {
        if (!project || !introParagraph) return;
        setText(
          introParagraph,
          "Welcome back. I’m your AI Tutor. Let’s continue " +
            project.title +
            ". Share your current blocker and I’ll give concrete next steps plus a verification check."
        );
      })
      .catch(function () {
        return null;
      });

    async function sendMessage() {
      if (sending) return;
      var text = (textarea.value || "").trim();
      if (!text) return;
      sending = true;

      var userBubble = createBubble("<p></p>", true);
      setText(userBubble.querySelector("p"), text);
      history.appendChild(userBubble);
      history.scrollTop = history.scrollHeight;
      textarea.value = "";
      captureEvent("chat_message_sent", { message_length: text.length });

      try {
        var project = await projectPromise;
        if (!project || !project.id) {
          throw new Error("Project context unavailable");
        }
        var result = await postJson("/api/projects/" + encodeURIComponent(project.id) + "/chat", {
          message: text,
        });

        var replyText = result.reply || "My AI Skill Tutor: I logged this step in your project build log.";
        var aiBubble = createBubble("<p></p>", false);
        setText(aiBubble.querySelector("p"), replyText);
        history.appendChild(aiBubble);
        history.scrollTop = history.scrollHeight;
        captureEvent("chat_message_received", { reply_length: replyText.length });
      } catch (err) {
        var errorBubble = createBubble("<p></p>", false);
        setText(errorBubble.querySelector("p"), "My AI Skill Tutor failed to respond: " + (err && err.message ? err.message : "Unknown error"));
        history.appendChild(errorBubble);
        history.scrollTop = history.scrollHeight;
        captureEvent("chat_message_failed", { reason: err && err.message ? err.message : "unknown_error" });
      } finally {
        sending = false;
      }
    }

    sendBtn.addEventListener("click", function () {
      void sendMessage();
    });

    textarea.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    });
  }

  async function hydrateSocialPage() {
    captureEvent("dashboard_tab_viewed", { tab: "social" });

    renameSocialNavLabels();

    var socialHeading = document.querySelector("header h1");
    if (socialHeading) {
      socialHeading.innerHTML = '<i class="fa-solid fa-share-nodes text-[#0077b5]"></i> Social Media';
    }
    var socialSubheading = document.querySelector("header p.text-xs.text-gray-400");
    if (socialSubheading) {
      socialSubheading.textContent = "AI-generated LinkedIn + Tweet ideas based on your current learner memory.";
    }
    if (typeof document.title === "string" && document.title.indexOf("Social Hooks") !== -1) {
      document.title = document.title.replace(/Social Hooks/g, "Social Media");
    }

    var contentWrap = document.querySelector(
      "main .p-10.max-w-4xl.mx-auto.w-full.pb-24.space-y-8, main .p-6.md\\:p-10.max-w-5xl.mx-auto.w-full.pb-24",
    );
    if (!contentWrap) return;

    contentWrap.innerHTML =
      '<section class="glass p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5 runtime-social-shell">' +
      '<div class="h-5 w-40 rounded bg-white/10 runtime-skeleton mb-4"></div>' +
      '<div class="grid gap-4 md:grid-cols-2">' +
      '<div class="rounded-xl border border-white/10 p-4"><div class="h-40 rounded-lg bg-white/10 runtime-skeleton"></div></div>' +
      '<div class="rounded-xl border border-white/10 p-4"><div class="h-40 rounded-lg bg-white/10 runtime-skeleton"></div></div>' +
      "</div>" +
      "</section>";

    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);
    var primaryProject = null;
    try {
      primaryProject = await ensurePrimaryProject(summary);
    } catch {
      primaryProject = null;
    }

    contentWrap.innerHTML =
      '<section class="glass p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5">' +
      '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">' +
      '<div><h2 class="text-lg font-[Outfit] font-semibold text-white">Social Media Drafts</h2>' +
      '<p class="text-xs text-gray-400">Edit and share native drafts for LinkedIn and X/Twitter.</p>' +
      '<p class="text-[11px] text-gray-500 mt-1">Voice: <span data-social-author="1"></span></p></div>' +
      '<button type="button" data-social-refresh="1" class="btn btn-secondary text-sm whitespace-nowrap"><i class="fa-solid fa-rotate-right mr-2"></i>Refresh Ideas</button>' +
      "</div>" +
      '<div class="grid gap-4 md:grid-cols-2">' +
      '<article class="rounded-xl border border-[#0a66c2]/35 bg-[#0a66c2]/10 p-4">' +
      '<div class="flex items-center justify-between mb-3"><span class="text-[11px] uppercase tracking-wider text-[#53a9ff] font-semibold">LinkedIn</span><span class="text-[10px] text-gray-300">Native share</span></div>' +
      '<textarea data-social-input="linkedin" class="w-full min-h-[180px] rounded-lg border border-white/10 bg-[#0f172a]/70 p-3 text-[13px] text-gray-100 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50" readonly></textarea>' +
      '<div class="flex items-center gap-2 mt-3">' +
      '<button type="button" data-social-edit="linkedin" class="btn btn-secondary text-xs"><i class="fa-solid fa-pen mr-2"></i>Edit</button>' +
      '<button type="button" data-social-share="linkedin" class="btn bg-[#0a66c2] text-white hover:bg-[#095592] text-xs"><i class="fa-brands fa-linkedin-in mr-2"></i>Share</button>' +
      "</div></article>" +
      '<article class="rounded-xl border border-white/15 bg-black/30 p-4">' +
      '<div class="flex items-center justify-between mb-3"><span class="text-[11px] uppercase tracking-wider text-white font-semibold">Tweet</span><span class="text-[10px] text-gray-300">Native composer</span></div>' +
      '<textarea data-social-input="x" class="w-full min-h-[180px] rounded-lg border border-white/10 bg-[#0f172a]/70 p-3 text-[13px] text-gray-100 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-white/30" readonly></textarea>' +
      '<div class="flex items-center gap-2 mt-3">' +
      '<button type="button" data-social-edit="x" class="btn btn-secondary text-xs"><i class="fa-solid fa-pen mr-2"></i>Edit</button>' +
      '<button type="button" data-social-share="x" class="btn bg-white text-[#111827] hover:bg-gray-200 text-xs"><i class="fa-brands fa-x-twitter mr-2"></i>Tweet</button>' +
      "</div></article>" +
      "</div>" +
      '<div class="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">' +
      '<span data-social-context="1">Context: loading...</span>' +
      '<span>•</span>' +
      '<span data-social-source="1">Generating...</span>' +
      "</div>" +
      "</section>";

    var linkedInInput = contentWrap.querySelector("textarea[data-social-input='linkedin']");
    var xInput = contentWrap.querySelector("textarea[data-social-input='x']");
    var linkedInEditButton = contentWrap.querySelector("button[data-social-edit='linkedin']");
    var xEditButton = contentWrap.querySelector("button[data-social-edit='x']");
    var linkedInShareButton = contentWrap.querySelector("button[data-social-share='linkedin']");
    var xShareButton = contentWrap.querySelector("button[data-social-share='x']");
    var refreshButton = contentWrap.querySelector("button[data-social-refresh='1']");
    var contextNode = contentWrap.querySelector("[data-social-context='1']");
    var sourceNode = contentWrap.querySelector("[data-social-source='1']");
    var authorNode = contentWrap.querySelector("[data-social-author='1']");

    if (authorNode) {
      authorNode.textContent = summary.user.name + " · " + (summary.user.headline || "AI Builder");
    }

    var draftState = {
      linkedin: "",
      x: "",
      contextLabel: primaryProject ? "Project: " + primaryProject.title : "Profile momentum",
    };

    function normalizeDraftText(value) {
      return String(value || "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    function shareUrl(platform, text) {
      if (platform === "linkedin") {
        return "https://www.linkedin.com/feed/?shareActive=true&text=" + encodeURIComponent(text);
      }
      return "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text);
    }

    function readDraft(platform) {
      var input = platform === "linkedin" ? linkedInInput : xInput;
      if (!input) return "";
      return normalizeDraftText(input.value);
    }

    function updateDraftInputs() {
      if (linkedInInput) linkedInInput.value = draftState.linkedin || "";
      if (xInput) xInput.value = draftState.x || "";
      if (contextNode) contextNode.textContent = "Context: " + (draftState.contextLabel || "Fresh ideas");
    }

    function setEditMode(platform, editing) {
      var input = platform === "linkedin" ? linkedInInput : xInput;
      var button = platform === "linkedin" ? linkedInEditButton : xEditButton;
      if (!input || !button) return;
      input.readOnly = !editing;
      button.setAttribute("data-editing", editing ? "1" : "0");
      button.innerHTML = editing
        ? '<i class="fa-solid fa-check mr-2"></i>Save'
        : '<i class="fa-solid fa-pen mr-2"></i>Edit';
      if (editing) {
        input.focus();
        input.selectionStart = input.value.length;
      }
    }

    function lockAllEdits() {
      setEditMode("linkedin", false);
      setEditMode("x", false);
    }

    async function loadIdeas(showToastOnSuccess) {
      try {
        var ideaStart = performance.now();
        var ideasResult = await postJson("/api/social/drafts/ideas", {
          userId: ctx.userId,
          projectId: primaryProject ? primaryProject.id : null,
        });
        var ideas = ideasResult.ideas || {};
        draftState.linkedin = normalizeDraftText(ideas.linkedin || "");
        draftState.x = normalizeDraftText(ideas.x || "");
        draftState.contextLabel = normalizeDraftText(ideas.contextLabel || draftState.contextLabel || "Fresh ideas");
        if (!draftState.linkedin || !draftState.x) {
          throw new Error("Generated ideas were empty");
        }
        updateDraftInputs();
        if (sourceNode) {
          sourceNode.textContent = ideasResult.source === "llm" ? "Personalized with user memory" : "Generated from profile context";
        }
        if (showToastOnSuccess) {
          toast(ideasResult.source === "llm" ? "Fresh social ideas ready." : "Fallback social ideas ready.", false);
        }
        writeSocialDraftCache(primaryProject ? primaryProject.id : null, {
          linkedin: draftState.linkedin,
          x: draftState.x,
          contextLabel: draftState.contextLabel,
          source: ideasResult.source === "llm" ? "llm" : "profile_context",
        });
        captureEvent("social_ideas_loaded", {
          source: ideasResult.source === "llm" ? "llm" : "profile_context",
          duration_ms: Math.round(performance.now() - ideaStart),
        });
        return;
      } catch {
        var fallbackStart = performance.now();
        var fallback = await postJson("/api/social/drafts/generate", {
          userId: ctx.userId,
          projectId: primaryProject ? primaryProject.id : null,
        });
        var drafts = fallback.drafts || [];
        var linkedInDraft = drafts.find(function (entry) {
          return entry.platform === "linkedin";
        });
        var xDraft = drafts.find(function (entry) {
          return entry.platform === "x";
        });
        draftState.linkedin = normalizeDraftText(linkedInDraft ? linkedInDraft.text : "");
        draftState.x = normalizeDraftText(xDraft ? xDraft.text : "");
        draftState.contextLabel = primaryProject ? "Project: " + primaryProject.title : "Profile momentum";
        updateDraftInputs();
        if (sourceNode) {
          sourceNode.textContent = "Generated from template drafts";
        }
        if (showToastOnSuccess) {
          toast("Drafts refreshed.", false);
        }
        writeSocialDraftCache(primaryProject ? primaryProject.id : null, {
          linkedin: draftState.linkedin,
          x: draftState.x,
          contextLabel: draftState.contextLabel,
          source: "template",
        });
        captureEvent("social_ideas_loaded", {
          source: "template",
          duration_ms: Math.round(performance.now() - fallbackStart),
        });
      }
    }

    if (linkedInEditButton) {
      linkedInEditButton.addEventListener("click", function () {
        var editing = linkedInEditButton.getAttribute("data-editing") === "1";
        if (editing) {
          draftState.linkedin = readDraft("linkedin");
          setEditMode("linkedin", false);
          captureEvent("social_draft_edited", { platform: "linkedin", draft_length: draftState.linkedin.length });
          toast("LinkedIn draft updated.", false);
          return;
        }
        setEditMode("linkedin", true);
      });
    }

    if (xEditButton) {
      xEditButton.addEventListener("click", function () {
        var editing = xEditButton.getAttribute("data-editing") === "1";
        if (editing) {
          draftState.x = readDraft("x");
          setEditMode("x", false);
          captureEvent("social_draft_edited", { platform: "x", draft_length: draftState.x.length });
          toast("Tweet draft updated.", false);
          return;
        }
        setEditMode("x", true);
      });
    }

    if (linkedInShareButton) {
      linkedInShareButton.addEventListener("click", function () {
        draftState.linkedin = readDraft("linkedin");
        if (!draftState.linkedin) {
          toast("LinkedIn draft is empty.", true);
          return;
        }
        captureEvent("social_share_clicked", { platform: "linkedin", mode: "native_composer" });
        window.open(shareUrl("linkedin", draftState.linkedin), "_blank", "noopener,noreferrer");
        toast("Opening LinkedIn share.", false);
      });
    }

    if (xShareButton) {
      xShareButton.addEventListener("click", function () {
        draftState.x = readDraft("x");
        if (!draftState.x) {
          toast("Tweet draft is empty.", true);
          return;
        }
        captureEvent("social_share_clicked", { platform: "x", mode: "native_composer" });
        window.open(shareUrl("x", draftState.x), "_blank", "noopener,noreferrer");
        toast("Opening native Tweet composer.", false);
      });
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", async function () {
        var original = refreshButton.innerHTML;
        refreshButton.disabled = true;
        refreshButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Refreshing';
        try {
          lockAllEdits();
          captureEvent("social_refresh_clicked", { project_id: primaryProject ? primaryProject.id : null });
          await loadIdeas(true);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Unable to refresh social ideas", true);
        } finally {
          refreshButton.disabled = false;
          refreshButton.innerHTML = original;
        }
      });
    }

    lockAllEdits();
    var cachedDrafts = readSocialDraftCache(primaryProject ? primaryProject.id : null);
    if (cachedDrafts) {
      draftState.linkedin = normalizeDraftText(cachedDrafts.linkedin || "");
      draftState.x = normalizeDraftText(cachedDrafts.x || "");
      draftState.contextLabel = normalizeDraftText(cachedDrafts.contextLabel || draftState.contextLabel || "Fresh ideas");
      updateDraftInputs();
      if (sourceNode) sourceNode.textContent = cachedDrafts.source === "llm" ? "Cached personalized ideas" : "Cached draft ideas";
      captureEvent("social_ideas_cache_hit", { source: cachedDrafts.source || "cached" });
      void loadIdeas(false);
    } else {
      try {
        await loadIdeas(false);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to generate social ideas", true);
      }
    }

    var params = new URLSearchParams(window.location.search);
    var oauth = params.get("oauth");
    if (oauth === "linkedin_connected") toast("LinkedIn connected.", false);
    if (oauth === "x_connected") toast("X connected.", false);
    if (oauth === "linkedin_denied" || oauth === "x_denied") toast("OAuth connection was denied.", true);
    captureEvent("social_page_hydrated", { has_project: Boolean(primaryProject) });
  }

  async function hydrateUpdatesPage() {
    captureEvent("dashboard_tab_viewed", { tab: "updates" });
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);

    var updates = summary.latestEvents || [];
    if (updates.length) {
      var firstTitle = Array.prototype.find.call(document.querySelectorAll("h4.font-medium"), function (el) {
        return (el.textContent || "").indexOf("Released") !== -1 || (el.textContent || "").indexOf("Daily Task") !== -1;
      });
      if (firstTitle) setText(firstTitle, updates[0].message || "New tutor update");
    }

    var applyButton = byText("button", "Apply to Project");
    if (applyButton) {
      applyButton.addEventListener("click", async function () {
        try {
          await postJson("/api/scheduler/news-refresh", {});
          await postJson("/api/scheduler/daily-update", {});
          toast("Update applied and daily digest queued.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Unable to apply update", true);
        }
      });
    }
  }

  async function hydrateProfilePage() {
    captureEvent("dashboard_tab_viewed", { tab: "profile" });
    var summary = await getDashboardSummary();
    updateSharedUserUi(summary);

    var profileForm = document.querySelector("form");
    var inputs = profileForm ? profileForm.querySelectorAll("input[type='text']") : [];
    var nameInput = inputs[0] || null;
    var roleInput = inputs[1] || null;
    var bioInput = profileForm ? profileForm.querySelector("textarea") : null;
    var linkedInInput = inputs[2] || null;
    var avatarUrlInput = document.getElementById("profile-avatar-url");

    if (!avatarUrlInput && profileForm) {
      var avatarField = document.createElement("div");
      avatarField.innerHTML =
        '<label class="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Avatar URL</label>' +
        '<input id="profile-avatar-url" type="url" placeholder="https://..." class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition">';
      var submitRow = profileForm.querySelector("div.pt-4.mt-4.border-t");
      if (submitRow && submitRow.parentElement) {
        profileForm.insertBefore(avatarField, submitRow);
      } else {
        profileForm.appendChild(avatarField);
      }
      avatarUrlInput = avatarField.querySelector("#profile-avatar-url");
    }

    if (nameInput) nameInput.value = summary.user.name || "";
    if (roleInput) roleInput.value = summary.user.headline || "";
    if (bioInput) bioInput.value = summary.user.bio || "";
    if (linkedInInput) linkedInInput.value = (summary.user.socialLinks && summary.user.socialLinks.linkedin) || "";
    var currentAvatarUrl = ctx.avatarUrl || summary.user.avatarUrl || "";
    function normalizeAvatarValue(input) {
      var raw = typeof input === "string" ? input.trim() : "";
      if (!raw) return undefined;
      if (raw.indexOf("data:image/") === 0) return raw;
      return normalizeUrl(raw);
    }

    function applyAvatarToUi(nextUrl) {
      if (!nextUrl) return;
      Array.prototype.forEach.call(document.querySelectorAll("img[src='/assets/avatar.png'], img[data-role='profile-avatar']"), function (img) {
        img.setAttribute("src", nextUrl);
        img.setAttribute("data-role", "profile-avatar");
      });
      if (avatarUrlInput) {
        if (nextUrl.indexOf("data:image/") === 0) {
          avatarUrlInput.value = "";
          avatarUrlInput.placeholder = "Uploaded image saved.";
        } else {
          avatarUrlInput.value = nextUrl;
        }
      }
    }

    async function saveAvatar(nextUrl) {
      var res = await fetch("/api/profile", {
        method: "PATCH",
        headers: requestHeaders(true),
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify({ avatarUrl: nextUrl }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.ok) {
        throw new Error(data && data.error && data.error.message ? data.error.message : "Avatar update failed");
      }
      ctx.avatarUrl = nextUrl;
      currentAvatarUrl = nextUrl;
      saveCtx(ctx);
      applyAvatarToUi(nextUrl);
    }
    if (avatarUrlInput) {
      if (currentAvatarUrl.indexOf("data:image/") === 0) {
        avatarUrlInput.value = "";
        avatarUrlInput.placeholder = "Uploaded image saved.";
      } else {
        avatarUrlInput.value = currentAvatarUrl;
      }
    }
    if (ctx.email) {
      var emailNode = Array.prototype.find.call(document.querySelectorAll("p.text-sm"), function (node) {
        return (node.textContent || "").indexOf("@") !== -1;
      });
      if (emailNode) emailNode.textContent = ctx.email;
    }

    var avatarElements = document.querySelectorAll("img[src='/assets/avatar.png']");
    if (currentAvatarUrl) {
      Array.prototype.forEach.call(avatarElements, function (img) {
        img.setAttribute("src", currentAvatarUrl);
        if (summary.user && summary.user.name) {
          img.setAttribute("alt", summary.user.name);
        }
      });
    }

    var publicBtn = Array.prototype.find.call(document.querySelectorAll("a"), function (node) {
      return (node.textContent || "").indexOf("View Public Profile") !== -1;
    });
    if (publicBtn) {
      setHref(publicBtn, "/u/" + summary.user.handle + "/");
    }

    var saveButton = Array.prototype.find.call(document.querySelectorAll("button"), function (node) {
      return (node.textContent || "").trim() === "Save Changes";
    });

    if (saveButton) {
      saveButton.addEventListener("click", async function () {
        try {
          var normalizedAvatar = avatarUrlInput && avatarUrlInput.value ? normalizeAvatarValue(avatarUrlInput.value) : undefined;
          var nextAvatar = normalizedAvatar || currentAvatarUrl || null;
          var payload = {
            name: nameInput ? nameInput.value.trim() : summary.user.name,
            headline: roleInput ? roleInput.value.trim() : summary.user.headline,
            bio: bioInput ? bioInput.value.trim() : summary.user.bio,
            avatarUrl: nextAvatar,
            socialLinks: {
              linkedin: linkedInInput && linkedInInput.value ? normalizeUrl(linkedInInput.value) : undefined,
            },
          };

          if (linkedInInput && linkedInInput.value && !payload.socialLinks.linkedin) {
            throw new Error("LinkedIn URL is invalid");
          }
          if (avatarUrlInput && avatarUrlInput.value && !normalizedAvatar) {
            throw new Error("Avatar URL is invalid");
          }

          var response = await fetch("/api/profile", {
            method: "PATCH",
            headers: requestHeaders(true),
            cache: "no-store",
            credentials: "same-origin",
            body: JSON.stringify(payload),
          });

          var data = await response.json().catch(function () {
            return {};
          });
          if (!response.ok || !data.ok) {
            throw new Error(data && data.error && data.error.message ? data.error.message : "Profile save failed");
          }

          if (data.profile && data.profile.handle) {
            ctx.handle = data.profile.handle;
            if (data.profile.avatarUrl) {
              ctx.avatarUrl = data.profile.avatarUrl;
              currentAvatarUrl = data.profile.avatarUrl;
            } else if (nextAvatar) {
              ctx.avatarUrl = nextAvatar;
              currentAvatarUrl = nextAvatar;
            }
            saveCtx(ctx);
            if (publicBtn) setHref(publicBtn, "/u/" + data.profile.handle + "/");
            if (avatarUrlInput && currentAvatarUrl) avatarUrlInput.value = currentAvatarUrl;
            applyAvatarToUi(currentAvatarUrl);
          }

          captureEvent("profile_saved", {
            has_linkedin: Boolean(payload.socialLinks && payload.socialLinks.linkedin),
            has_avatar: Boolean(currentAvatarUrl),
          });
          toast("Profile saved.", false);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Profile save failed", true);
        }
      });
    }

    var avatarButton = Array.prototype.find.call(document.querySelectorAll("button"), function (node) {
      return (node.textContent || "").trim() === "Change Avatar";
    });
    if (avatarButton) {
      avatarButton.addEventListener("click", async function () {
        if (document.getElementById("avatar-crop-modal")) return;

        var fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        fileInput.addEventListener("change", function () {
          var file = fileInput.files && fileInput.files[0];
          if (!file) {
            fileInput.remove();
            return;
          }

          if (!file.type || file.type.indexOf("image/") !== 0) {
            toast("Please choose an image file.", true);
            fileInput.remove();
            return;
          }

          var objectUrl = URL.createObjectURL(file);
          var backdrop = document.createElement("div");
          backdrop.className = "avatar-crop-backdrop";
          backdrop.id = "avatar-crop-backdrop";

          var modal = document.createElement("div");
          modal.className = "avatar-crop-modal";
          modal.id = "avatar-crop-modal";
          modal.innerHTML =
            '<div class="avatar-crop-header">' +
            '<h3 class="font-[Outfit] text-lg font-semibold">Crop profile image</h3>' +
            '<button type="button" class="btn btn-secondary" data-avatar-close="1">Cancel</button>' +
            "</div>" +
            '<div class="avatar-crop-stage" data-avatar-stage="1">' +
            '<img data-avatar-image="1" alt="Avatar crop preview">' +
            "</div>" +
            '<div class="avatar-crop-controls">' +
            '<label class="text-xs text-gray-500 uppercase tracking-wider">Zoom</label>' +
            '<input type="range" min="1" max="3" step="0.01" value="1.1" data-avatar-zoom="1">' +
            "</div>" +
            '<div class="avatar-crop-actions">' +
            '<button type="button" class="btn btn-secondary" data-avatar-use-url="1">Use URL</button>' +
            '<button type="button" class="btn btn-primary" data-avatar-save="1">Save Avatar</button>' +
            "</div>";

          document.body.appendChild(backdrop);
          document.body.appendChild(modal);

          var stage = modal.querySelector("[data-avatar-stage='1']");
          var image = modal.querySelector("[data-avatar-image='1']");
          var closeBtn = modal.querySelector("[data-avatar-close='1']");
          var saveBtn = modal.querySelector("[data-avatar-save='1']");
          var urlBtn = modal.querySelector("[data-avatar-use-url='1']");
          var zoomInput = modal.querySelector("[data-avatar-zoom='1']");
          if (!stage || !image || !closeBtn || !saveBtn || !zoomInput || !urlBtn) {
            backdrop.remove();
            modal.remove();
            fileInput.remove();
            URL.revokeObjectURL(objectUrl);
            return;
          }

          var dragStartX = 0;
          var dragStartY = 0;
          var startOffsetX = 0;
          var startOffsetY = 0;
          var dragging = false;
          var offsetX = 0;
          var offsetY = 0;
          var zoom = 1.1;
          var naturalW = 0;
          var naturalH = 0;

          function closeModal() {
            backdrop.remove();
            modal.remove();
            fileInput.remove();
            URL.revokeObjectURL(objectUrl);
          }

          function drawPreview() {
            if (!naturalW || !naturalH) return;
            var stageRect = stage.getBoundingClientRect();
            var baseScale = Math.max(stageRect.width / naturalW, stageRect.height / naturalH);
            var finalScale = baseScale * zoom;
            var drawW = naturalW * finalScale;
            var drawH = naturalH * finalScale;
            var maxX = Math.max(0, (drawW - stageRect.width) / 2);
            var maxY = Math.max(0, (drawH - stageRect.height) / 2);
            if (offsetX > maxX) offsetX = maxX;
            if (offsetX < -maxX) offsetX = -maxX;
            if (offsetY > maxY) offsetY = maxY;
            if (offsetY < -maxY) offsetY = -maxY;
            image.style.width = drawW + "px";
            image.style.height = drawH + "px";
            image.style.transform = "translate(calc(-50% + " + offsetX + "px), calc(-50% + " + offsetY + "px))";
          }

          image.addEventListener("load", function () {
            naturalW = image.naturalWidth || 1;
            naturalH = image.naturalHeight || 1;
            drawPreview();
          });
          image.setAttribute("src", objectUrl);

          zoomInput.addEventListener("input", function () {
            zoom = Number(zoomInput.value || "1.1");
            drawPreview();
          });

          stage.addEventListener("pointerdown", function (event) {
            dragging = true;
            dragStartX = event.clientX;
            dragStartY = event.clientY;
            startOffsetX = offsetX;
            startOffsetY = offsetY;
            stage.setPointerCapture(event.pointerId);
          });

          stage.addEventListener("pointermove", function (event) {
            if (!dragging) return;
            offsetX = startOffsetX + (event.clientX - dragStartX);
            offsetY = startOffsetY + (event.clientY - dragStartY);
            drawPreview();
          });

          stage.addEventListener("pointerup", function (event) {
            dragging = false;
            stage.releasePointerCapture(event.pointerId);
          });

          closeBtn.addEventListener("click", function () {
            closeModal();
          });

          backdrop.addEventListener("click", function () {
            closeModal();
          });

          urlBtn.addEventListener("click", async function () {
            var typed = window.prompt("Paste avatar image URL", currentAvatarUrl || "");
            if (typed === null) return;
            var normalized = normalizeAvatarValue(typed);
            if (!normalized) {
              toast("Avatar URL is invalid.", true);
              return;
            }
            try {
              await saveAvatar(normalized);
              closeModal();
              captureEvent("profile_avatar_updated", { source: "url" });
              toast("Avatar updated.", false);
            } catch (err) {
              toast(err instanceof Error ? err.message : "Avatar update failed", true);
            }
          });

          saveBtn.addEventListener("click", async function () {
            if (!naturalW || !naturalH) return;
            saveBtn.setAttribute("disabled", "true");
            try {
              var outputSize = 512;
              var canvas = document.createElement("canvas");
              canvas.width = outputSize;
              canvas.height = outputSize;
              var ctx2d = canvas.getContext("2d");
              if (!ctx2d) throw new Error("Canvas unavailable");

              var baseScale = Math.max(outputSize / naturalW, outputSize / naturalH);
              var finalScale = baseScale * zoom;
              var drawW = naturalW * finalScale;
              var drawH = naturalH * finalScale;
              var drawX = (outputSize - drawW) / 2 + offsetX;
              var drawY = (outputSize - drawH) / 2 + offsetY;

              ctx2d.fillStyle = "#e2e8f0";
              ctx2d.fillRect(0, 0, outputSize, outputSize);
              ctx2d.drawImage(image, drawX, drawY, drawW, drawH);

              var dataUrl = canvas.toDataURL("image/jpeg", 0.9);
              await saveAvatar(dataUrl);
              closeModal();
              captureEvent("profile_avatar_updated", { source: "upload_crop" });
              toast("Avatar updated.", false);
            } catch (err) {
              saveBtn.removeAttribute("disabled");
              toast(err instanceof Error ? err.message : "Avatar update failed", true);
            }
          });
        });

        fileInput.click();
      });
    }
  }

  function buildTalentCardHtml(candidate) {
    var skills = (candidate.topSkills || []).slice(0, 2);
    var tools = (candidate.topTools || []).slice(0, 3);
    var projectCount = Math.max(1, Math.round((candidate.evidenceScore || 45) / 30));

    return (
      '<a href="/employers/talent/' +
      candidate.handle +
      '/" class="glass p-6 rounded-2xl hover:bg-white/5 transition border border-white/10 hover:border-emerald-500/40 group relative cursor-pointer">' +
      '<div class="flex justify-between items-start mb-4">' +
      '<img src="' +
      (candidate.avatarUrl || "/assets/avatar.png") +
      '" width="64" height="64" style="width:64px;height:64px;object-fit:cover;" class="w-16 h-16 rounded-full object-cover border border-white/20" alt="' +
      candidate.name +
      '">' +
      '<div class="bg-emerald-500/20 text-emerald-400 w-8 h-8 rounded-full flex items-center justify-center border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]" title="Verified Human Builder"><i class="fa-solid fa-check text-sm font-bold"></i></div>' +
      "</div>" +
      '<h3 class="text-lg font-medium text-white group-hover:text-emerald-400 transition mb-1">' +
      candidate.name +
      "</h3>" +
      '<p class="text-gray-400 text-sm mb-4">' +
      candidate.role +
      "</p>" +
      '<div class="space-y-2 mb-6">' +
      '<div class="flex items-center gap-2 text-xs"><i class="fa-solid fa-diagram-project text-gray-500 w-4"></i><span class="text-gray-300">' +
      projectCount +
      " Verified Projects built</span></div>" +
      '<div class="flex items-center gap-2 text-xs"><i class="fa-solid fa-code text-gray-500 w-4"></i><span class="text-gray-300">' +
      tools.join(", ") +
      "</span></div>" +
      "</div>" +
      '<div class="flex flex-wrap gap-2 mt-auto border-t border-white/10 pt-4">' +
      skills
        .map(function (skill) {
          return '<span class="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded px-2 py-0.5">' + skill + "</span>";
        })
        .join("") +
      "</div></a>"
    );
  }

  async function hydrateEmployerTalentPage() {
    captureEvent("employer_talent_viewed", { source: "page_load" });
    var header = document.querySelector("h2.text-xl.font-\\[Outfit\\].text-white");
    var grid = document.querySelector(".grid.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6");
    var search = document.querySelector("header input[type='text']");

    if (!grid) return;

    var selectedSkill = null;
    var selectedStatus = "";

    var skillSection = Array.prototype.find.call(document.querySelectorAll("aside .mb-6"), function (node) {
      return (node.textContent || "").indexOf("Filter by Skill") !== -1;
    });

    async function loadRows() {
      if (!grid.dataset.initialized) {
        grid.dataset.initialized = "1";
        grid.innerHTML =
          '<div class="glass p-6 rounded-2xl border border-white/10 text-gray-400">Loading talent profiles...</div>';
      }
      var params = new URLSearchParams();
      if (selectedSkill) params.set("skill", selectedSkill);
      if (selectedStatus) params.set("status", selectedStatus);
      if (search && search.value.trim()) params.set("q", search.value.trim());

      var data = await getJson("/api/employers/talent" + (params.toString() ? "?" + params.toString() : ""));
      var rows = data.rows || [];
      var facets = data.facets || {};
      var isDefaultView = !selectedSkill && !selectedStatus && !(search && search.value.trim());
      if (isDefaultView) {
        rows = rows
          .filter(function (candidate) {
            return /^candidate-\d{3}$/i.test(candidate.handle || "");
          })
          .slice(0, 20);
      }

      if (header) {
        header.textContent = rows.length + " Candidates Match Criteria";
      }
      captureEvent("employer_talent_loaded", {
        result_count: rows.length,
        has_search: Boolean(search && search.value.trim()),
        selected_skill: selectedSkill || "",
        selected_status: selectedStatus || "",
      });

      if (skillSection && facets.skills && facets.skills.length) {
        var list = skillSection.querySelector(".space-y-2");
        if (list && !list.dataset.hydrated) {
          list.dataset.hydrated = "1";
          list.innerHTML = "";
          facets.skills.slice(0, 8).forEach(function (skill, index) {
            var id = "skill-filter-" + index;
            var label = document.createElement("label");
            label.className = "flex items-center gap-3 text-gray-300 hover:text-white cursor-pointer group";
            label.innerHTML =
              '<input id="' +
              id +
              '" type="checkbox" class="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500">' +
              '<span class="group-hover:underline"></span>';
            setText(label.querySelector("span"), skill);
            var checkbox = label.querySelector("input");
            checkbox.checked = false;
            checkbox.addEventListener("change", function () {
              selectedSkill = checkbox.checked ? skill : null;
              Array.prototype.forEach.call(list.querySelectorAll("input[type='checkbox']"), function (node) {
                if (node !== checkbox) node.checked = false;
              });
              captureEvent("employer_filter_changed", { filter_type: "skill", skill: selectedSkill || "" });
              void loadRows();
            });
            list.appendChild(label);
          });
        }
      }

      grid.innerHTML = "";
      if (!rows.length) {
        var empty = document.createElement("div");
        empty.className = "glass p-6 rounded-2xl border border-white/10 text-gray-400";
        empty.textContent = "No candidates matched the current filters.";
        grid.appendChild(empty);
        return;
      }

      rows.forEach(function (candidate) {
        var wrapper = document.createElement("div");
        wrapper.innerHTML = buildTalentCardHtml(candidate);
        var card = wrapper.firstElementChild;
        if (card) grid.appendChild(card);
      });
    }

    var radios = document.querySelectorAll("input[type='radio'][name='level']");
    var allCandidatesRadio = Array.prototype.find.call(radios, function (radio) {
      var label = radio.closest("label");
      var text = label ? (label.textContent || "").toLowerCase() : "";
      return text.indexOf("all") !== -1;
    });
    if (allCandidatesRadio) {
      allCandidatesRadio.checked = true;
      selectedStatus = "";
    } else if (radios.length > 1) {
      radios[1].checked = true;
      selectedStatus = "";
    }
    Array.prototype.forEach.call(radios, function (radio, index) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        selectedStatus = index === 0 ? "verified" : "";
        captureEvent("employer_filter_changed", { filter_type: "status", status: selectedStatus || "all" });
        void loadRows();
      });
    });

    if (search) {
      var timeout = null;
      search.addEventListener("input", function () {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(function () {
          captureEvent("employer_filter_changed", { filter_type: "search", query_length: search.value.trim().length });
          void loadRows();
        }, 220);
      });
    }

    await loadRows();
  }

  if (currentPath === "/onboarding" && !document.getElementById("onboarding-react-root")) {
    var selectedResumeFilename = null;
    var uploadLabel = byText("p", "Upload Resume (PDF)");
    var uploadCard = uploadLabel ? uploadLabel.closest("div.border-2") : null;
    var careerPathSelect = document.getElementById("onboarding-career-path");
    var linkedinInput = document.getElementById("onboarding-linkedin-url");
    var situationSelect = document.getElementById("onboarding-situation");
    var beginButton = document.getElementById("onboarding-start-assessment");
    var scoreButtons = document.querySelectorAll("button.onboarding-score");
    var chosenScore = Number((ctx && ctx.aiKnowledgeScore) || 3);
    var signUpIntent = readSignUpIntent();

    captureEvent("onboarding_viewed", {
      entry_point: signUpIntent ? "clerk_sign_up" : "direct",
      has_existing_session: Boolean(ctx.sessionId),
      career_path_id: ctx.careerPathId || "product-management",
    });
    trackFunnelStep("onboarding_viewed", {
      entry_point: signUpIntent ? "clerk_sign_up" : "direct",
      has_existing_session: Boolean(ctx.sessionId),
      career_path_id: ctx.careerPathId || "product-management",
    });

    function applySelectedScore() {
      Array.prototype.forEach.call(scoreButtons, function (button) {
        var score = Number(button.getAttribute("data-ai-score") || "3");
        if (score === chosenScore) {
          button.classList.add("bg-emerald-500", "border-emerald-500/50", "text-white");
        } else {
          button.classList.remove("bg-emerald-500", "border-emerald-500/50", "text-white");
        }
      });
    }

    Array.prototype.forEach.call(scoreButtons, function (button) {
      button.addEventListener("click", function () {
        chosenScore = Number(button.getAttribute("data-ai-score") || "3");
        applySelectedScore();
        captureEvent("onboarding_ai_knowledge_selected", { ai_knowledge_score: chosenScore });
      });
    });
    applySelectedScore();

    if (uploadCard) {
      var uploader = document.createElement("input");
      uploader.type = "file";
      uploader.accept = ".pdf";
      uploader.style.display = "none";
      document.body.appendChild(uploader);

      uploadCard.addEventListener("click", function () {
        uploader.click();
      });

      uploader.addEventListener("change", async function () {
        var file = uploader.files && uploader.files[0];
        if (!file) return;
        selectedResumeFilename = file.name;
        var dot = file.name.lastIndexOf(".");
        var extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "unknown";
        captureEvent("onboarding_resume_selected", { resume_attached: true, resume_extension: extension });
        var subtitle = uploadCard.querySelector("p.text-xs");
        if (subtitle) subtitle.textContent = "Selected: " + file.name;
      });
    }

    ensureSession()
      .then(function (bootstrap) {
        var options = (bootstrap && bootstrap.onboardingOptions) || [];
        if (!careerPathSelect) return;
        careerPathSelect.innerHTML = "";
        if (!options.length) {
          options = [{ id: ctx.careerPathId || "product-management", name: "Product Management" }];
        }
        options.forEach(function (option) {
          var item = document.createElement("option");
          item.value = option.id;
          item.textContent = option.name;
          if (option.id === (ctx.careerPathId || "product-management")) item.selected = true;
          careerPathSelect.appendChild(item);
        });

        if (linkedinInput && ctx.linkedinUrl) {
          linkedinInput.value = ctx.linkedinUrl;
        }
      })
      .catch(function (err) {
        toast(err instanceof Error ? err.message : "Unable to initialize onboarding", true);
      });

    if (beginButton) {
      beginButton.addEventListener("click", async function () {
        if (beginButton.dataset.busy === "1") return;
        beginButton.dataset.busy = "1";
        beginButton.setAttribute("disabled", "true");
        try {
          var goals = Array.prototype.map.call(
            document.querySelectorAll('input[name="onboarding-goal"]:checked'),
            function (node) {
              return node.value;
            },
          );
          if (!goals.length) {
            toast("Select at least one goal.", true);
            return;
          }
          var selectedCareerPath = careerPathSelect && careerPathSelect.value ? careerPathSelect.value : "product-management";
          captureEvent("onboarding_start_assessment_clicked", {
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });
          trackFunnelStep("onboarding_start_assessment_clicked", {
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });

          var selectedSituation = situationSelect && situationSelect.value ? situationSelect.value : "employed";
          var selectedLinkedIn = linkedinInput && linkedinInput.value ? linkedinInput.value.trim() : "";
          ctx.careerPathId = selectedCareerPath;
          ctx.situation = selectedSituation;
          ctx.aiKnowledgeScore = chosenScore;
          ctx.onboardingGoals = goals;
          if (selectedLinkedIn) ctx.linkedinUrl = selectedLinkedIn;
          saveCtx(ctx);

          var session = await ensureSession();
          await postJson("/api/onboarding/career-import", {
            sessionId: session.id,
            careerPathId: selectedCareerPath,
            linkedinUrl: selectedLinkedIn || null,
            resumeFilename: selectedResumeFilename,
          });
          captureEvent("onboarding_career_import_completed", {
            session_id: session.id,
            career_path_id: selectedCareerPath,
            has_linkedin_url: Boolean(selectedLinkedIn),
            resume_attached: Boolean(selectedResumeFilename),
            ai_knowledge_score: chosenScore,
          });
          trackFunnelStep("onboarding_career_import_completed", {
            session_id: session.id,
            career_path_id: selectedCareerPath,
            has_linkedin_url: Boolean(selectedLinkedIn),
            resume_attached: Boolean(selectedResumeFilename),
            resume_extension: selectedResumeFilename && selectedResumeFilename.indexOf(".") >= 0
              ? selectedResumeFilename.split(".").pop().toLowerCase()
              : null,
            ai_knowledge_score: chosenScore,
          });

          await postJson("/api/onboarding/situation", {
            sessionId: session.id,
            situation: selectedSituation,
            goals: goals,
          });
          captureEvent("onboarding_situation_completed", {
            session_id: session.id,
            situation: selectedSituation,
            selected_goals_count: goals.length,
            selected_goals: goals,
          });
          trackFunnelStep("onboarding_situation_completed", {
            session_id: session.id,
            situation: selectedSituation,
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });
          captureEvent("onboarding_completed", {
            session_id: session.id,
            situation: selectedSituation,
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });
          captureEvent("onboarding_assessment_redirected", { session_id: session.id });
          trackFunnelStep("onboarding_completed", {
            session_id: session.id,
            situation: selectedSituation,
            selected_goals_count: goals.length,
            selected_goals: goals,
            career_path_id: selectedCareerPath,
          });

          toast("Onboarding saved. Continue to assessment.", false);
          window.location.href = "/assessment/?sessionId=" + encodeURIComponent(session.id);
        } catch (err) {
          captureEvent("onboarding_submission_failed", {
            reason: err && err.message ? err.message : "unknown_error",
          });
          toast(err instanceof Error ? err.message : "Failed to complete onboarding", true);
        } finally {
          beginButton.dataset.busy = "0";
          beginButton.removeAttribute("disabled");
        }
      });
    }
  }

  if (currentPath === "/assessment") {
    captureEvent("assessment_viewed", {
      has_existing_session: Boolean(ctx.sessionId),
      entry_point: ctx && ctx.sessionId ? "onboarding" : "direct",
      career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
    });
    trackFunnelStep("assessment_viewed", {
      has_existing_session: Boolean(ctx.sessionId),
      entry_point: ctx && ctx.sessionId ? "onboarding" : "direct",
      career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
    });

    var assessmentCard = document.querySelector(".glass-panel");

    var continueLink = assessmentCard
      ? assessmentCard.querySelector(".flex.justify-between.items-center.pt-6 a.btn.btn-primary, .flex.justify-between.items-center.pt-6 a[href*='/onboarding']")
      : null;
    if (!continueLink) {
      continueLink = Array.prototype.find.call(document.querySelectorAll(".glass-panel a.btn.btn-primary"), function (node) {
        return ((node.textContent || "").toLowerCase().indexOf("continue") !== -1);
      });
    }
    if (continueLink) {
      continueLink.addEventListener("click", async function (event) {
        event.preventDefault();
        captureEvent("assessment_continue_clicked", {
          source: "assessment_page",
          career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
        });
        trackFunnelStep("assessment_continue_clicked", {
          source: "assessment_page",
          career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
        });
        try {
          var session = await ensureSession();
          var start = await postJson("/api/assessment/start", { sessionId: session.id });
          captureEvent("assessment_started", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          trackFunnelStep("assessment_started", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          var checked = document.querySelector('input[name="goal"]:checked');
          var selectedValue = 3;
          var selectedGoal = "learn_foundations";
          if (checked) {
            var label = checked.closest("label");
            var text = label ? (label.textContent || "").toLowerCase() : "";
            if (text.indexOf("automate") !== -1) {
              selectedValue = 5;
              selectedGoal = "ship_ai_projects";
            }
            if (text.indexOf("showcase") !== -1 || text.indexOf("job") !== -1) {
              selectedValue = 4;
              selectedGoal = "showcase_for_job";
            }
          }

          await postJson("/api/assessment/submit", {
            assessmentId: start.assessment.id,
            answers: [{ questionId: "primary_goal", value: selectedValue }],
          });
          captureEvent("assessment_submitted", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            primary_goal: selectedGoal,
            primary_goal_value: selectedValue,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          trackFunnelStep("assessment_submitted", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            primary_goal: selectedGoal,
            primary_goal_value: selectedValue,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });

          var validGoalSet = {
            build_business: true,
            upskill_current_job: true,
            showcase_for_job: true,
            ship_ai_projects: true,
            learn_foundations: true,
          };
          var selectedGoals = Array.isArray(ctx.onboardingGoals)
            ? ctx.onboardingGoals.filter(function (entry) { return Boolean(validGoalSet[entry]); })
            : [];
          if (!selectedGoals.length) {
            selectedGoals = [selectedGoal];
          }
          var selectedSituation = typeof ctx.situation === "string" ? ctx.situation : "employed";

          await postJson("/api/onboarding/situation", {
            sessionId: session.id,
            situation: selectedSituation,
            goals: selectedGoals,
          });
          captureEvent("assessment_completed", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            situation: selectedSituation,
            selected_goals_count: selectedGoals.length,
            selected_goals: selectedGoals,
            primary_goal: selectedGoal,
            primary_goal_value: selectedValue,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          trackFunnelStep("assessment_completed", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            selected_goals_count: selectedGoals.length,
            selected_goals: selectedGoals,
            situation: selectedSituation,
            primary_goal: selectedGoal,
            primary_goal_value: selectedValue,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          captureEvent("assessment_dashboard_redirected", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            situation: selectedSituation,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });
          trackFunnelStep("assessment_dashboard_redirected", {
            session_id: session.id,
            assessment_id: start.assessment.id,
            situation: selectedSituation,
            career_path_id: ctx && ctx.careerPathId ? ctx.careerPathId : "product-management",
          });

          toast("Assessment submitted.", false);
          window.location.href = "/dashboard/?welcome=1";
        } catch (err) {
          if (isUnauthenticatedError(err)) {
            captureEvent("assessment_failed_auth_required", {
              reason: err && err.message ? err.message : "auth_required",
            });
            redirectToSignIn("/assessment/");
            return;
          }
          captureEvent("assessment_failed", {
            reason: err && err.message ? err.message : "unknown_error",
          });
          toast(err instanceof Error ? err.message : "Assessment failed", true);
        }
      });
    }
  }

  async function hydrateCurrentPath() {
    captureEvent("app_route_hydrate_started", { path: currentPath });
    if (currentPath === "/dashboard") {
      await hydrateDashboardHome();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/projects") {
      await hydrateProjectsPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/chat") {
      await hydrateChatPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/social") {
      await hydrateSocialPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/updates") {
      await hydrateUpdatesPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/dashboard/profile") {
      await hydrateProfilePage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
      return;
    }

    if (currentPath === "/employers/talent") {
      await hydrateEmployerTalentPage();
      captureEvent("app_route_hydrate_completed", { path: currentPath });
    }
  }

  async function boot() {
    captureEvent("app_boot_started", { path: currentPath });
    try {
      maybeTrackAuthEntryEvents();
      wireThemeToggle();
      await trySyncLandingAuth();
      await syncOptionalAuthUi();

      if (isDashboardPath && !restoredDashboardSnapshot) {
        // Reveal immediately with skeletons, then progressively hydrate.
        document.documentElement.setAttribute("data-runtime-ready", "1");
      } else if (restoredDashboardSnapshot) {
        document.documentElement.setAttribute("data-runtime-ready", "1");
      }

      try {
        await syncAuthContext();
      } catch (err) {
        if (needsAuth()) {
          toast(err instanceof Error ? err.message : "Authentication required", true);
        }
      }

      try {
        await maybeClaimOnboardingSession();
      } catch {
        // Non-blocking; dashboard can continue loading.
      }

      maybeTrackDashboardWelcomeStep();
      ensureMobileDashboardNav();
      await hydrateCurrentPath();
      captureEvent("app_boot_completed", { path: currentPath });
    } finally {
      if (!hasAppliedAuthCtx && !needsAuth()) {
        applyCtxImmediately();
      }
      clearDashboardSkeletons();
      persistDashboardSnapshot(currentPath);
      document.documentElement.setAttribute("data-runtime-ready", "1");
    }
  }

  void boot();
})();
