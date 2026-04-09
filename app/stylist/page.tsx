"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Star, Clock } from "lucide-react";

export default function StylistDashboard() {
  const [stats, setStats] = useState({ todayCount: 0, avgRating: "--", isAvailable: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: stylist } = await supabase
        .from("stylists")
        .select("id, is_available")
        .eq("user_id", user.id)
        .single();

      if (!stylist) { setLoading(false); return; }

      const today = new Date().toISOString().split("T")[0];
      const [bookingsRes, reviewsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id", { count: "exact" })
          .eq("stylist_id", stylist.id)
          .gte("start_time", `${today}T00:00:00`)
          .lte("start_time", `${today}T23:59:59`)
          .not("status", "in", '("cancelled","no_show")'),
        supabase
          .from("reviews")
          .select("rating")
          .eq("stylist_id", stylist.id),
      ]);

      const ratings = reviewsRes.data ?? [];
      const avg = ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
        : "--";

      setStats({
        todayCount: bookingsRes.count ?? 0,
        avgRating: avg,
        isAvailable: stylist.is_available,
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-heading">Welcome back</h1>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading">{stats.todayCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading">{stats.avgRating}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-heading ${stats.isAvailable ? "text-green-500" : "text-yellow-500"}`}>
                {stats.isAvailable ? "Available" : "Busy"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
