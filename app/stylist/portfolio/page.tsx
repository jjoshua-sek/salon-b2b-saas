"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";

interface PortfolioRow {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  tags: string[] | null;
}

export default function StylistPortfolioPage() {
  const [items, setItems] = useState<PortfolioRow[]>([]);
  const [stylistId, setStylistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ image_url: "", title: "", description: "", tags: "" });

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: stylist } = await supabase.from("stylists").select("id").eq("user_id", user.id).single();
      if (!stylist) { setLoading(false); return; }
      setStylistId(stylist.id);

      const { data } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("stylist_id", stylist.id)
        .order("created_at", { ascending: false });

      setItems((data as PortfolioRow[]) ?? []);
      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleAdd() {
    if (!stylistId) return;
    const supabase = createClient();
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    await supabase.from("portfolio_items").insert({
      stylist_id: stylistId,
      image_url: form.image_url,
      title: form.title || null,
      description: form.description || null,
      tags: tags.length > 0 ? tags : null,
    });

    setShowForm(false);
    setForm({ image_url: "", title: "", description: "", tags: "" });
    // Refetch
    const { data } = await supabase.from("portfolio_items").select("*").eq("stylist_id", stylistId).order("created_at", { ascending: false });
    setItems((data as PortfolioRow[]) ?? []);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("portfolio_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-heading">My Portfolio</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add Work</Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Balayage Transformation" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. balayage, long, women" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd}>Save</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No portfolio items yet. Showcase your best work!</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden group relative">
              <Image src={item.image_url} alt={item.title ?? "Portfolio"} width={400} height={400} className="aspect-square object-cover w-full" />
              <CardContent className="p-3">
                {item.title && <p className="font-medium text-sm">{item.title}</p>}
                {item.tags && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                  </div>
                )}
              </CardContent>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive bg-background/80"
                onClick={() => handleDelete(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
