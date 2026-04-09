"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Booking } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  in_progress: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-muted text-muted-foreground",
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const supabase = createClient();
      const { data } = await supabase
        .from("bookings")
        .select("*, service:services(*), stylist:stylists(*, user:users!stylists_user_id_fkey(full_name))")
        .order("start_time", { ascending: false });
      setBookings((data as Booking[]) ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  async function cancelBooking(id: string) {
    const supabase = createClient();
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "cancelled" } : b));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-heading">My Bookings</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No bookings yet. Browse our services to book your first appointment!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const stylistName = (booking.stylist as unknown as { user: { full_name: string } | null })?.user?.full_name ?? "Stylist";
            const date = new Date(booking.start_time);
            return (
              <Card key={booking.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{booking.service?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        with {stylistName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {date.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })} at{" "}
                        {date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={statusColors[booking.status] ?? ""}>
                        {booking.status.replace("_", " ")}
                      </Badge>
                      {booking.status === "pending" && (
                        <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => cancelBooking(booking.id)}>
                          Cancel
                        </Button>
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
