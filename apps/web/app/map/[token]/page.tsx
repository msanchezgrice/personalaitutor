import React, { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CAREER_MAP_COOKIE_NAME, getCareerMapTitle, type CareerMapRecord } from "@aitutor/shared";
import { CareerMapFailedState, CareerMapGeneratingState, CareerMapResult } from "@/components/career-map/career-map-result";
import { getAuthSeed } from "@/lib/auth";
import { findCareerMapByToken } from "@/lib/career-map/store";
import { BRAND_NAME, getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;

/** One store read per request, shared by generateMetadata and the page. */
const loadCareerMap = cache(async (rawToken: string): Promise<CareerMapRecord | null> => {
  let token: string;
  try {
    token = decodeURIComponent(rawToken).trim();
  } catch {
    return null;
  }
  if (!TOKEN_PATTERN.test(token)) return null;
  return findCareerMapByToken(token);
});

const NOINDEX = { index: false, follow: false } as const;

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const record = await loadCareerMap(token).catch(() => null);
  if (!record) {
    return { title: `Career map not found | ${BRAND_NAME}`, robots: NOINDEX };
  }
  const primary = record.status === "completed" && record.map ? getCareerMapTitle(record.map.primary.titleId) : null;
  if (!record.map || !primary) {
    return { title: `Your career map | ${BRAND_NAME}`, robots: NOINDEX };
  }

  const title = `${record.map.person.previousTitle} → ${primary.title} | ${BRAND_NAME}`;
  const description = record.map.primary.summary;
  const pageUrl = `${getSiteUrl()}/map/${encodeURIComponent(record.token)}`;
  const image = {
    url: `${getSiteUrl()}/api/og/map/${encodeURIComponent(record.token)}`,
    width: 1200,
    height: 630,
    alt: `Career route from ${record.map.person.previousTitle} to ${primary.title}`,
  };
  return {
    title,
    description,
    robots: NOINDEX,
    alternates: { canonical: pageUrl },
    openGraph: { type: "website", title, description, url: pageUrl, siteName: BRAND_NAME, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

async function readOwnerCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(CAREER_MAP_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

export default async function CareerMapPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await loadCareerMap(token);
  if (!record) notFound();

  if (record.status === "generating") return <CareerMapGeneratingState />;
  if (record.status === "failed" || !record.map) return <CareerMapFailedState reason={record.failureReason} />;

  const [seed, ownerToken] = await Promise.all([getAuthSeed().catch(() => null), readOwnerCookie()]);
  const signedIn = Boolean(seed?.userId);

  return (
    <CareerMapResult
      mapId={record.id}
      token={record.token}
      map={record.map}
      source={record.source}
      hasEmail={Boolean(record.email)}
      signedIn={signedIn}
      viewer={ownerToken === record.token ? "owner" : "visitor"}
      shareUrl={`${getSiteUrl()}/map/${encodeURIComponent(record.token)}`}
    />
  );
}
