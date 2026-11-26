import React, { type ReactNode } from "react";
import { RouteStrip, TranslationList } from "@/components/remap/translation-list";
import { SiteCopyButton } from "@/components/proof/site-copy-button";
import { BRAND_NAME } from "@/lib/site";
import styles from "./site-page.module.css";

/**
 * The public proof page at /u/{handle} (design: Proof.dc.html). Pure server
 * component: data comes in already assembled, the voice model and build log
 * sections come in as rendered nodes (owned by other workstreams).
 *
 * Section order is the spec: slim top bar, hero, route strip + translations,
 * "Things I built", voice model, build log, footer with the contact address.
 */

export type ProofSiteBuiltStep = { label: string; href?: string | null; highlight?: boolean };

export type ProofSiteBuiltItem = {
  title: string;
  description: string;
  href: string | null;
  steps: ProofSiteBuiltStep[];
  /** Draw the steps as a flow (connected by green lines) instead of a list of links. */
  flow?: boolean;
};

export type ProofSitePageData = {
  handle: string;
  name: string;
  newTitle: string;
  previousRole: string | null;
  tagline: string;
  bio: string;
  translations: Array<{ before: string; now: string }>;
  contactEmail: string | null;
  linkedinUrl: string | null;
  built: ProofSiteBuiltItem[];
};

export type ProofSitePageVariant = "public" | "preview" | "example";

export function initialsFor(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => /[\p{L}\p{N}]/u.test(part));
  if (!parts.length) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

/** "Senior Marketing Manager at Kiteborne Games, 2018 to 2025" -> "Senior Marketing Manager". */
export function routeFromTitle(previousRole: string | null): string | null {
  const value = previousRole?.trim();
  if (!value) return null;
  const head = value.split(/\s+(?:at|@)\s+|,\s+|\s+[|·–—]\s+/i)[0]?.trim();
  return head || value;
}

function endWithPeriod(text: string) {
  const value = text.trim();
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function BuiltSteps({ item }: { item: ProofSiteBuiltItem }) {
  if (!item.steps.length) return null;
  return (
    <ul className={styles.flow} aria-label={item.flow ? "How it works" : "What it produced"}>
      {item.steps.map((step, index) => {
        const className = `${styles.flowStep} ${step.highlight ? styles.flowStepNew : ""}`.trim();
        return (
          <li key={`${step.label}-${index}`} className={styles.flowItem}>
            {item.flow && index > 0 ? <span className={styles.flowLine} aria-hidden="true" /> : null}
            {step.href ? (
              <a className={className} href={step.href} target="_blank" rel="noreferrer">
                {step.label}
              </a>
            ) : (
              <span className={className}>{step.label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ProofSitePage({
  data,
  variant,
  voiceSection,
  buildLogSection,
  footerNote,
}: {
  data: ProofSitePageData;
  variant: ProofSitePageVariant;
  voiceSection?: ReactNode;
  buildLogSection?: ReactNode;
  footerNote: string;
}) {
  const firstName = firstNameOf(data.name);
  const fromTitle = routeFromTitle(data.previousRole);
  const lede = [data.tagline.trim(), data.previousRole ? `Previously ${endWithPeriod(data.previousRole)}` : ""].filter(Boolean).join(" ");

  return (
    <div className="rm" data-testid="proof-site-page" data-variant={variant}>
      <header className={styles.topbar}>
        <div className={`rm-container rm-container--narrow ${styles.topbarInner}`}>
          <a href="/" className={styles.topbarBrand}>
            <img src="/assets/branding/brand_brain_icon.svg" alt="" width={28} height={28} />
            <span>
              A proof page on <strong>{BRAND_NAME}</strong>
            </span>
          </a>
          <a href="/map" className={styles.topbarLink} data-testid="cta-map-career-proof-page" data-agent-action="start-career-map">
            Map your own career
          </a>
        </div>
      </header>

      {variant === "preview" ? (
        <div className={styles.noticeBarWarn}>
          <div className="rm-container rm-container--narrow">
            <p className={styles.notice}>
              Private preview. Only you can see this page until you publish it.{" "}
              <a href="/dashboard/proof/site">Edit and publish</a>
            </p>
          </div>
        </div>
      ) : null}

      <main>
        <section className={`rm-container rm-container--narrow ${styles.hero}`} aria-labelledby="proof-site-name">
          {variant === "example" ? (
            <span className={`rm-chip rm-chip--green ${styles.exampleChip}`} data-testid="example-profile-label">
              Example profile
            </span>
          ) : null}
          <div className={styles.heroHead}>
            <div className={styles.avatar} aria-hidden="true">
              {initialsFor(data.name)}
            </div>
            <div className={styles.heroNames}>
              <h1 id="proof-site-name" className={styles.name}>
                {data.name}
              </h1>
              <p className={styles.newTitle}>{data.newTitle}</p>
            </div>
          </div>
          {lede ? <p className="rm-lede">{lede}</p> : null}
          {data.bio.trim() ? <p className={styles.bio}>{data.bio}</p> : null}
          {data.contactEmail || data.linkedinUrl ? (
            <div className={styles.actions}>
              {data.contactEmail ? (
                <a href="#contact" className="rm-btn rm-btn--primary" data-testid="proof-site-contact">
                  Contact {firstName}
                </a>
              ) : null}
              {data.linkedinUrl ? (
                <a href={data.linkedinUrl} target="_blank" rel="noreferrer me" className="rm-btn rm-btn--secondary">
                  LinkedIn
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        {data.translations.length ? (
          <section className={`rm-container rm-container--narrow ${styles.section}`} aria-label={`What ${firstName} did before, and what it is now`}>
            <div className={`rm-card ${styles.routeCard}`}>
              {fromTitle ? <RouteStrip fromTitle={fromTitle} toTitle={data.newTitle} /> : null}
              <TranslationList rows={data.translations} showHeadings={!fromTitle} />
            </div>
          </section>
        ) : null}

        {data.built.length ? (
          <section className={`rm-container rm-container--narrow ${styles.section} ${styles.sectionStack}`} aria-labelledby="proof-site-built">
            <h2 id="proof-site-built" className={styles.h2}>
              Things I built
            </h2>
            {data.built.map((item, index) => (
              <article key={`${item.title}-${index}`} className={`rm-card ${styles.builtCard}`}>
                <div className={styles.builtText}>
                  <h3 className={styles.builtTitle}>
                    {item.href ? (
                      <a href={item.href} className={styles.builtTitleLink}>
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>
                  {item.description ? <p className={styles.builtDesc}>{item.description}</p> : null}
                </div>
                <BuiltSteps item={item} />
              </article>
            ))}
          </section>
        ) : null}

        {voiceSection}
        {buildLogSection}
      </main>

      <footer id="contact" className={styles.footer}>
        <div className={`rm-container rm-container--narrow ${styles.footerInner}`}>
          {data.contactEmail ? (
            <div className={styles.contact} data-testid="proof-site-contact-email">
              <span className={styles.contactLabel}>Email {firstName}</span>
              <a href={`mailto:${data.contactEmail}`} className={styles.contactAddress}>
                {data.contactEmail}
              </a>
              <SiteCopyButton value={data.contactEmail} label="Copy address" testId="proof-site-copy-email" />
            </div>
          ) : null}
          <p className={styles.footerText}>{footerNote}</p>
          <a href="/map" className="rm-btn rm-btn--secondary" data-testid="cta-map-career-proof-footer" data-agent-action="start-career-map">
            Find your new title
          </a>
        </div>
      </footer>
    </div>
  );
}
