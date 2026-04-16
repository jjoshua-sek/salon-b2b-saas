/**
 * Rules-based hairstyle recommendation engine.
 *
 * Maps face shape + customer preferences to recommended service categories,
 * styling tips, and things to avoid. Inclusive of all face shapes, hair types,
 * and gender expressions.
 */

import type { FaceShape } from "./face-shape";

export type HairType = "straight" | "wavy" | "curly" | "coily";
export type DesiredLength = "short" | "medium" | "long";
export type StyleVibe = "classic" | "modern" | "bold" | "natural";

export interface StylePreferences {
  hairType: HairType;
  desiredLength: DesiredLength;
  styleVibe: StyleVibe;
}

export interface StyleRecommendation {
  styleName: string;
  description: string;
  matchScore: number; // 0-100
  categories: string[]; // Service categories to match
  tags: string[]; // For matching portfolio items
}

interface FaceShapeRules {
  bestStyles: StyleRecommendation[];
  tips: string[];
  avoid: string[];
}

const RULES: Record<FaceShape, FaceShapeRules> = {
  oval: {
    bestStyles: [
      { styleName: "Textured Layers", description: "Layered cut adding movement and dimension", matchScore: 95, categories: ["cut"], tags: ["layers", "textured"] },
      { styleName: "Side-Swept Style", description: "Elegant side-swept look that frames the face beautifully", matchScore: 90, categories: ["cut", "styling"], tags: ["side-swept", "elegant"] },
      { styleName: "Soft Waves", description: "Relaxed, natural waves that complement balanced features", matchScore: 88, categories: ["styling", "treatment"], tags: ["waves", "soft"] },
      { styleName: "Classic Bob", description: "Timeless bob cut at chin or shoulder length", matchScore: 85, categories: ["cut"], tags: ["bob", "classic"] },
      { styleName: "Balayage Color", description: "Hand-painted highlights for a sun-kissed, dimensional look", matchScore: 82, categories: ["color"], tags: ["balayage", "highlights"] },
    ],
    tips: [
      "Your face shape is the most versatile — most styles will look great on you",
      "Add volume and texture at the mid-lengths for extra dimension",
      "Both center and side parts work well for oval faces",
    ],
    avoid: ["Heavy, blunt bangs that shorten the appearance of your face"],
  },
  round: {
    bestStyles: [
      { styleName: "Long Layers", description: "Face-framing layers that create elongation and define angles", matchScore: 95, categories: ["cut"], tags: ["layers", "long"] },
      { styleName: "Angular Bob", description: "Angled bob cut longer in front to create a slimming effect", matchScore: 92, categories: ["cut"], tags: ["bob", "angular"] },
      { styleName: "Deep Side Part", description: "Off-center part adding asymmetry and visual length", matchScore: 88, categories: ["styling"], tags: ["side-part", "asymmetric"] },
      { styleName: "Textured Pixie", description: "Short pixie with height and texture on top", matchScore: 85, categories: ["cut"], tags: ["pixie", "textured"] },
      { styleName: "Dimensional Highlights", description: "Strategic highlights creating depth and the illusion of contour", matchScore: 80, categories: ["color"], tags: ["highlights", "dimension"] },
    ],
    tips: [
      "Go for styles that add height at the crown to elongate your face",
      "Side parts and asymmetric styles break up the roundness",
      "Layers starting below the chin are particularly flattering",
    ],
    avoid: ["Chin-length bobs that emphasize width", "Heavy, round curls at cheek level"],
  },
  square: {
    bestStyles: [
      { styleName: "Soft Waves", description: "Flowing waves that soften strong jaw angles", matchScore: 95, categories: ["styling", "treatment"], tags: ["waves", "soft"] },
      { styleName: "Long Layered Cut", description: "Layers below the jaw to soften angular features", matchScore: 92, categories: ["cut"], tags: ["layers", "long"] },
      { styleName: "Side-Swept Bangs", description: "Angled bangs that break up the straight forehead line", matchScore: 88, categories: ["cut", "styling"], tags: ["bangs", "side-swept"] },
      { styleName: "Textured Lob", description: "Long bob with textured ends for movement", matchScore: 85, categories: ["cut"], tags: ["lob", "textured"] },
      { styleName: "Face-Framing Color", description: "Lighter pieces around the face to soften angles", matchScore: 80, categories: ["color"], tags: ["face-framing", "highlights"] },
    ],
    tips: [
      "Soft, wispy styles contrast beautifully with your strong bone structure",
      "Layers and waves around the jawline create a flattering frame",
      "Rounded shapes and curves balance out angular features",
    ],
    avoid: ["Blunt, straight-across cuts at jaw length", "Severe, pulled-back styles that emphasize the jawline"],
  },
  heart: {
    bestStyles: [
      { styleName: "Chin-Length Bob", description: "Bob that adds width at the jawline for balance", matchScore: 95, categories: ["cut"], tags: ["bob", "chin-length"] },
      { styleName: "Side-Swept Layers", description: "Layers starting at the cheekbones to balance proportions", matchScore: 92, categories: ["cut"], tags: ["layers", "side-swept"] },
      { styleName: "Soft Curtain Bangs", description: "Parted bangs that narrow the forehead gently", matchScore: 88, categories: ["cut", "styling"], tags: ["bangs", "curtain"] },
      { styleName: "Medium Textured Cut", description: "Shoulder-length cut with volume at the ends", matchScore: 85, categories: ["cut"], tags: ["medium", "textured"] },
      { styleName: "Lowlights", description: "Darker tones around the forehead to minimize width up top", matchScore: 78, categories: ["color"], tags: ["lowlights", "dimension"] },
    ],
    tips: [
      "Add width and volume at the chin and jaw level for balance",
      "Curtain bangs or side-swept bangs help minimize a wider forehead",
      "Styles that are fuller at the bottom create a balanced silhouette",
    ],
    avoid: ["Heavy volume at the crown that emphasizes forehead width", "Slicked-back styles that expose the widest part"],
  },
  oblong: {
    bestStyles: [
      { styleName: "Blunt Bob", description: "Chin-to-shoulder length bob that adds width and breaks vertical lines", matchScore: 95, categories: ["cut"], tags: ["bob", "blunt"] },
      { styleName: "Full Bangs", description: "Straight-across bangs that shorten the appearance of face length", matchScore: 92, categories: ["cut"], tags: ["bangs", "full"] },
      { styleName: "Voluminous Waves", description: "Big waves adding width at the sides", matchScore: 88, categories: ["styling", "treatment"], tags: ["waves", "volume"] },
      { styleName: "Layered Medium Cut", description: "Layers that add fullness to the sides", matchScore: 85, categories: ["cut"], tags: ["layers", "medium"] },
      { styleName: "All-Over Color", description: "Rich, even color that adds dimension without elongating", matchScore: 80, categories: ["color"], tags: ["all-over", "rich"] },
    ],
    tips: [
      "Styles that add width at the sides help balance a longer face",
      "Bangs are your best friend — they visually shorten the face",
      "Avoid center parts; side parts add more width",
    ],
    avoid: ["Very long, straight styles that emphasize length", "Excessive height at the crown"],
  },
  diamond: {
    bestStyles: [
      { styleName: "Chin-Length Layers", description: "Layers that add width at forehead and jawline for balance", matchScore: 95, categories: ["cut"], tags: ["layers", "chin-length"] },
      { styleName: "Side-Swept Bangs", description: "Bangs that add width across the forehead", matchScore: 92, categories: ["cut", "styling"], tags: ["bangs", "side-swept"] },
      { styleName: "Textured Pixie", description: "Short cut with volume on top to widen the forehead area", matchScore: 88, categories: ["cut"], tags: ["pixie", "textured"] },
      { styleName: "Medium Waves", description: "Shoulder-length waves creating softness at the jawline", matchScore: 85, categories: ["cut", "styling"], tags: ["waves", "medium"] },
      { styleName: "Face-Framing Highlights", description: "Lighter pieces at the temples and jaw to add visual width", matchScore: 80, categories: ["color"], tags: ["face-framing", "highlights"] },
    ],
    tips: [
      "Add volume at the forehead and chin to balance prominent cheekbones",
      "Side-swept styles draw attention across the face rather than at the cheeks",
      "Tucking hair behind the ears can highlight your cheekbones beautifully",
    ],
    avoid: ["Styles that add width at the cheekbones", "Slicked-back looks that emphasize the narrowest areas"],
  },
};

