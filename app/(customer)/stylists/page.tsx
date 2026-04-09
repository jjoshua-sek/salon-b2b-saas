"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Star } from "lucide-react";

interface StylistWithUser {
  id: string;
  user_id: string;
  bio: string | null;
  avatar_url: string | null;
  is_available: boolean;
  years_experience: number | null;
  personality_tags: string[] | null;
  user: { full_name: string; avatar_url: string | null } | null;
}

export default function StylistsPage() {
  const [stylists, setStylists] = useState<StylistWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStylists() {
      const supabase = createClient();
      const { data } = await supabase
        .from("stylists")
        .select("*, user:users!stylists_user_id_fkey(full_name, avatar_url)")
        .order("created_at");
      setStylists((data as StylistWithUser[]) ?? []);
      setLoading(false);
    }
    fetchStylists();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-heading">Our Stylists</h1>
        <p className="text-muted-foreground mt-1">Meet our talented team</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading stylists...</p>
      ) : stylists.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No stylists added yet. Check back soon!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stylists.map((stylist) => {
            const name = stylist.user?.full_name ?? "Stylist";
            const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2);
            return (
              <Card key={stylist.id}>
                <CardHeader className="flex flex-row items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={stylist.avatar_url ?? stylist.user?.avatar_url ?? undefined} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {stylist.is_available ? (
                        <Badge variant="default" className="text-xs">Available</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Busy</Badge>
                      )}
                      {stylist.years_experience && (
                        <span className="text-xs text-muted-foreground">
                          {stylist.years_experience}yr exp
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stylist.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{stylist.bio}</p>
                  )}
                  {stylist.personality_tags && stylist.personality_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {stylist.personality_tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs capitalize">{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Link href={`/stylists/${stylist.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">View Profile</Button>
                    </Link>
                    <Link href={`/book?stylist=${stylist.id}`} className="flex-1">
                      <Button size="sm" className="w-full">Book</Button>
                    </Link>
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
