"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Booking } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  in_progress: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-muted text-muted-foreground",
};

export default function AdminSchedulePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, [date]);

  async function fetchBookings() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("bookings")
      .select("*, service:services(name, duration_minutes), stylist:stylists(*, user:users!stylists_user_id_fkey(full_name)), customer:users!bookings_customer_id_fkey(full_name)")
      .gte("start_time", `${date}T00:00:00`)
      .lte("start_time", `${date}T23:59:59`)
      .order("start_time");
    setBookings((data as Booking[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const supabase = createClient();
    await supabase.from("bookings").update({ status }).eq("id", id);
    fetchBookings();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-heading">Schedule</h1>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No bookings for this day.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const time = new Date(booking.start_time);
            const stylistName = (booking.stylist as unknown as { user: { full_name: string } | null })?.user?.full_name ?? "Stylist";
            const customerName = (booking.customer as unknown as { full_name: string })?.full_name ?? "Customer";
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
                        <Badge className={statusColors[booking.status] ?? ""}>
                          {booking.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {customerName} → {stylistName} · {booking.service?.duration_minutes}min
                        {booking.notes && ` · "${booking.notes}"`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {booking.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, "confirmed")}>Confirm</Button>
                      )}
                      {booking.status === "confirmed" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, "in_progress")}>Start</Button>
                      )}
                      {booking.status === "in_progress" && (
                        <Button size="sm" onClick={() => updateStatus(booking.id, "completed")}>Complete</Button>
                      )}
                      {(booking.status === "pending" || booking.status === "confirmed") && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateStatus(booking.id, "cancelled")}>Cancel</Button>
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
