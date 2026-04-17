import Link from "next/link";
import { Scissors } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Site-wide navbar. Server Component — reads the user session and role
 * directly so there's no hydration flicker between logged-out and logged-in
 * renders. This is the single source of truth for navbar styling; both the
 * landing page and the authenticated layouts use it.
 */
export async function SiteNavbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "customer" | "stylist" | "admin" | null = null;
  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    role = (profile?.role ?? null) as typeof role;
    fullName = profile?.full_name ?? null;
  }

  const dashboardHref =
    role === "admin" ? "/admin" : role === "stylist" ? "/stylist" : "/services";

  return (
    <header className="border-b border-[#2a2520] bg-[#0a0a0a]">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Scissors className="h-6 w-6 text-gold" />
          <span className="font-heading text-xl font-bold tracking-wider text-white">
            SALON
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/services"
            className="text-sm font-medium tracking-widest uppercase text-[#8a8478] hover:text-gold transition-colors"
          >
            Services
          </Link>
          <Link
            href="/stylists"
            className="text-sm font-medium tracking-widest uppercase text-[#8a8478] hover:text-gold transition-colors"
          >
            Stylists
          </Link>
          <Link
            href="/ai-recommend"
            className="text-sm font-medium tracking-widest uppercase text-[#8a8478] hover:text-gold transition-colors"
          >
            AI Styling
          </Link>
          {user && role === "customer" && (
            <>
              <Link
                href="/my-bookings"
                className="text-sm font-medium tracking-widest uppercase text-[#8a8478] hover:text-gold transition-colors"
              >
                My Bookings
              </Link>
              <Link
                href="/my-loyalty"
                className="text-sm font-medium tracking-widest uppercase text-[#8a8478] hover:text-gold transition-colors"
              >
                Loyalty
              </Link>
            </>
          )}
          {user && (role === "admin" || role === "stylist") && (
            <Link
              href={dashboardHref}
              className="text-sm font-medium tracking-widest uppercase text-gold hover:text-gold-light transition-colors"
            >
              Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/profile"
                className="hidden sm:inline text-sm tracking-wider text-[#e8e0d4] hover:text-gold transition-colors"
                title={user.email ?? undefined}
              >
                {fullName ?? user.email?.split("@")[0] ?? "Account"}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="text-[#8a8478] hover:text-gold hover:bg-transparent tracking-wider uppercase text-xs"
                >
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gold text-[#0a0a0a] hover:bg-gold-light tracking-wider uppercase text-xs font-semibold">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
