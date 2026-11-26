import type { ReactNode } from "react";

/**
 * "Before -> Now" rows, the core content pattern of the product: what someone
 * did, and the AI-era skill it has become. Used on the landing page, the map
 * result, Remapped pages and public proof pages.
 */

export type TranslationRow = {
  before: string;
  now: string;
  /** Optional line under the "now" skill. */
  explanation?: string | null;
  /** Optional verbatim résumé quote; when set it is shown in quotes instead of `before`. */
  evidence?: string | null;
};

export function TranslationList({ rows, showHeadings = true, beforeLabel = "Before", nowLabel = "Now" }: { rows: TranslationRow[]; showHeadings?: boolean; beforeLabel?: string; nowLabel?: string }) {
  return (
    <div className="rm-translations">
      {showHeadings ? (
        <div className="rm-translation" style={{ borderTop: 0, paddingBlock: "0 10px", fontFamily: "var(--rm-display)", fontWeight: 600, fontSize: "1rem" }} aria-hidden="true">
          <span className="rm-translation__before">{beforeLabel}</span>
          <span style={{ color: "var(--rm-green-deep)" }}>{nowLabel}</span>
        </div>
      ) : null}
      {rows.map((row, index) => (
        <div className="rm-translation" key={`${row.now}-${index}`}>
          <span className="rm-translation__before">
            <span className="rm-sr-only">{beforeLabel}: </span>
            {row.evidence ? `“${row.evidence}”` : row.before}
          </span>
          <span>
            <span className="rm-sr-only">{nowLabel}: </span>
            <span className="rm-translation__now">{row.now}</span>
            {row.explanation ? <span style={{ display: "block", marginTop: 4, fontSize: "1rem", color: "var(--rm-muted)" }}>{row.explanation}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A single horizontal "old title —— new title" strip with station dots. */
export function RouteStrip({ fromTitle, toTitle, children }: { fromTitle: string; toTitle: string; children?: ReactNode }) {
  return (
    <div className="rm-row" style={{ fontFamily: "var(--rm-display)", fontSize: "1.25rem", gap: "12px 18px" }}>
      <span className="rm-row" style={{ gap: 10, color: "var(--rm-muted)", fontWeight: 500 }}>
        <span className="rm-dot" aria-hidden="true" />
        {fromTitle}
      </span>
      <span className="rm-line" aria-hidden="true" />
      <span className="rm-sr-only">to</span>
      <span className="rm-row" style={{ gap: 10, fontWeight: 600 }}>
        <span className="rm-dot rm-dot--arrived" aria-hidden="true" />
        {toTitle}
      </span>
      {children}
    </div>
  );
}
