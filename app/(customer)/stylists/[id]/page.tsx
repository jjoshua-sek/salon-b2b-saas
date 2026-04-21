"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Review } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Star, Calendar, Sparkles } from "lucide-react";

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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-[#8a8478] text-sm tracking-wider uppercase">Loading portfolio…</p>
      </div>
    );
  }
  if (!stylist) {
    return <p className="p-8 text-[#8a8478]">Stylist not found.</p>;
  }

  const name = stylist.user?.full_name ?? "Stylist";
  const firstName = name.split(" ")[0];
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  // The first portfolio image gets hero treatment. Everything else lands in
  // the gallery grid below. This mimics how real hairstylist portfolios —
  // and platforms like Behance / model-mayhem — front-load a single
  // signature shot before letting the viewer browse.
  const hero = portfolio[0];
  const rest = portfolio.slice(1);

  return (
    <div className="-mx-4 -my-8 bg-[#0a0a0a] text-white">
      {/* HERO */}
      <section className="relative">
        {hero ? (
          <div className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
            <Image
              src={hero.image_url}
              alt={hero.title ?? `${name} — featured work`}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            {/* Gradient wash so the text on top stays readable. Tuned so the
                top is almost transparent (keeps the photo's impact) and the
                bottom grounds the copy. */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/30 via-[#0a0a0a]/50 to-[#0a0a0a]" />
          </div>
        ) : (
          <div className="h-[40vh] min-h-[300px] w-full bg-gradient-to-b from-[#141414] to-[#0a0a0a]" />
        )}

        <div className="container mx-auto px-4 -mt-40 relative z-10 pb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
            <Avatar className="h-28 w-28 ring-2 ring-gold/40 ring-offset-4 ring-offset-[#0a0a0a]">
              <AvatarImage src={stylist.avatar_url ?? stylist.user?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-[#2a2520] text-gold text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-gold">
                <Sparkles className="h-3.5 w-3.5" />
                Senior Stylist
              </div>
              <h1 className="text-4xl md:text-5xl font-bold font-heading leading-tight">
                {name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {stylist.is_available ? (
                  <Badge className="bg-gold text-[#0a0a0a] hover:bg-gold-light tracking-wider uppercase text-[10px]">
                    Accepting Clients
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="tracking-wider uppercase text-[10px]">
                    Fully Booked
                  </Badge>
                )}
                {stylist.years_experience != null && (
                  <span className="text-[#8a8478]">
                    {stylist.years_experience} years experience
                  </span>
                )}
                {avgRating && (
                  <span className="flex items-center gap-1 text-[#e8e0d4]">
                    <Star className="h-4 w-4 fill-gold text-gold" />
                    {avgRating}
                    <span className="text-[#8a8478]">· {reviews.length} reviews</span>
                  </span>
                )}
              </div>
              {stylist.personality_tags && stylist.personality_tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {stylist.personality_tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="capitalize border-gold/30 text-gold/80 text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Link href={`/book?stylist=${stylist.id}`} className="md:self-end">
              <Button
                size="lg"
                className="bg-gold text-[#0a0a0a] hover:bg-gold-light font-semibold tracking-wider uppercase text-xs gap-2"
              >
                <Calendar className="h-4 w-4" />
                Book with {firstName}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-16 space-y-16">
        {/* BIO */}
        {stylist.bio && (
          <section className="max-w-2xl">
            <div className="text-xs tracking-widest uppercase text-gold mb-3">About</div>
            <p className="text-lg text-[#e8e0d4] leading-relaxed font-heading">
              {stylist.bio}
            </p>
          </section>
        )}

        {/* PORTFOLIO GALLERY */}
        {portfolio.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs tracking-widest uppercase text-gold mb-2">Selected Work</div>
                <h2 className="text-3xl font-bold font-heading">Portfolio</h2>
              </div>
              <span className="text-xs text-[#5a5448] tracking-wider uppercase">
                {portfolio.length} pieces
              </span>
            </div>

            {/* True masonry via CSS multi-column layout. Columns have a
                uniform width (1/2/3 depending on breakpoint) but each
                tile keeps the image's natural aspect ratio — so rows
                never line up. That's the "messy but uniform" feel you
                get on real editorial portfolios (Cargo, Behance, etc.)
                with none of the black letterbox bars that forced-aspect
                containers create when the image doesn't match the crop. */}
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
              {(rest.length > 0 ? rest : portfolio).map((item) => (
                <PortfolioCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* REVIEWS */}
        <section className="space-y-6">
          <div>
            <div className="text-xs tracking-widest uppercase text-gold mb-2">Client Feedback</div>
            <h2 className="text-3xl font-bold font-heading">Reviews</h2>
          </div>
          {reviews.length === 0 ? (
            <p className="text-[#8a8478]">No reviews yet — be the first.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {reviews.map((review) => (
                <Card key={review.id} className="border-[#2a2520] bg-[#141414]">
                  <CardContent className="p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#e8e0d4]">
                        {(review.customer as unknown as { full_name: string })?.full_name ?? "Customer"}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < review.rating ? "fill-gold text-gold" : "text-[#2a2520]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-[#8a8478] leading-relaxed">{review.comment}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * A single portfolio tile. Uses a plain <img> so the browser can size
 * the element from the image's intrinsic dimensions — that's what lets
 * the masonry column layout work without cropping. We pay with losing
 * next/image's optimization pipeline, but the source files are already
 * AVIF and small enough that the trade-off is worth the layout fidelity.
 *
 * mb-4 + break-inside-avoid are the two rules that make CSS columns
 * behave like masonry: each tile reserves its full height in the column
 * flow and doesn't split across columns mid-image.
 */
function PortfolioCard({ item }: { item: PortfolioRow }) {
  return (
    <div className="group relative mb-4 break-inside-avoid overflow-hidden rounded-md border border-[#2a2520] bg-[#141414]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.image_url}
        alt={item.title ?? "Portfolio piece"}
        loading="lazy"
        className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
      />
      {/* Caption overlay — fades in on hover so the grid reads as pure
          imagery at rest, with context on demand. pointer-events-none so
          the overlay never absorbs clicks meant for the hover target. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 translate-y-2 p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        {item.title && (
          <p className="text-sm font-medium text-white">{item.title}</p>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-gold/40 text-gold text-[10px] capitalize"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
