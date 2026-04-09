"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/services");
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
          <CardTitle className="text-2xl text-white font-heading">Create an account</CardTitle>
          <CardDescription className="text-[#8a8478]">Sign up to book appointments and more</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-crimson/10 border border-crimson/20 p-3 text-sm text-crimson-light">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[#e8e0d4]">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Juan Dela Cruz"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="border-[#2a2520] bg-[#0a0a0a] text-[#e8e0d4] placeholder:text-[#5a5448] focus:border-gold focus:ring-gold"
              />
            </div>
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
              <Label htmlFor="phone" className="text-[#e8e0d4]">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+63 9XX XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border-[#2a2520] bg-[#0a0a0a] text-[#e8e0d4] placeholder:text-[#5a5448] focus:border-gold focus:ring-gold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#e8e0d4]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="border-[#2a2520] bg-[#0a0a0a] text-[#e8e0d4] placeholder:text-[#5a5448] focus:border-gold focus:ring-gold"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-gold text-[#0a0a0a] hover:bg-gold-light font-semibold tracking-wider uppercase text-xs" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </Button>
            <p className="text-sm text-[#8a8478]">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-gold underline-offset-4 hover:underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
