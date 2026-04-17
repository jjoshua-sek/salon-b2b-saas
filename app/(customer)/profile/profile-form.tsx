"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Upload, Loader2, Trash2 } from "lucide-react";

interface Props {
  email: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  role: "customer" | "stylist" | "admin";
  joinedAt: string | null;
}

const AVATARS_BUCKET = "avatars";
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Client-side resize target. Avatars render small (max ~14 rem), so 512 is
// generous; keeps bandwidth and Storage spend small without visible loss.
const MAX_DIMENSION = 512;

export function ProfileForm({
  email,
  fullName: initialName,
  phone: initialPhone,
  avatarUrl: initialAvatar,
  role,
  joinedAt,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const initials =
    fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  /**
   * Downscale an image file with an offscreen <canvas> before upload.
   * Returns a Blob of the downscaled JPEG so we always land on a predictable
   * mime type regardless of the source extension.
   */
  async function resizeImage(file: File): Promise<Blob> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image."));
      el.src = dataUrl;
    });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.drawImage(img, 0, 0, w, h);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed."))),
        "image/jpeg",
        0.9,
      );
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSaved(false);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image is larger than 2 MB. Pick a smaller one or let us know if you need more.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired. Please sign in again.");

      const resized = await resizeImage(file);
      // Unique per-upload filename so the CDN URL changes each time —
      // downstream <img> elements can't serve a stale cached avatar.
      const path = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, resized, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(AVATARS_BUCKET)
        .getPublicUrl(path);
      const newUrl = publicUrlData.publicUrl;

      // Persist on the user row immediately so a navigate-away doesn't
      // leave the profile out of sync with the uploaded object.
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: newUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;

      // Best-effort cleanup of the previous avatar if it lived in our bucket.
      if (initialAvatar && initialAvatar.includes(`/${AVATARS_BUCKET}/`)) {
        const oldPath = initialAvatar.split(`/${AVATARS_BUCKET}/`)[1];
        if (oldPath && oldPath !== path) {
          await supabase.storage.from(AVATARS_BUCKET).remove([oldPath]);
        }
      }

      setAvatarUrl(newUrl);
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setError("");
    setSaved(false);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired.");

      if (avatarUrl && avatarUrl.includes(`/${AVATARS_BUCKET}/`)) {
        const oldPath = avatarUrl.split(`/${AVATARS_BUCKET}/`)[1];
        if (oldPath) {
          await supabase.storage.from(AVATARS_BUCKET).remove([oldPath]);
        }
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (updateError) throw updateError;

      setAvatarUrl("");
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove avatar.");
    }
  }

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
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
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
          {/* Avatar controls — a real file input, hidden behind styled buttons.
              Uploading happens immediately on file pick (not on form submit)
              so the UI gives instant feedback. */}
          <div className="space-y-2">
            <Label className="text-[#e8e0d4]">Avatar</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                onChange={handleFileChange}
                className="hidden"
                id="avatar-file"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="border-[#2a2520] text-gold hover:bg-gold/10 hover:border-gold tracking-wider uppercase text-xs gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    {avatarUrl ? "Change" : "Upload"}
                  </>
                )}
              </Button>
              {avatarUrl && !uploading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  className="text-[#8a8478] hover:text-crimson hover:bg-transparent tracking-wider uppercase text-xs gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-[#5a5448]">
              JPEG, PNG, or WebP. Max 2 MB. Images are resized to 512 px before upload.
            </p>
          </div>

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

          <Button
            type="submit"
            disabled={isPending || uploading}
            className="w-full bg-gold text-[#0a0a0a] hover:bg-gold-light font-semibold tracking-wider uppercase text-xs"
          >
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
