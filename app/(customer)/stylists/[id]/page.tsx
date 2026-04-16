"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Review } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

interface StylistProfile {
  id: string;
  user_id: string;
  bio: string | null;
  avatar_url: string | null;
  is_available: boolean;
  years_experience: number | null;
  personality_tags: string[] | null;
  user: { full_name: string; avatar_url: string | null } | null;
}

interface PortfolioRow {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  tags: string[] | null;
}

export default function StylistProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [stylist, setStylist] = useState<StylistProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const [stylistRes, reviewsRes, portfolioRes] = await Promise.all([
        supabase
          .from("stylists")
          .select("*, user:users!stylists_user_id_fkey(full_name, avatar_url)")
          .eq("id", id)
          .single(),
        supabase
          .from("reviews")
          .select("*, customer:users!reviews_customer_id_fkey(full_name)")
          .eq("stylist_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("portfolio_items")
          .select("*")
          .eq("stylist_id", id)
          .order("created_at", { ascending: false }),
      ]);

      setStylist(stylistRes.data as StylistProfile | null);
      setReviews((reviewsRes.data as Review[]) ?? []);
      setPortfolio((portfolioRes.data as PortfolioRow[]) ?? []);
      setLoading(false);
    }
    fetchData();
  }, [id]);

  if (loading) return <p className="text-muted-foreground p-8">Loading...</p>;
  if (!stylist) return <p className="p-8">Stylist not found.</p>;

  const name = stylist.user?.full_name ?? "Stylist";
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Profile header */}
      <div className="flex items-start gap-6">
        <Avatar className="h-24 w-24">
          <AvatarImage src={stylist.avatar_url ?? stylist.user?.avatar_url ?? undefined} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold font-heading">{name}</h1>
          <div className="flex items-center gap-3">
            {stylist.is_available ? (
              <Badge>Available</Badge>
            ) : (
              <Badge variant="secondary">Busy</Badge>
            )}
            {stylist.years_experience && (
              <span className="text-sm text-muted-foreground">{stylist.years_experience} years experience</span>
            )}
            {avgRating && (
              <span className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-primary text-primary" />
                {avgRating} ({reviews.length} reviews)
              </span>
            )}
          </div>
          {stylist.bio && <p className="text-muted-foreground">{stylist.bio}</p>}
          {stylist.personality_tags && stylist.personality_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {stylist.personality_tags.map((tag) => (
                <Badge key={tag} variant="outline" className="capitalize">{tag}</Badge>
              ))}
            </div>
          )}
          <Link href={`/book?stylist=${stylist.id}`}>
            <Button className="mt-2">Book with {name.split(" ")[0]}</Button>
          </Link>
        </div>
      </div>

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold font-heading">Portfolio</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {portfolio.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <Image src={item.image_url} alt={item.title ?? "Portfolio"} width={400} height={400} className="aspect-square object-cover w-full" />
                <CardContent className="p-3">
                  {item.title && <p className="font-medium text-sm">{item.title}</p>}
                  {item.tags && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold font-heading">Reviews</h2>
        {reviews.length === 0 ? (
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
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < review.rating ? "fill-primary text-primary" : "text-muted"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