/**
 * Adjusts base recommendations based on hair type, desired length, and style vibe.
 */
export function getRecommendations(
  faceShape: FaceShape,
  preferences: StylePreferences
): {
  styles: StyleRecommendation[];
  tips: string[];
  avoid: string[];
} {
  const rules = RULES[faceShape];
  let styles = [...rules.bestStyles];

  // Boost scores based on preference alignment
  styles = styles.map((style) => {
    let bonus = 0;

    // Length alignment
    if (preferences.desiredLength === "short" && style.tags.some((t) => ["pixie", "bob", "short"].includes(t))) bonus += 5;
    if (preferences.desiredLength === "medium" && style.tags.some((t) => ["lob", "medium", "chin-length"].includes(t))) bonus += 5;
    if (preferences.desiredLength === "long" && style.tags.some((t) => ["long", "layers"].includes(t))) bonus += 5;

    // Hair type alignment
    if (preferences.hairType === "curly" && style.tags.some((t) => ["waves", "textured", "volume"].includes(t))) bonus += 3;
    if (preferences.hairType === "straight" && style.tags.some((t) => ["sleek", "blunt", "classic"].includes(t))) bonus += 3;

    // Style vibe alignment
    if (preferences.styleVibe === "bold" && style.tags.some((t) => ["pixie", "angular", "asymmetric"].includes(t))) bonus += 4;
    if (preferences.styleVibe === "classic" && style.tags.some((t) => ["classic", "elegant", "bob"].includes(t))) bonus += 4;
    if (preferences.styleVibe === "natural" && style.tags.some((t) => ["soft", "waves", "natural"].includes(t))) bonus += 4;
    if (preferences.styleVibe === "modern" && style.tags.some((t) => ["textured", "balayage", "dimension"].includes(t))) bonus += 4;

    return { ...style, matchScore: Math.min(100, style.matchScore + bonus) };
  });

  // Sort by match score
  styles.sort((a, b) => b.matchScore - a.matchScore);

  // Add hair-type-specific tips
  const tips = [...rules.tips];
  if (preferences.hairType === "curly" || preferences.hairType === "coily") {
    tips.push("Ask your stylist about curl-specific cutting techniques for maximum definition");
  }
  if (preferences.hairType === "straight") {
    tips.push("Texturizing techniques can add movement and body to straight hair");
  }

  return {
    styles,
    tips,
    avoid: rules.avoid,
  };
}
