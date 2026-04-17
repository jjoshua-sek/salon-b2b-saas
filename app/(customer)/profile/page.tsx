import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

/**
 * Profile page. Server Component: fetches the user + profile on the server,
 * then hands off to a small client island (ProfileForm) for the editable
 * fields. The middleware already guarantees `user` is non-null by the time
 * we reach here — but we double-check to satisfy TypeScript + give a safe
 * redirect if someone lands here via a stale session.
 */
export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/profile");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, phone, role, avatar_url, created_at")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading text-white">
          My Profile
        </h1>
        <p className="text-[#8a8478] mt-1 text-sm tracking-wider uppercase">
          Manage your account details
        </p>
      </div>

      <ProfileForm
        email={user.email ?? ""}
        fullName={profile?.full_name ?? ""}
        phone={profile?.phone ?? ""}
        avatarUrl={profile?.avatar_url ?? ""}
        role={profile?.role ?? "customer"}
        joinedAt={profile?.created_at ?? user.created_at ?? null}
      />
    </div>
  );
}
