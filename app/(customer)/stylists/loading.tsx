import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function StylistsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-9 w-48 bg-muted rounded animate-pulse" />
        <div className="h-5 w-56 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="flex gap-2">
                <div className="h-8 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-8 flex-1 bg-muted rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
