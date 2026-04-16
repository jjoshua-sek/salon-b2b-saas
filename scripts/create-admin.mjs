/**
 * One-time script to create the admin account.
 * Run from the salon-b2b-saas/ directory:
 *   node scripts/create-admin.mjs
 *
 * Uses the SUPABASE_SERVICE_ROLE_KEY to bypass email confirmation
 * and create the admin user directly.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=").map((p) => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = "admin@salon.dev";
const ADMIN_PASSWORD = "Salon@Admin2026";
const ADMIN_NAME = "Salon Admin";

async function main() {
  console.log(`Creating admin account: ${ADMIN_EMAIL}`);

  // Create the auth user (email_confirm: true skips email verification)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: ADMIN_NAME,
      role: "admin",
    },
  });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      console.log("User already exists — updating role to admin...");
      // Find the existing user
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email === ADMIN_EMAIL);
      if (existing) {
        await supabase
          .from("users")
          .update({ role: "admin" })
          .eq("id", existing.id);
        console.log(`Updated existing user ${existing.id} to admin role.`);
      }
    } else {
      console.error("Failed to create user:", authError.message);
      process.exit(1);
    }
    return;
  }

  const userId = authData.user.id;
  console.log(`Auth user created: ${userId}`);

  // The trigger should auto-create the users row, but set role explicitly
  const { error: updateError } = await supabase
    .from("users")
    .update({ role: "admin" })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to set admin role:", updateError.message);
    process.exit(1);
  }

  console.log("\n✅ Admin account ready!");
  console.log("   Email:    " + ADMIN_EMAIL);
  console.log("   Password: " + ADMIN_PASSWORD);
  console.log("\n⚠️  Change your password after first login.");
}

main();
