import type { CSSProperties } from "react";

/** Moods the mascot can wear. Keep the set small — the charm is in one
 *  recognisable face, not in a library of expressions. */
export type YuzuMood = "happy" | "wink" | "wow" | "joy" | "sleepy";

type Props = {
  /** Rendered width/height in px. */
  size?: number;
  mood?: YuzuMood;
  /** Degrees of tilt. Applied through a CSS var so the float animation
   *  (which owns `transform`) can keep it while bobbing. */
  tilt?: number;
  /** Mirror horizontally, so a pair of them can look at each other. */
  flip?: boolean;
  /** Gentle bob. Disabled automatically under prefers-reduced-motion. */
  float?: boolean;
  /** Seconds for one bob cycle — vary it across a cluster so they drift
   *  out of sync instead of moving as one block. */
  floatDuration?: number;
  className?: string;
  /** Give it a label only when it carries meaning; decorative by default. */
  title?: string;
};

/* Colours resolve from the surrounding design system when it defines them
   (the landing's .peel scope does) and fall back to the brand hexes
   everywhere else, so the mascot drops into the app UI unchanged. */
const PEEL = "var(--yz-peel, var(--peel, #f2c41b))";
const DEEP = "var(--yz-peel-deep, var(--peel-deep, #d9a800))";
const RIND = "var(--yz-rind, var(--rind, #12291f))";
const LEAF = "var(--yz-leaf, var(--leaf, #5e8c4a))";
const BLUSH = "var(--yz-blush, var(--peel-red, #e24b32))";

/** The yuzu. A citrus with a face: peel body, one leaf, dot eyes. */
export function Yuzu({
  size = 48,
  mood = "happy",
  tilt = 0,
  flip = false,
  float = false,
  floatDuration,
  className,
  title,
}: Props) {
  const style: CSSProperties = {
    "--yz-rot": `${tilt}deg`,
    "--yz-flip": flip ? -1 : 1,
    ...(floatDuration ? { "--yz-dur": `${floatDuration}s` } : null),
  } as CSSProperties;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={["yuzu", float ? "yuzu-float" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}

      {/* stem + leaf */}
      <path
        d="M32 19c-.4-3.6.2-6.2 1.8-8.2"
        stroke={RIND}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M34.6 12.4c3.9-4.6 9.7-5.4 14-4.2-1.1 5.6-5.4 9.5-10.9 9.1-2.1-.2-3.4-2.6-3.1-4.9Z"
        fill={LEAF}
      />
      <path
        d="M36.8 15.6c3.3-2.4 7-4.4 10.8-6.8"
        stroke="#fff"
        strokeOpacity=".38"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />

      {/* body: a deeper ellipse offset behind the peel one gives the rind
          a lit-from-the-top-left roundness without needing gradients */}
      <ellipse cx="34" cy="39" rx="21.5" ry="20" fill={DEEP} />
      <ellipse cx="32" cy="37" rx="21.5" ry="20" fill={PEEL} />
      <ellipse
        cx="22"
        cy="26"
        rx="7"
        ry="4.4"
        fill="#fff"
        fillOpacity=".42"
        transform="rotate(-28 22 26)"
      />
      {/* rind pores */}
      <g fill={DEEP} fillOpacity=".4">
        <circle cx="16.5" cy="42" r="0.9" />
        <circle cx="20" cy="49.5" r="0.8" />
        <circle cx="45" cy="30" r="0.9" />
        <circle cx="42.5" cy="49" r="0.8" />
      </g>

      {/* cheeks */}
      <ellipse cx="18.5" cy="43.5" rx="3.6" ry="2.3" fill={BLUSH} fillOpacity=".3" />
      <ellipse cx="45.5" cy="43.5" rx="3.6" ry="2.3" fill={BLUSH} fillOpacity=".3" />

      <Face mood={mood} />
    </svg>
  );
}

function Face({ mood }: { mood: YuzuMood }) {
  const arc = {
    stroke: RIND,
    strokeWidth: "2.4",
    strokeLinecap: "round" as const,
    fill: "none",
  };

  if (mood === "sleepy") {
    return (
      <>
        <path d="M22.2 35.8c1.1 2.8 4.4 2.8 5.6 0" {...arc} />
        <path d="M36.2 35.8c1.1 2.8 4.4 2.8 5.6 0" {...arc} />
        <path d="M28 44.6c2.4 2 5.6 2 8 0" {...arc} />
      </>
    );
  }

  if (mood === "joy") {
    return (
      <>
        {/* closed, upturned eyes */}
        <path d="M22.2 37c1.1-2.8 4.4-2.8 5.6 0" {...arc} />
        <path d="M36.2 37c1.1-2.8 4.4-2.8 5.6 0" {...arc} />
        <Smile />
      </>
    );
  }

  if (mood === "wow") {
    return (
      <>
        <Eye cx={25} cy={35.5} r={3.4} />
        <Eye cx={39} cy={35.5} r={3.4} />
        <ellipse cx="32" cy="45" rx="2.9" ry="3.6" fill={RIND} />
      </>
    );
  }

  if (mood === "wink") {
    return (
      <>
        <Eye cx={25} cy={36} r={3} />
        <path d="M36.2 37.2c1.1-2.8 4.4-2.8 5.6 0" {...arc} />
        <Smile />
      </>
    );
  }

  return (
    <>
      <Eye cx={25} cy={36} r={3} />
      <Eye cx={39} cy={36} r={3} />
      <Smile />
    </>
  );
}

function Eye({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={r * 0.88} ry={r} fill={RIND} />
      <circle cx={cx + r * 0.3} cy={cy - r * 0.35} r={r * 0.28} fill="#fff" fillOpacity=".9" />
    </>
  );
}

/** Open smile, the way a mouth reads at 24px as well as at 96px. */
function Smile() {
  return <path d="M25.2 42.6A6.8 6.8 0 0 0 38.8 42.6Z" fill={RIND} />;
}
