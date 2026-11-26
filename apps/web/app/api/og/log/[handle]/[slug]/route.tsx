import React from "react";
import { ImageResponse } from "next/og";
import { jsonError } from "@aitutor/shared";
import { runtimeFindUserByHandle } from "@/lib/runtime";
import { findPublishedBuildLogPost } from "@/lib/build-log/store";
import { getAuthorNewTitle } from "@/lib/build-log/context";
import { isValidBuildLogSlug } from "@/lib/build-log/slug";
import { formatBuildLogLongDate } from "@/lib/build-log/format";
import { BRAND_NAME } from "@/lib/site";

/** 1200x630 share image for a public build log post. Only for published posts on published profiles. */

const WIDTH = 1200;
const HEIGHT = 630;

function clip(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export async function GET(_req: Request, context: { params: Promise<{ handle: string; slug: string }> }) {
  try {
    const { handle: rawHandle, slug: rawSlug } = await context.params;
    const handle = decodeURIComponent(rawHandle).trim();
    const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
    if (!handle || !isValidBuildLogSlug(slug)) return jsonError("BUILD_LOG_POST_NOT_FOUND", "Post not found", 404);

    const profile = await runtimeFindUserByHandle(handle);
    if (!profile || !profile.published) return jsonError("BUILD_LOG_POST_NOT_FOUND", "Post not found", 404);
    const post = await findPublishedBuildLogPost({ learnerProfileId: profile.id, slug });
    if (!post) return jsonError("BUILD_LOG_POST_NOT_FOUND", "Post not found", 404);
    const newTitle = await getAuthorNewTitle(profile.id);

    const title = clip(post.title, 110);
    const titleSize = title.length > 70 ? 54 : title.length > 40 ? 64 : 76;
    const byline = [profile.name, newTitle].filter(Boolean).join(" · ");
    const date = formatBuildLogLongDate(post.publishedAt);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#F6F8F7",
            color: "#0F172A",
            padding: "64px 72px",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, border: "6px solid #10B981", background: "#FFFFFF" }} />
            <div style={{ display: "flex", width: 72, height: 8, borderRadius: 4, background: "#10B981" }} />
            <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, background: "#10B981" }} />
            <div style={{ display: "flex", marginLeft: 12, fontSize: 28, fontWeight: 600, color: "#047857" }}>Build log</div>
          </div>
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1040 }}>
            {title}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 600 }}>{clip(byline, 70)}</div>
              {date ? <div style={{ display: "flex", fontSize: 24, color: "#475569" }}>{date}</div> : null}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: "#475569" }}>{BRAND_NAME}</div>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        headers: { "cache-control": "public, max-age=300, s-maxage=300" },
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    return jsonError("BUILD_LOG_OG_FAILED", "Could not render the image", 500, { reason: reason.slice(0, 200) });
  }
}
