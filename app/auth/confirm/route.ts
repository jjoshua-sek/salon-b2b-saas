import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Handles Supabase email verification callbacks.
 *
 * Supabase sends verification emails with a link to:
 *   /auth/confirm?token_hash=...&type=email&next=/
 *
 * This route verifies the OTP and redirects the user to their
 * role-appropriate dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // Get role and redirect to the right dashboard
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role === "admin") {
          return NextResponse.redirect(new URL("/admin", request.url));
        }
        if (profile?.role === "stylist") {
          return NextResponse.redirect(new URL("/stylist", request.url));
        }
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Something went wrong — send to login with error message
  return NextResponse.redirect(
    new URL("/login?error=Email+link+is+invalid+or+has+expired.+Please+sign+in+directly.", request.url)
  );
}
