import styles from "./hero-network-map.module.css";

/**
 * The hero illustration: a transit map of careers. Grey lines hold old jobs,
 * green lines hold new ones, and one green route crosses the gap from
 * Marketing Manager to Go-to-Market Engineer (Maya, the fictional example).
 *
 * Two drawings, CSS picks one: the design's wide map for tablets and up, and a
 * stacked map for phones so the labels stay readable at 360px. Pure server
 * component. The draw-on animation is CSS only, starts on first paint (nothing
 * waits for JS or scroll), leaves every label visible from the start and is
 * switched off under prefers-reduced-motion.
 */

const INK = "#0F172A";
const FAINT = "#64748B";
const GROUND = "#F6F8F7";
const GREEN = "#10B981";
const DEEP = "#047857";
const TEAL = "#0D9488";
const OLD_1 = "#7C8794";
const OLD_2 = "#98A2AD";
const OLD_3 = "#B3BBC4";
const CLOSED_FILL = "#D5DADF";
const CLOSED_STROKE = "#C3CAD1";

export const HERO_MAP_LABEL =
  "A transit map of careers. Grey lines on the left hold old jobs such as QA Tester, Marketing Manager and Copywriter. Green lines on the right hold new jobs such as Go-to-Market Engineer and Model Evaluator. A green route connects Marketing Manager to Go-to-Market Engineer.";

const HERO_MAP_LABEL_TALL =
  "A transit map of careers. Grey lines at the top hold old jobs such as QA Tester, Marketing Manager and Copywriter. Green lines below hold new jobs such as Go-to-Market Engineer and Model Evaluator. A green route connects Marketing Manager to Go-to-Market Engineer.";

function WideMap() {
  return (
    <svg role="img" aria-label={HERO_MAP_LABEL} viewBox="0 0 720 520" className={`${styles.svg} ${styles.wide}`} data-testid="hero-network-map">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={9}>
        <path d="M24,130 L112,130 L142,100 L300,100" stroke={OLD_2} />
        <path d="M24,260 L300,260" stroke={OLD_1} />
        <path d="M24,420 L120,420 L150,390 L300,390" stroke={OLD_3} />
        <path className={`${styles.draw} ${styles.new1}`} pathLength={1} d="M440,100 L590,100 L620,130 L700,130" stroke={TEAL} />
        <path className={`${styles.draw} ${styles.new2}`} pathLength={1} d="M440,260 L700,260" stroke={GREEN} />
        <path className={`${styles.draw} ${styles.new3}`} pathLength={1} d="M440,390 L560,390 L590,420 L700,420" stroke={DEEP} />
      </g>
      <g>
        <rect x={298} y={84} width={8} height={32} rx={2} fill={OLD_2} />
        <rect x={298} y={244} width={8} height={32} rx={2} fill={OLD_1} />
        <rect x={298} y={374} width={8} height={32} rx={2} fill={OLD_3} />
      </g>
      <g className={styles.caps}>
        <rect x={434} y={84} width={8} height={32} rx={2} fill={TEAL} />
        <rect x={434} y={244} width={8} height={32} rx={2} fill={GREEN} />
        <rect x={434} y={374} width={8} height={32} rx={2} fill={DEEP} />
      </g>
      <path className={`${styles.draw} ${styles.route}`} pathLength={1} d="M150,260 L206,318 L424,318 L480,260" fill="none" stroke={GROUND} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
      <path className={`${styles.draw} ${styles.route}`} pathLength={1} d="M150,260 L206,318 L424,318 L480,260" fill="none" stroke={GREEN} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
      <g strokeWidth={5} fill="#FFFFFF">
        <circle cx={64} cy={130} r={11} fill={CLOSED_FILL} stroke={CLOSED_STROKE} />
        <circle cx={220} cy={100} r={11} stroke={OLD_2} />
        <circle cx={64} cy={260} r={11} fill={CLOSED_FILL} stroke={CLOSED_STROKE} />
        <circle cx={150} cy={260} r={11} stroke={GREEN} />
        <circle cx={244} cy={260} r={11} stroke={OLD_1} />
        <circle cx={70} cy={420} r={11} stroke={OLD_3} />
        <circle cx={232} cy={390} r={11} fill={CLOSED_FILL} stroke={CLOSED_STROKE} />
        <circle className={styles.station} cx={500} cy={100} r={11} stroke={TEAL} />
        <circle className={styles.station} cx={664} cy={130} r={11} stroke={TEAL} />
        <circle className={styles.station} cx={626} cy={260} r={11} stroke={GREEN} />
        <circle className={styles.station} cx={500} cy={390} r={11} stroke={DEEP} />
        <circle className={styles.station} cx={650} cy={420} r={11} stroke={DEEP} />
        <circle className={styles.arrive} cx={480} cy={260} r={11} fill={GREEN} stroke={GREEN} />
      </g>
      <g fontFamily="Outfit, sans-serif" fontWeight={600} fontSize={15} fill={INK} textAnchor="middle">
        <text x={64} y={162} fill={FAINT}>Copywriter</text>
        <text x={220} y={78}>Brand Designer</text>
        <text x={64} y={292} fill={FAINT}>QA Tester</text>
        <text x={150} y={236}>Marketing Manager</text>
        <text x={244} y={292}>Producer</text>
        <text x={70} y={452}>Recruiter</text>
        <text x={232} y={366} fill={FAINT}>Paralegal</text>
        <text x={500} y={78}>AI Product Manager</text>
        <text x={650} y={162}>Agent Ops</text>
        <text x={506} y={236}>Go-to-Market Engineer</text>
        <text x={626} y={292}>Lifecycle Automation</text>
        <text x={500} y={366}>Model Evaluator</text>
        <text x={650} y={452}>AI Trainer</text>
      </g>
      <g className={styles.tag}>
        <rect x={449} y={282} width={62} height={28} rx={7} fill={INK} />
        <text x={480} y={301} fontFamily="Inter, sans-serif" fontWeight={600} fontSize={14} fill="#FFFFFF" textAnchor="middle">
          Maya
        </text>
      </g>
      <text x={370} y={212} fontFamily="Outfit, sans-serif" fontWeight={600} fontSize={15} fill={FAINT} textAnchor="middle">
        No route, until now
      </text>
    </svg>
  );
}

