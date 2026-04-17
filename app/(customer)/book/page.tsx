"use client";

import { Suspense, useEffect, useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Service, Booking } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

export default function BookingPageWrapper() {
  return (
    <Suspense fallback={<p className="text-muted-foreground p-8">Loading...</p>}>
      <BookingPage />
    </Suspense>
  );
}

interface StylistOption {
  id: string;
  user: { full_name: string } | null;
  is_available: boolean;
}

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedService = searchParams.get("service");
  const preselectedStylist = searchParams.get("stylist");

  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<StylistOption[]>([]);
  const [selectedService, setSelectedService] = useState<string>(preselectedService ?? "");
  const [selectedStylist, setSelectedStylist] = useState<string>(preselectedStylist ?? "");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [servicesRes, stylistsRes] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true).order("name"),
        supabase.from("stylists").select("id, is_available, user:users!stylists_user_id_fkey(full_name)").order("created_at"),
      ]);
      setServices(servicesRes.data ?? []);
      setStylists((stylistsRes.data as unknown as StylistOption[]) ?? []);
      setLoading(false);

      if (preselectedService) startTransition(() => setStep(2));
      if (preselectedStylist) startTransition(() => setStep(preselectedService ? 3 : 2));
    }
    fetchData();
  }, [preselectedService, preselectedStylist]);

  const fetchBookedSlots = useCallback(async () => {
    if (!selectedStylist || !selectedDate) return;
    const supabase = createClient();
    const dayStart = `${selectedDate}T00:00:00`;
    const dayEnd = `${selectedDate}T23:59:59`;
    const { data } = await supabase
      .from("bookings")
      .select("start_time, end_time")
      .eq("stylist_id", selectedStylist)
      .not("status", "in", '("cancelled","no_show")')
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd);

    const booked = (data as Pick<Booking, "start_time" | "end_time">[] ?? []).flatMap((b) => {
      const slots: string[] = [];
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      for (const ts of TIME_SLOTS) {
        const [h, m] = ts.split(":").map(Number);
        const slotTime = new Date(start);
        slotTime.setHours(h, m, 0, 0);
        if (slotTime >= start && slotTime < end) slots.push(ts);
      }
      return slots;
    });
    setBookedSlots(booked);
  }, [selectedStylist, selectedDate]);

  useEffect(() => {
    fetchBookedSlots();
  }, [fetchBookedSlots]);

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=/book`);
      return;
    }

    const service = services.find((s) => s.id === selectedService);
    if (!service) return;

    // Pre-flight: make sure this auth user has a matching public.users row.
    // Accounts created before the signup trigger (migration 00002) won't,
    // and bookings.customer_id -> users(id) would fail with a cryptic FK
    // error. This gives a clear, actionable message instead.
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) {
      setError(
        "Your profile isn't fully set up. Please contact support or ask an admin to run the backfill migration."
      );
      setSubmitting(false);
      return;
    }

    const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
    const endTime = new Date(startTime.getTime() + service.duration_minutes * 60000);

    const { error: bookingError } = await supabase.from("bookings").insert({
      customer_id: user.id,
      stylist_id: selectedStylist,
      service_id: selectedService,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      notes: notes || null,
      source: "online",
    });

    if (bookingError) {
      const msg = bookingError.message;
      let friendly = msg;
      if (msg.includes("Double booking")) {
        friendly = "This time slot was just taken. Please pick another.";
      } else if (msg.includes("bookings_customer_id_fkey")) {
        friendly =
          "Your account isn't linked to a customer profile yet. Ask an admin to run the latest migration, then try again.";
      }
      setError(friendly);
      setSubmitting(false);
      return;
    }

    setConfirmed(true);
    setSubmitting(false);
  }

  if (loading) return <p className="text-muted-foreground p-8">Loading...</p>;

  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <CheckCircle2 className="h-16 w-16 text-primary" />
        <h1 className="text-3xl font-bold font-heading">Booking Confirmed!</h1>
        <p className="text-muted-foreground">
          Your appointment on {selectedDate} at {selectedTime} has been booked.
        </p>
        <div className="flex gap-3 mt-4">
          <Button onClick={() => router.push("/my-bookings")}>View My Bookings</Button>
          <Button variant="outline" onClick={() => router.push("/services")}>Browse Services</Button>
        </div>
      </div>
    );
  }

  const selectedServiceObj = services.find((s) => s.id === selectedService);
  const selectedStylistObj = stylists.find((s) => s.id === selectedStylist);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold font-heading">Book an Appointment</h1>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step indicators */}
      <div className="flex gap-2">
        {["Service", "Stylist", "Date & Time", "Confirm"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
              step > i + 1 ? "bg-primary text-primary-foreground" :
              step === i + 1 ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            }`}>
              {i + 1}
            </div>
            <span className="text-sm hidden sm:inline">{label}</span>
            {i < 3 && <div className="w-4 h-px bg-border hidden sm:block" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Service */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Choose a Service</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => { setSelectedService(service.id); startTransition(() => setStep(2)); }}
                className={`w-full text-left p-3 rounded-md border transition-colors ${
                  selectedService === service.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">{service.duration_minutes} min · {service.category}</p>
                  </div>
                  <span className="font-semibold">P{Number(service.price).toFixed(0)}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Stylist */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a Stylist</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => startTransition(() => setStep(1))}>← Back</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {stylists.map((stylist) => (
              <button
                key={stylist.id}
                onClick={() => { setSelectedStylist(stylist.id); startTransition(() => setStep(3)); }}
                disabled={!stylist.is_available}
                className={`w-full text-left p-3 rounded-md border transition-colors ${
                  !stylist.is_available ? "opacity-50 cursor-not-allowed" :
                  selectedStylist === stylist.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{stylist.user?.full_name ?? "Stylist"}</span>
                  {stylist.is_available ? (
                    <Badge variant="default" className="text-xs">Available</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Pick Date & Time */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Pick Date & Time</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => startTransition(() => setStep(2))}>← Back</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                min={today}
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(""); }}
              />
            </div>
            {selectedDate && (
              <div className="space-y-2">
                <Label>Available Times</Label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = bookedSlots.includes(slot);
                    return (
                      <Button
                        key={slot}
                        variant={selectedTime === slot ? "default" : "outline"}
                        size="sm"
                        disabled={isBooked}
                        onClick={() => { setSelectedTime(slot); startTransition(() => setStep(4)); }}
                        className={isBooked ? "opacity-30 line-through" : ""}
                      >
                        {slot}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm Booking</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => startTransition(() => setStep(3))}>← Back</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium">{selectedServiceObj?.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Stylist</span>
                <span className="font-medium">{selectedStylistObj?.user?.full_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Date & Time</span>
                <span className="font-medium">{selectedDate} at {selectedTime}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{selectedServiceObj?.duration_minutes} min</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Price</span>
                <span className="font-bold text-lg">P{Number(selectedServiceObj?.price ?? 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g. I want it shorter on the sides"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? "Booking..." : "Confirm Booking"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
