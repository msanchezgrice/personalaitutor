import { getCareerMapLine, type CareerMapLineId } from "@aitutor/shared";

/**
 * The route drawing: an old (graphite) line with the person's previous job, a
 * new (green) line with their new title and up to two alternates, and the green
 * route that crosses the gap between them.
 *
 * Renders two SVGs and lets CSS pick one: a wide drawing for tablets and up, a
 * tall drawing for phones (labels stay readable at 360px). Pure server
 * component; the draw-on animation is CSS only and respects reduced motion.
 */

export type RouteMapProps = {
  fromTitle: string;
  /** Label for the old line, e.g. "Game Studio". */
  fromField: string;
  /** Neighbouring old titles. Only the first is drawn. */
  neighbors?: string[];
  toTitle: string;
  toLineId: CareerMapLineId;
  /** Up to two alternate titles on the same new line. */
  alternates?: string[];
  /** Small tag on the destination, e.g. the person's first name. */
  personLabel?: string | null;
  animate?: boolean;
  className?: string;
};

const INK = "#0F172A";
const MUTED = "#475569";
const OLD = "#7C8794";
const GROUND = "#FFFFFF";
const GREEN = "#10B981";

function wrap(label: string, max: number): string[] {
  const text = label.trim();
  if (text.length <= max) return [text];
  const words = text.split(/\s+/);
  let best = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    const score = Math.max(a, b);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function Label({ x, y, lines, size, weight = 600, fill = INK, anchor = "middle", up = false }: { x: number; y: number; lines: string[]; size: number; weight?: number; fill?: string; anchor?: "start" | "middle" | "end"; up?: boolean }) {
  const lineHeight = size * 1.18;
  const startY = up ? y - (lines.length - 1) * lineHeight : y;
  return (
    <text x={x} y={startY} textAnchor={anchor} fontSize={size} fontWeight={weight} fill={fill}>
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function badgeWidth(label: string, size = 14) {
  return Math.round(label.length * size * 0.6 + 28);
}

export function RouteMap({ fromTitle, fromField, neighbors = [], toTitle, toLineId, alternates = [], personLabel = null, animate = false, className }: RouteMapProps) {
  const line = getCareerMapLine(toLineId);
  const neighbor = neighbors[0] ?? null;
  const alts = alternates.slice(0, 2);
  const label = [
    `Route map. From ${fromTitle} on the grey ${fromField} line, a green route crosses to ${toTitle} on the green ${line.label} line.`,
    alts.length ? `${alts.join(" and ")} ${alts.length > 1 ? "are" : "is"} further along the same line.` : "",
  ]
    .join(" ")
    .trim();
  const rootClass = ["rm-routemap", animate ? "rm-routemap--animate" : "", className ?? ""].filter(Boolean).join(" ");
  const tag = personLabel ? personLabel.trim().slice(0, 14) : null;

  return (
    <div className="rm-routemap-wrap">
      <style>{`.rm-routemap--tall{display:none}@media (max-width:640px){.rm-routemap--wide{display:none}.rm-routemap--tall{display:block}}`}</style>

      {/* Wide */}
      <svg role="img" aria-label={label} viewBox="0 0 1040 300" className={`${rootClass} rm-routemap--wide`}>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={10}>
          <path d="M30,110 L400,110" stroke={OLD} />
          <path d="M560,110 L1010,110" stroke={line.color} />
        </g>
        <rect x={398} y={92} width={9} height={36} rx={2} fill={OLD} />
        <rect x={553} y={92} width={9} height={36} rx={2} fill={line.color} />
        <path d="M250,110 L320,190 L530,190 L610,110" fill="none" stroke={GROUND} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
        <path className="rm-routemap__route" pathLength={1} d="M250,110 L320,190 L530,190 L610,110" fill="none" stroke={GREEN} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
        <g strokeWidth={6} fill="#FFFFFF">
          {neighbor ? <circle cx={90} cy={110} r={13} fill="#D5DADF" stroke="#C3CAD1" /> : null}
          <circle cx={250} cy={110} r={13} stroke={GREEN} />
          <circle className="rm-routemap__arrive" cx={610} cy={110} r={15} fill={GREEN} stroke={GREEN} />
          {alts[0] ? <circle cx={790} cy={110} r={13} stroke={line.color} /> : null}
          {alts[1] ? <circle cx={950} cy={110} r={13} stroke={line.color} /> : null}
        </g>
        {neighbor ? <Label x={90} y={150} lines={wrap(neighbor, 18)} size={16} fill="#64748B" /> : null}
        <Label x={250} y={78} lines={wrap(fromTitle, 24)} size={17} up />
        <Label x={610} y={74} lines={wrap(toTitle, 24)} size={20} weight={700} up />
        {alts[0] ? <Label x={790} y={152} lines={wrap(alts[0], 20)} size={16} /> : null}
        {alts[1] ? <Label x={950} y={78} lines={wrap(alts[1], 16)} size={16} up /> : null}
        <g fontFamily="Inter, system-ui, sans-serif" fontWeight={600} fontSize={14} textAnchor="middle">
          <rect x={30} y={236} width={badgeWidth(fromField)} height={32} rx={8} fill={OLD} />
          <text x={30 + badgeWidth(fromField) / 2} y={257} fill="#FFFFFF">
            {fromField}
          </text>
          <rect x={1010 - badgeWidth(line.label)} y={236} width={badgeWidth(line.label)} height={32} rx={8} fill="#047857" />
          <text x={1010 - badgeWidth(line.label) / 2} y={257} fill="#FFFFFF">
            {line.label}
          </text>
          <text x={425} y={222} fill="#047857">
            Your route
          </text>
          <text x={270} y={178} fill={MUTED} textAnchor="end">
            You were here
          </text>
          {tag ? (
            <g className="rm-routemap__arrive">
              <rect x={610 - badgeWidth(tag) / 2} y={134} width={badgeWidth(tag)} height={30} rx={8} fill={INK} />
              <text x={610} y={154} fill="#FFFFFF">
                {tag}
              </text>
            </g>
          ) : null}
        </g>
      </svg>

      {/* Tall (phones) */}
      <svg role="img" aria-label={label} viewBox="0 0 360 500" className={`${rootClass} rm-routemap--tall`}>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={10}>
          <path d="M44,24 L44,170" stroke={OLD} />
          <path d="M44,280 L44,476" stroke={line.color} />
        </g>
        <rect x={26} y={168} width={36} height={9} rx={2} fill={OLD} />
        <rect x={26} y={273} width={36} height={9} rx={2} fill={line.color} />
        <path d="M44,120 L112,180 L112,262 L44,322" fill="none" stroke={GROUND} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
        <path className="rm-routemap__route" pathLength={1} d="M44,120 L112,180 L112,262 L44,322" fill="none" stroke={GREEN} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
        <g strokeWidth={6} fill="#FFFFFF">
          {neighbor ? <circle cx={44} cy={52} r={12} fill="#D5DADF" stroke="#C3CAD1" /> : null}
          <circle cx={44} cy={120} r={13} stroke={GREEN} />
          <circle className="rm-routemap__arrive" cx={44} cy={322} r={15} fill={GREEN} stroke={GREEN} />
          {alts[0] ? <circle cx={44} cy={392} r={12} stroke={line.color} /> : null}
          {alts[1] ? <circle cx={44} cy={448} r={12} stroke={line.color} /> : null}
        </g>
        {neighbor ? <Label x={72} y={58} lines={[neighbor]} size={16} fill="#64748B" anchor="start" /> : null}
        <Label x={72} y={118} lines={wrap(fromTitle, 26)} size={17} anchor="start" />
        <text x={72} y={118 + (wrap(fromTitle, 26).length - 1) * 20 + 22} fontFamily="Inter, system-ui, sans-serif" fontWeight={600} fontSize={14} fill={MUTED}>
          You were here · {fromField}
        </text>
        <text x={130} y={226} fontFamily="Inter, system-ui, sans-serif" fontWeight={600} fontSize={14} fill="#047857">
          Your route
        </text>
        <Label x={72} y={320} lines={wrap(toTitle, 24)} size={20} weight={700} anchor="start" />
        <text x={72} y={320 + (wrap(toTitle, 24).length - 1) * 24 + 22} fontFamily="Inter, system-ui, sans-serif" fontWeight={600} fontSize={14} fill="#047857">
          {tag ? `${tag} · ` : ""}
          {line.label} line
        </text>
        {alts[0] ? <Label x={72} y={398} lines={[alts[0]]} size={16} anchor="start" /> : null}
        {alts[1] ? <Label x={72} y={454} lines={[alts[1]]} size={16} anchor="start" /> : null}
      </svg>
    </div>
  );
}
