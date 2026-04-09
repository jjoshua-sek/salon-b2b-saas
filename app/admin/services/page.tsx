"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Service } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

const CATEGORIES = ["cut", "color", "treatment", "styling"];

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", duration_minutes: "", category: "cut", image_url: "" });

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    const supabase = createClient();
    const { data } = await supabase.from("services").select("*").order("category").order("name");
    setServices(data ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: "", description: "", price: "", duration_minutes: "", category: "cut", image_url: "" });
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      price: String(s.price),
      duration_minutes: String(s.duration_minutes),
      category: s.category,
      image_url: s.image_url ?? "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    const supabase = createClient();
    const payload = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      duration_minutes: parseInt(form.duration_minutes),
      category: form.category,
      image_url: form.image_url || null,
    };

    if (editing) {
      await supabase.from("services").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("services").insert(payload);
    }

    setShowForm(false);
    fetchServices();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("services").update({ is_active: false }).eq("id", id);
    fetchServices();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-heading">Services</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Service</Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit Service" : "Add New Service"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Classic Fade" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Price (PHP)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="500" />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="30" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>{editing ? "Save Changes" : "Add Service"}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service list */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-2">
          {services.filter((s) => s.is_active).map((service) => (
            <Card key={service.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{service.name}</p>
                    <Badge variant="outline" className="capitalize text-xs">{service.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    P{Number(service.price).toFixed(0)} · {service.duration_minutes} min
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(service)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(service.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {services.filter((s) => s.is_active).length === 0 && (
            <p className="text-muted-foreground text-center py-8">No services yet. Add your first service above.</p>
          )}
        </div>
      )}
    </div>
  );
}
