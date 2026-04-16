"use client";

import { useState } from "react";
import type { Service } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Clock, DollarSign } from "lucide-react";

const CATEGORIES = ["all", "cut", "color", "treatment", "styling"];

export default function ServiceFilter({ services }: { services: Service[] }) {
  const [category, setCategory] = useState("all");

  const filtered = category === "all" ? services : services.filter((s) => s.category === category);

  return (
    <>
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={category === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(cat)}
            className="capitalize"
          >
            {cat}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {services.length === 0
              ? "No services added yet. Check back soon!"
              : "No services in this category."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <Badge variant="secondary" className="capitalize">{service.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {service.description && (
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    P{Number(service.price).toFixed(2)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {service.duration_minutes} min
                  </span>
                </div>
                <Link href={`/book?service=${service.id}`}>
                  <Button className="w-full mt-2" size="sm">Book This Service</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
