/**
 * Face shape classification from MediaPipe Face Mesh 468 landmarks.
 *
 * Uses geometric ratios between key facial measurements to classify
 * into one of six standard face shapes used in hairstyling.
 */

export type FaceShape = "oval" | "round" | "square" | "heart" | "oblong" | "diamond";

interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Classify face shape from 468 MediaPipe Face Mesh landmarks.
 *
 * Key landmark indices (MediaPipe Face Mesh):
 * - 10: forehead top center
 * - 152: chin bottom
 * - 234: left cheekbone outer
 * - 454: right cheekbone outer
 * - 172: left jaw angle
 * - 397: right jaw angle
 * - 127: left temple (forehead width)
 * - 356: right temple (forehead width)
 */
export function classifyFaceShape(landmarks: Point[]): FaceShape {
  if (landmarks.length < 468) {
    return "oval"; // fallback if landmarks incomplete
  }

  const foreheadTop = landmarks[10];
  const chin = landmarks[152];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const leftJaw = landmarks[172];
  const rightJaw = landmarks[397];
  const leftTemple = landmarks[127];
  const rightTemple = landmarks[356];

  const faceLength = distance(foreheadTop, chin);
  const cheekWidth = distance(leftCheek, rightCheek);
  const jawWidth = distance(leftJaw, rightJaw);
  const foreheadWidth = distance(leftTemple, rightTemple);

  const lengthToWidth = faceLength / cheekWidth;
  const jawToWidth = jawWidth / cheekWidth;
  const foreheadToWidth = foreheadWidth / cheekWidth;

  // Oblong: significantly longer than wide
  if (lengthToWidth > 1.5) return "oblong";

  // Square: jaw ≈ cheeks ≈ forehead, face not very long
  if (jawToWidth > 0.88 && foreheadToWidth > 0.88 && lengthToWidth < 1.25) return "square";

  // Round: nearly as wide as long, wide jaw
  if (lengthToWidth < 1.2 && jawToWidth > 0.82) return "round";

  // Heart: wide forehead, narrow jaw
  if (foreheadToWidth > 0.92 && jawToWidth < 0.78) return "heart";

  // Diamond: cheekbones wider than both forehead and jaw
  if (foreheadToWidth < 0.85 && jawToWidth < 0.82) return "diamond";

  // Oval: default — balanced proportions
  return "oval";
}

export const FACE_SHAPE_INFO: Record<FaceShape, { label: string; description: string; icon: string }> = {
  oval: {
    label: "Oval",
    description: "Balanced proportions with a slightly narrower forehead and jaw. The most versatile face shape.",
    icon: "🥚",
  },
  round: {
    label: "Round",
    description: "Face is nearly as wide as it is long, with soft angles and full cheeks.",
    icon: "🔵",
  },
  square: {
    label: "Square",
    description: "Strong jawline with forehead, cheekbones, and jaw nearly the same width.",
    icon: "🟦",
  },
  heart: {
    label: "Heart",
    description: "Wider forehead and cheekbones tapering to a narrower chin.",
    icon: "💛",
  },
  oblong: {
    label: "Oblong",
    description: "Face is noticeably longer than wide, with a straight cheek line.",
    icon: "📏",
  },
  diamond: {
    label: "Diamond",
    description: "Cheekbones are the widest part, with a narrow forehead and jawline.",
    icon: "💎",
  },
};
