"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus } from "lucide-react";

interface StaffMember {
  id: string;
  user_id: string;
  bio: string | null;
  is_available: boolean;
  years_experience: number | null;
  personality_tags: string[] | null;
  user: { full_name: string; email: string } | null;
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", password: "" });
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    const supabase = createClient();
    const { data } = await supabase
      .from("stylists")
      .select("*, user:users!stylists_user_id_fkey(full_name, email)")
      .order("created_at");
    setStaff((data as StaffMember[]) ?? []);
    setLoading(false);
  }

  async function handleInvite() {
    setInviteError("");
    setInviting(true);
    const supabase = createClient();

    // Create user with stylist role via admin signup
    const { error } = await supabase.auth.signUp({
      email: inviteForm.email,
      password: inviteForm.password,
      options: {
        data: {
          full_name: inviteForm.full_name,
          role: "stylist",
        },
      },
    });

    if (error) {
      setInviteError(error.message);
      setInviting(false);
      return;
    }

    setShowInvite(false);
    setInviteForm({ email: "", full_name: "", password: "" });
    setInviting(false);
    // Wait a moment for trigger to create the stylist record
    setTimeout(fetchStaff, 1000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-heading">Staff Management</h1>
        <Button onClick={() => setShowInvite(true)}><Plus className="h-4 w-4 mr-2" />Add Stylist</Button>
      </div>

      {showInvite && (
        <Card>
          <CardHeader><CardTitle>Add New Stylist</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {inviteError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{inviteError}</div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={inviteForm.full_name} onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })} placeholder="Maria Santos" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="maria@salon.com" />
              </div>
              <div className="space-y-2">
                <Label>Temporary Password</Label>
                <Input type="password" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} placeholder="At least 6 characters" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleInvite} disabled={inviting}>{inviting ? "Creating..." : "Create Stylist Account"}</Button>
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : staff.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No stylists yet. Add your first stylist above.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => {
            const name = member.user?.full_name ?? "Stylist";
            const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2);
            return (
              <Card key={member.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {member.is_available ? (
                        <Badge variant="default" className="text-xs">Available</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
