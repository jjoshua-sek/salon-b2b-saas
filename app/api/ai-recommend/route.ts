import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecommendations, type StylePreferences } from "@/lib/ai/style-rules";
import type { FaceShape } from "@/lib/ai/face-shape";

const VALID_FACE_SHAPES: FaceShape[] = ["oval", "round", "square", "heart", "oblong", "diamond"];
const VALID_HAIR_TYPES = ["straight", "wavy", "curly", "coily"] as const;
const VALID_LENGTHS = ["short", "medium", "long"] as const;
const VALID_VIBES = ["classic", "modern", "bold", "natural"] as const;

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { faceShape, preferences } = body as {
    faceShape: string;
    preferences: StylePreferences;
  };

  // Validate inputs
  if (!VALID_FACE_SHAPES.includes(faceShape as FaceShape)) {
    return NextResponse.json({ error: "Invalid face shape" }, { status: 400 });
  }
  if (!VALID_HAIR_TYPES.includes(preferences?.hairType as typeof VALID_HAIR_TYPES[number])) {
    return NextResponse.json({ error: "Invalid hair type" }, { status: 400 });
  }
  if (!VALID_LENGTHS.includes(preferences?.desiredLength as typeof VALID_LENGTHS[number])) {
    return NextResponse.json({ error: "Invalid desired length" }, { status: 400 });
  }
  if (!VALID_VIBES.includes(preferences?.styleVibe as typeof VALID_VIBES[number])) {
    return NextResponse.json({ error: "Invalid style vibe" }, { status: 400 });
  }

  // Get rules-based recommendations
  const { styles, tips, hairTips, avoid } = getRecommendations(
    faceShape as FaceShape,
    preferences,
  );

  // Query matching services from the salon's catalog
  const supabase = await createClient();
  const recommendedCategories = [...new Set(styles.flatMap((s) => s.categories))];

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .in("category", recommendedCategories)
    .order("name");

  // Query portfolio items matching recommended style tags
  const recommendedTags = [...new Set(styles.flatMap((s) => s.tags))];
  const { data: portfolioItems } = await supabase
    .from("portfolio_items")
    .select("*, stylist:stylists!portfolio_items_stylist_id_fkey(id, user:users!stylists_user_id_fkey(full_name))")
    .order("created_at", { ascending: false })
    .limit(12);

  // Filter portfolio items that have at least one matching tag
  const matchedPortfolio = (portfolioItems ?? []).filter(
    (item) => item.tags && item.tags.some((tag: string) => recommendedTags.includes(tag.toLowerCase()))
  );

  // Try to save recommendation if user is authenticated
  let savedId: string | null = null;
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: saved } = await supabase
      .from("ai_recommendations")
      .insert({
        customer_id: user.id,
        face_shape: faceShape,
        preferences: preferences as unknown as Record<string, string>,
        recommended_styles: styles.map((s) => ({
          name: s.styleName,
          description: s.description,
          score: s.matchScore,
          categories: s.categories,
          tags: s.tags,
        })),
      })
      .select("id")
      .single();

    savedId = saved?.id ?? null;
  }

  return NextResponse.json({
    faceShape,
    styles,
    tips,
    hairTips,
    avoid,
    services: services ?? [],
    portfolio: matchedPortfolio,
    savedId,
  });
}
