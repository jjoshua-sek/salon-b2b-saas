"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Small client island for sign-out. Kept separate from SiteNavbar (which is
 * a Server Component) so we don't turn the whole navbar into a client bundle
 * just for one button's onClick handler.
 */
export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      // router.refresh() re-runs the server component tree so the navbar
      // re-renders in its logged-out state without a full page reload.
      router.refresh();
      router.push("/");
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={isPending}
      className="text-[#8a8478] hover:text-crimson hover:bg-transparent tracking-wider uppercase text-xs gap-2"
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">{isPending ? "..." : "Sign out"}</span>
    </Button>
  );
}
