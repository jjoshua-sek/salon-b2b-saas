/**
 * Seed script: populate the salon with a first stylist (Nissi Lee) and three
 * sample services. Idempotent — safe to re-run. Uses the Supabase service
 * role key so it bypasses RLS, and it also works around the case where the
 * `on_auth_user_created` trigger hasn't been applied yet (the same footgun
 * that left public.users empty for the admin).
 *
 * Run:
 *   cd salon-b2b-saas
 *   node scripts/seed-nissi.mjs
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// --- load .env.local -------------------------------------------------------
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((p) => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// --- 1. Stylist auth user --------------------------------------------------
const STYLIST_EMAIL = "nissi.lee@salon.dev";
const STYLIST_PASSWORD = "Nissi@Salon2026";

async function ensureStylistUser() {
  // See if the auth user already exists.
  const { data: list } = await sb.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === STYLIST_EMAIL);
  if (existing) {
    console.log(`[1/4] auth user exists: ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email: STYLIST_EMAIL,
    password: STYLIST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: "Nissi Lee",
      role: "stylist",
    },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  console.log(`[1/4] auth user created: ${data.user.id}`);
  return data.user.id;
}

// --- 2. public.users profile row (trigger may or may not have fired) -------
async function ensureProfileRow(userId) {
  const { data: existing } = await sb
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    // If role wasn't set to 'stylist' (e.g. trigger ignored metadata), fix it.
    if (existing.role !== "stylist") {
      await sb.from("users").update({ role: "stylist" }).eq("id", userId);
      console.log(`[2/4] profile role upgraded → stylist`);
    } else {
      console.log(`[2/4] profile exists`);
    }
    return;
  }
  // Trigger didn't fire — insert manually.
  const { error } = await sb.from("users").insert({
    id: userId,
    email: STYLIST_EMAIL,
    full_name: "Nissi Lee",
    role: "stylist",
  });
  if (error) throw new Error(`insert profile: ${error.message}`);
  console.log(`[2/4] profile inserted manually (trigger skipped)`);
}

// --- 3. stylists row -------------------------------------------------------
// Nissi Lee is an actual stylist whose portfolio emphasizes balayage /
// dimensional color, extensions, and the "Booji Blowout" signature style.
// Placeholder avatar — user can swap later.
async function ensureStylistRow(userId) {
  const { data: existing } = await sb
    .from("stylists")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const payload = {
    user_id: userId,
    bio: "Color, extensions, and the signature Booji Blowout. I specialize in sun-kissed balayage and custom extension work that looks effortlessly natural.",
    avatar_url:
      "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=400&h=400&fit=crop",
    is_available: true,
    years_experience: 9,
    personality_tags: ["color-expert", "balayage", "extensions", "editorial"],
  };

  if (existing) {
    const { error } = await sb
      .from("stylists")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(`update stylist: ${error.message}`);
    console.log(`[3/4] stylist row updated: ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await sb
    .from("stylists")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(`insert stylist: ${error.message}`);
  console.log(`[3/4] stylist row inserted: ${data.id}`);
  return data.id;
}

// --- 4. three sample services ----------------------------------------------
const SAMPLE_SERVICES = [
  {
    name: "The Sunlit Glow (Balayage)",
    description:
      "Custom hand-painted highlights designed for a natural, sun-kissed dimension with a soft, low-maintenance grow-out.",
    price: 4500,
    duration_minutes: 180,
    category: "color",
  },
  {
    name: "Booji Blowout",
    description:
      "Includes a double cleanse, a deep conditioning treatment, and a professional blowout and style.",
    price: 1200,
    duration_minutes: 60,
    category: "styling",
  },
  {
    name: "Full-Service Extension Application",
    description:
      "Includes consultation for tape-in, clip-in, micro-bead, or keratin bond extensions, plus installation and styling.",
    price: 8500,
    duration_minutes: 240,
    category: "extensions",
  },
];

async function ensureServices() {
  for (const svc of SAMPLE_SERVICES) {
    const { data: existing } = await sb
      .from("services")
      .select("id")
      .eq("name", svc.name)
      .maybeSingle();
    if (existing) {
      const { error } = await sb
        .from("services")
        .update({ ...svc, is_active: true })
        .eq("id", existing.id);
      if (error) throw new Error(`update service ${svc.name}: ${error.message}`);
      console.log(`[4/4] service updated: ${svc.name}`);
    } else {
      const { error } = await sb.from("services").insert({ ...svc, is_active: true });
      if (error) throw new Error(`insert service ${svc.name}: ${error.message}`);
      console.log(`[4/4] service inserted: ${svc.name}`);
    }
  }
}

// --- run -------------------------------------------------------------------
try {
  const userId = await ensureStylistUser();
  await ensureProfileRow(userId);
  await ensureStylistRow(userId);
  await ensureServices();
  console.log("\n✓ Seed complete.");
  console.log(`  Stylist login: ${STYLIST_EMAIL} / ${STYLIST_PASSWORD}`);
  console.log(`  Visible on: /stylists and /book`);
} catch (err) {
  console.error("\n✗ Seed failed:", err.message ?? err);
  process.exit(1);
}
