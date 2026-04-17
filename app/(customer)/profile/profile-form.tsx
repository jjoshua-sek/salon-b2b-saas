"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface Props {
  email: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  role: "customer" | "stylist" | "admin";
  joinedAt: string | null;
}

/**
 * Client island — only the editable form lives here. Email + role + joined
 * date are read-only and rendered without any hydration cost.
 *
 * We go through the browser client (anon key + RLS) rather than a server
 * action so the user's own RLS policy "UPDATE your own row" does the
 * authorization check. No custom server code needed.
 */
export function ProfileForm({
  email,
  fullName: initialName,
  phone: initialPhone,
  avatarUrl: initialAvatar,
  role,
  joinedAt,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const initials =
    fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired. Please sign in again.");
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        full_name: fullName.trim() || email.split("@")[0],
        phone: phone.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
    // Re-fetch server components (e.g. navbar's display name) so any
    // rendered copy of the old name updates without a full reload.
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {saved && (
        <div className="rounded-md bg-gold/10 border border-gold/30 p-3 text-sm text-gold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Profile updated.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-crimson/10 border border-crimson/20 p-3 text-sm text-crimson-light">
          {error}
        </div>
      )}

      <Card className="border-[#2a2520] bg-[#141414]">
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl || undefined} alt={fullName} />
            <AvatarFallback className="bg-[#2a2520] text-gold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-white font-heading">
              {fullName || email.split("@")[0]}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs capitalize border-gold/40 text-gold">
                {role}
              </Badge>
              {joinedAt && (
                <span className="text-xs text-[#8a8478]">
                  Joined {new Date(joinedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#e8e0d4]">
              Email
            </Label>
            <Input
              id="email"
              value={email}
              disabled
              className="border-[#2a2520] bg-[#0a0a0a] text-[#8a8478]"
            />
            <p className="text-xs text-[#5a5448]">
              Email is managed by your auth provider and cannot be changed here.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-[#e8e0d4]">
              Full name
            </Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="border-[#2a2520] bg-[#0a0a0a] text-[#e8e0d4] placeholder:text-[#5a5448] focus:border-gold focus:ring-gold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-[#e8e0d4]">
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+63 912 345 6789"
              className="border-[#2a2520] bg-[#0a0a0a] text-[#e8e0d4] placeholder:text-[#5a5448] focus:border-gold focus:ring-gold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar_url" className="text-[#e8e0d4]">
              Avatar URL
            </Label>
            <Input
              id="avatar_url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="border-[#2a2520] bg-[#0a0a0a] text-[#e8e0d4] placeholder:text-[#5a5448] focus:border-gold focus:ring-gold"
            />
            <p className="text-xs text-[#5a5448]">
              Paste a direct image link for now. Upload-to-Storage comes later.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-gold text-[#0a0a0a] hover:bg-gold-light font-semibold tracking-wider uppercase text-xs"
          >
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
