import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ServicesLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-9 w-48 bg-muted rounded animate-pulse" />
        <div className="h-5 w-72 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded animate-pulse" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
              <div className="h-9 w-full bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
