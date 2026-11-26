import React from "react";
import { ImageResponse } from "next/og";
import { getCareerMapLine, getCareerMapTitle, type CareerMap } from "@aitutor/shared";
import { BRAND_NAME } from "@/lib/site";

/**
 * Share image for a career map (used by GET /api/og/map/[token]): 1200x630 PNG
 * with the old title on a grey station, the green route and the new title, in
 * the remap look. Maps that are not completed get the plain brand card.
 */

export const CAREER_MAP_OG_SIZE = { width: 1200, height: 630 };

const INK = "#0F172A";
const MUTED = "#475569";
const FAINT = "#64748B";
const OLD = "#7C8794";
const GREEN = "#10B981";
const GREEN_DEEP = "#047857";
const GROUND = "#F6F8F7";
const HAIRLINE = "#E2E8E5";

export type OgFont = { name: string; data: ArrayBuffer; weight: 500 | 600 | 700; style: "normal" };

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();

/**
 * Loads a static TTF from Google Fonts (without a browser user agent the CSS
 * API serves truetype, which satori reads). Cached per instance; on any
 * failure the image falls back to the built-in font instead of failing.
 */
function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`;
  const existing = fontCache.get(key);
  if (existing) return existing;
  const pending = (async () => {
    try {
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
      const css = await fetch(cssUrl, { signal: AbortSignal.timeout(2500) }).then((res) => (res.ok ? res.text() : ""));
      const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/);
      if (!match) return null;
      const res = await fetch(match[1], { signal: AbortSignal.timeout(2500) });
      return res.ok ? await res.arrayBuffer() : null;
    } catch {
      return null;
    }
  })();
  fontCache.set(key, pending);
  void pending.then((data) => {
    if (!data) fontCache.delete(key);
  });
  return pending;
}

export async function loadCareerMapOgFonts(): Promise<OgFont[]> {
  const specs: Array<{ family: string; weight: 500 | 600 | 700 }> = [
    { family: "Outfit", weight: 600 },
    { family: "Outfit", weight: 700 },
    { family: "Inter", weight: 600 },
  ];
  const loaded = await Promise.all(specs.map((spec) => loadGoogleFont(spec.family, spec.weight)));
  return specs.flatMap((spec, index) => {
    const data = loaded[index];
    return data ? [{ name: spec.family, data, weight: spec.weight, style: "normal" as const }] : [];
  });
}

function titleSize(text: string) {
  if (text.length > 30) return 64;
  if (text.length > 22) return 76;
  return 88;
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", width: 30, height: 30, borderRadius: 15, background: GREEN }} />
      <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 30, letterSpacing: -0.6, color: INK }}>{BRAND_NAME}</div>
    </div>
  );
}

/** The element tree for a completed map, or null when the primary title is not in the catalog. */
export function careerMapOgElement(map: CareerMap): React.ReactElement | null {
  const primary = getCareerMapTitle(map.primary.titleId);
  if (!primary) return null;
  const line = getCareerMapLine(primary.line);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: GROUND, fontFamily: "Inter", padding: "56px 72px 52px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand />
        <div style={{ display: "flex", fontWeight: 600, fontSize: 24, color: MUTED }}>Career map</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", flexShrink: 0, width: 34, height: 34, borderRadius: 17, background: "#FFFFFF", border: `8px solid ${OLD}` }} />
          <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 600, fontSize: 40, color: FAINT, letterSpacing: -0.5 }}>{map.person.previousTitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "stretch", height: 92, paddingLeft: 12 }}>
          <div style={{ display: "flex", width: 10, background: GREEN, borderRadius: 5 }} />
          <div style={{ display: "flex", alignItems: "center", paddingLeft: 38, fontWeight: 600, fontSize: 24, color: GREEN_DEEP }}>Your route</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", flexShrink: 0, width: 34, height: 34, borderRadius: 17, background: GREEN }} />
          <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: titleSize(primary.title), lineHeight: 1.02, color: INK, letterSpacing: -2 }}>{primary.title}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, borderTop: `2px solid ${HAIRLINE}`, paddingTop: 26 }}>
        <div style={{ display: "flex", background: OLD, color: "#FFFFFF", fontWeight: 600, fontSize: 22, borderRadius: 10, padding: "8px 16px" }}>{map.person.previousField}</div>
        <div style={{ display: "flex", height: 6, width: 56, background: GREEN, borderRadius: 3 }} />
        <div style={{ display: "flex", background: GREEN_DEEP, color: "#FFFFFF", fontWeight: 600, fontSize: 22, borderRadius: 10, padding: "8px 16px" }}>{`${line.label} line`}</div>
        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: MUTED }}>myaiskilltutor.com/map</div>
      </div>
    </div>
  );
}

export function genericCareerMapOgElement(): React.ReactElement {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: GROUND, padding: "64px 72px", fontFamily: "Inter" }}>
      <Brand />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 84, lineHeight: 1.02, letterSpacing: -2.5, color: INK }}>Find your new job title for the AI era</div>
        <div style={{ display: "flex", fontSize: 30, color: MUTED }}>A free career map drawn from your résumé.</div>
      </div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, background: GREEN, width: 360 }} />
    </div>
  );
}

/** Renders the PNG for a map (or the generic card when `map` is null or unusable). */
export async function renderCareerMapOgImage(map: CareerMap | null): Promise<ImageResponse> {
  const fonts = await loadCareerMapOgFonts();
  const element = map ? careerMapOgElement(map) : null;
  return new ImageResponse(element ?? genericCareerMapOgElement(), {
    ...CAREER_MAP_OG_SIZE,
    fonts: fonts.length ? fonts : undefined,
    headers: { "cache-control": element ? "public, max-age=3600, s-maxage=86400" : "public, max-age=300" },
  });
}
