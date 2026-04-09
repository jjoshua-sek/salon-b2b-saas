"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Review } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export default function StylistReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: stylist } = await supabase.from("stylists").select("id").eq("user_id", user.id).single();
      if (!stylist) { setLoading(false); return; }

      const { data } = await supabase
        .from("reviews")
        .select("*, customer:users!reviews_customer_id_fkey(full_name)")
        .eq("stylist_id", stylist.id)
        .order("created_at", { ascending: false });

      setReviews((data as Review[]) ?? []);
      setLoading(false);
    }
    fetchReviews();
  }, []);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading">My Reviews</h1>
        {avgRating && (
          <p className="text-muted-foreground mt-1 flex items-center gap-1">
            <Star className="h-4 w-4 fill-primary text-primary" /> {avgRating} average from {reviews.length} reviews
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {(review.customer as unknown as { full_name: string })?.full_name ?? "Customer"}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "fill-primary text-primary" : "text-muted"}`} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(review.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
