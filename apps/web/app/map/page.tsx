import React from "react";
import type { Metadata } from "next";
import { CAREER_MAP_TITLES } from "@aitutor/shared";
import { CareerMapInput } from "@/components/career-map/career-map-input";
import { RemapSiteFooter, RemapSiteHeader } from "@/components/remap/site-chrome";
import { getAuthSeed } from "@/lib/auth";
import { BRAND_NAME, getSiteUrl } from "@/lib/site";
import styles from "@/components/career-map/career-map.module.css";

export const dynamic = "force-dynamic";

const TITLE = `Map your career: find your new job title for the AI era | ${BRAND_NAME}`;
const DESCRIPTION =
  "Paste your résumé, upload it, or describe your last job. We map what you did to the AI-era title it fits, with every skill backed by a line you wrote. Free, no account needed.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${getSiteUrl()}/map` },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: `${getSiteUrl()}/map`, siteName: BRAND_NAME },
};

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function CareerMapInputPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const seed = await getAuthSeed().catch(() => null);
  const from = first(params.from);
  const startWithUpload = first(params.upload) === "1";

  return (
    <div className={`rm ${styles.pageRoot}`}>
      <RemapSiteHeader signedIn={Boolean(seed?.userId)} hidePrimaryAction />
      <main>
        <section className={`rm-container ${styles.inputSection}`} aria-labelledby="career-map-input-title">
          <div className={styles.inputIntro}>
            <p className="rm-kicker">Career map · free</p>
            <h1 id="career-map-input-title" className={`rm-h1 ${styles.inputH1}`}>
              What did you do before?
            </h1>
            <p className="rm-lede">
              We read what you actually did, line by line, and map it to the AI-era job it fits. Your old title doesn&apos;t decide it; your work does.
            </p>
          </div>
          <div className={styles.inputPanel}>
            <CareerMapInput from={from} startWithUpload={startWithUpload} />
          </div>
          <div className={styles.inputSteps}>
            <ol className={styles.steps} aria-label="What you get">
              <li className={styles.step}>
                <span className={styles.stepDot} aria-hidden="true" />
                <span>
                  <span className={styles.stepTitle}>One new title</span>
                  The best fit from {CAREER_MAP_TITLES.length} AI-era titles, plus two alternates.
                </span>
              </li>
              <li className={styles.step}>
                <span className={`${styles.stepDot} ${styles.stepDotNew}`} aria-hidden="true" />
                <span>
                  <span className={styles.stepTitle}>Every skill, with the line behind it</span>
                  Each translation quotes your own words, so you can check the reasoning.
                </span>
              </li>
              <li className={styles.step}>
                <span className={`${styles.stepDot} ${styles.stepDotArrived}`} aria-hidden="true" />
                <span>
                  <span className={styles.stepTitle}>The gaps and what to build first</span>
                  A three-part proof plan, and a link to your map you can keep and share.
                </span>
              </li>
            </ol>
          </div>
        </section>
      </main>
      <RemapSiteFooter />
    </div>
  );
}
