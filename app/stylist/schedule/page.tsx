"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Booking } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function StylistSchedulePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get stylist record
      const { data: stylist } = await supabase
        .from("stylists")
        .select("id, is_available")
        .eq("user_id", user.id)
        .single();

      if (!stylist) { setLoading(false); return; }
      setIsAvailable(stylist.is_available);

      // Get today's and upcoming bookings
      const today = new Date().toISOString().split("T")[0];
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*, service:services(name, duration_minutes), customer:users!bookings_customer_id_fkey(full_name, phone)")
        .eq("stylist_id", stylist.id)
        .gte("start_time", `${today}T00:00:00`)
        .not("status", "in", '("cancelled","no_show")')
        .order("start_time");

      setBookings((bookingsData as Booking[]) ?? []);
      setLoading(false);
    }
    fetchData();
  }, []);

  async function toggleAvailability() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newStatus = !isAvailable;
    await supabase.from("stylists").update({ is_available: newStatus }).eq("user_id", user.id);
    setIsAvailable(newStatus);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-heading">My Schedule</h1>
        <Button
          variant={isAvailable ? "default" : "outline"}
          onClick={toggleAvailability}
        >
          {isAvailable ? "Available" : "Set Available"}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No upcoming appointments.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const time = new Date(booking.start_time);
            const customerName = (booking.customer as unknown as { full_name: string })?.full_name ?? "Customer";
            const customerPhone = (booking.customer as unknown as { phone: string | null })?.phone;
            const isToday = time.toDateString() === new Date().toDateString();
            return (
              <Card key={booking.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-mono font-bold">
                          {time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="font-medium">{booking.service?.name}</span>
                        {isToday && <Badge>Today</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {customerName}{customerPhone && ` · ${customerPhone}`}
                        {booking.notes && ` · "${booking.notes}"`}
                      </p>
                      {!isToday && (
                        <p className="text-xs text-muted-foreground">
                          {time.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{booking.status.replace("_", " ")}</Badge>
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