/** Phone layout: old lines stacked on top, new lines below, the route drops between them. */
function TallMap() {
  return (
    <svg role="img" aria-label={HERO_MAP_LABEL_TALL} viewBox="0 0 360 600" className={`${styles.svg} ${styles.tall}`}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8}>
        <path d="M16,76 L48,76 L68,56 L316,56" stroke={OLD_2} />
        <path d="M16,140 L316,140" stroke={OLD_3} />
        <path d="M16,236 L316,236" stroke={OLD_1} />
        <path className={`${styles.draw} ${styles.new1}`} pathLength={1} d="M48,380 L344,380" stroke={GREEN} />
        <path className={`${styles.draw} ${styles.new2}`} pathLength={1} d="M48,464 L344,464" stroke={TEAL} />
        <path className={`${styles.draw} ${styles.new3}`} pathLength={1} d="M48,548 L250,548 L270,528 L344,528" stroke={DEEP} />
      </g>
      <g>
        <rect x={314} y={43} width={7} height={26} rx={2} fill={OLD_2} />
        <rect x={314} y={127} width={7} height={26} rx={2} fill={OLD_3} />
        <rect x={314} y={223} width={7} height={26} rx={2} fill={OLD_1} />
      </g>
      <g className={styles.caps}>
        <rect x={43} y={367} width={7} height={26} rx={2} fill={GREEN} />
        <rect x={43} y={451} width={7} height={26} rx={2} fill={TEAL} />
        <rect x={43} y={535} width={7} height={26} rx={2} fill={DEEP} />
      </g>
      <path className={`${styles.draw} ${styles.route}`} pathLength={1} d="M150,236 L150,266 L190,306 L190,380" fill="none" stroke={GROUND} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
      <path className={`${styles.draw} ${styles.route}`} pathLength={1} d="M150,236 L150,266 L190,306 L190,380" fill="none" stroke={GREEN} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <g strokeWidth={4.5} fill="#FFFFFF">
        <circle cx={32} cy={76} r={10} fill={CLOSED_FILL} stroke={CLOSED_STROKE} />
        <circle cx={226} cy={56} r={10} stroke={OLD_2} />
        <circle cx={80} cy={140} r={10} stroke={OLD_3} />
        <circle cx={236} cy={140} r={10} fill={CLOSED_FILL} stroke={CLOSED_STROKE} />
        <circle cx={50} cy={236} r={10} fill={CLOSED_FILL} stroke={CLOSED_STROKE} />
        <circle cx={150} cy={236} r={10} stroke={GREEN} />
        <circle cx={270} cy={236} r={10} stroke={OLD_1} />
        <circle className={styles.station} cx={290} cy={380} r={10} stroke={GREEN} />
        <circle className={styles.station} cx={110} cy={464} r={10} stroke={TEAL} />
        <circle className={styles.station} cx={280} cy={464} r={10} stroke={TEAL} />
        <circle className={styles.station} cx={110} cy={548} r={10} stroke={DEEP} />
        <circle className={styles.station} cx={300} cy={528} r={10} stroke={DEEP} />
        <circle className={styles.arrive} cx={190} cy={380} r={10} fill={GREEN} stroke={GREEN} />
      </g>
      <g fontFamily="Outfit, sans-serif" fontWeight={600} fontSize={14} fill={INK} textAnchor="middle">
        <text x={46} y={104} fill={FAINT}>Copywriter</text>
        <text x={226} y={36}>Brand Designer</text>
        <text x={80} y={168}>Recruiter</text>
        <text x={236} y={168} fill={FAINT}>Paralegal</text>
        <text x={50} y={264} fill={FAINT}>QA Tester</text>
        <text x={150} y={214}>Marketing Manager</text>
        <text x={270} y={264}>Producer</text>
        <text x={190} y={412}>Go-to-Market Engineer</text>
        <text x={290} y={358}>Lifecycle Automation</text>
        <text x={110} y={442}>AI Product Manager</text>
        <text x={280} y={442}>Agent Ops</text>
        <text x={110} y={580}>Model Evaluator</text>
        <text x={300} y={506}>AI Trainer</text>
      </g>
      <g className={styles.tag}>
        <rect x={110} y={340} width={56} height={26} rx={7} fill={INK} />
        <text x={138} y={358} fontFamily="Inter, sans-serif" fontWeight={600} fontSize={13} fill="#FFFFFF" textAnchor="middle">
          Maya
        </text>
      </g>
      <text x={210} y={302} fontFamily="Outfit, sans-serif" fontWeight={600} fontSize={14} fill={FAINT} textAnchor="start">
        No route, until now
      </text>
    </svg>
  );
}

export function HeroNetworkMap() {
  return (
    <div className={styles.wrap}>
      <WideMap />
      <TallMap />
    </div>
  );
}
