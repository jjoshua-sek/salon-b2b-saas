/**
 * Minimalist SVG hair-type illustrations for the AI-recommend
 * preferences step. Drawn as abstract line art rather than photos so:
 *
 *  - There's no implied skin tone, gender, face shape, or hair length
 *    — the visual cue is *only* about curl pattern, which is the
 *    taxonomy the Andre Walker scale describes.
 *  - No licensing risk from scraped reference photos.
 *  - They're crisp at any size and add near-zero bundle weight.
 *
 * Each illustration depicts 4–5 strand paths on a transparent ground.
 * The strokes use `currentColor`, so the parent can restyle them on
 * hover / selected state with a single Tailwind class.
 */

import type { HairType } from "@/lib/ai/style-rules";

type Props = {
  type: HairType;
  className?: string;
};

export function HairTypeIcon({ type, className }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <g
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[type]}
      </g>
    </svg>
  );
}

// Each hair-type path set is intentionally hand-tuned rather than
// procedurally generated — hand tuning produces more "readable" at a
// glance, even at 32px.
const PATHS: Record<HairType, React.ReactNode> = {
  // Straight: near-vertical strands with a tiny natural tilt. Not ruler
  // straight — real "straight" hair has micro-drift.
  straight: (
    <>
      <path d="M10 6v36" />
      <path d="M18 6v36" />
      <path d="M26 6v36" />
      <path d="M34 6v36" />
      <path d="M42 6v36" />
    </>
  ),
  // Wavy: long, shallow S-curves. One full wavelength per strand,
  // roughly sinusoidal.
  wavy: (
    <>
      <path d="M10 6c4 4 -4 8 0 12s-4 8 0 12s-4 8 0 12" />
      <path d="M19 6c4 4 -4 8 0 12s-4 8 0 12s-4 8 0 12" />
      <path d="M28 6c4 4 -4 8 0 12s-4 8 0 12s-4 8 0 12" />
      <path d="M37 6c4 4 -4 8 0 12s-4 8 0 12s-4 8 0 12" />
    </>
  ),
  // Curly: tighter corkscrews — half the wavelength of "wavy", same
  // amplitude. Drawn as stacked c-curves rather than loops so the
  // illustration stays legible at small sizes.
  curly: (
    <>
      <path d="M10 6c6 3 -6 5 0 8s-6 5 0 8s-6 5 0 8s-6 5 0 8s-6 5 0 4" />
      <path d="M21 6c6 3 -6 5 0 8s-6 5 0 8s-6 5 0 8s-6 5 0 8s-6 5 0 4" />
      <path d="M32 6c6 3 -6 5 0 8s-6 5 0 8s-6 5 0 8s-6 5 0 8s-6 5 0 4" />
      <path d="M43 6c6 3 -6 5 0 8s-6 5 0 8s-6 5 0 8s-6 5 0 8s-6 5 0 4" />
    </>
  ),
  // Coily: tight springs drawn as small overlapping circles stacked
  // vertically. Small enough that the eye reads the stack as a single
  // tight spring rather than distinct loops.
  coily: (
    <>
      {[12, 24, 36].map((x) => (
        <g key={x}>
          <circle cx={x} cy={10} r={3} />
          <circle cx={x} cy={16} r={3} />
          <circle cx={x} cy={22} r={3} />
          <circle cx={x} cy={28} r={3} />
          <circle cx={x} cy={34} r={3} />
          <circle cx={x} cy={40} r={3} />
        </g>
      ))}
    </>
  ),
};
