"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  // Honor ?redirect=/some/path — set by middleware when an unauthenticated
  // user tries to reach a protected route (e.g. Book Now → /book).
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(urlError ?? "");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      // Guard: only honor same-origin relative paths. An absolute URL in
      // ?redirect= could otherwise send users off to a phishing site.
      const safeRedirect =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : null;

      if (safeRedirect) {
        router.push(safeRedirect);
      } else if (profile?.role === "admin") {
        router.push("/admin");
      } else if (profile?.role === "stylist") {
        router.push("/stylist");
      } else {
        router.push("/services");
      }
    }

    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-[#0a0a0a]">
      <Card className="w-full max-w-md border-[#2a2520] bg-[#141414]">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-4 flex items-center gap-2">
            <Scissors className="h-6 w-6 text-gold" />
            <span className="font-heading text-xl font-bold tracking-wider text-white">SALON</span>
          </Link>
          <CardTitle className="text-2xl text-white font-heading">Welcome back</CardTitle>
          <CardDescription className="text-[#8a8478]">Sign in to your account</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-crimson/10 border border-crimson/20 p-3 text-sm text-crimson-light">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#e8e0d4]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-[#2a2520] bg-[#0a0a0a] text-[#e8e0d4] placeholder:text-[#5a5448] focus:border-gold focus:ring-gold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#e8e0d4]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-[#2a2520] bg-[#0a0a0a] text-[#e8e0d4] placeholder:text-[#5a5448] focus:border-gold focus:ring-gold"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-gold text-[#0a0a0a] hover:bg-gold-light font-semibold tracking-wider uppercase text-xs" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-sm text-[#8a8478]">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-gold underline-offset-4 hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
