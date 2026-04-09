import Link from "next/link";
import { Scissors } from "lucide-react";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Scissors className="h-6 w-6" />
            <span className="text-xl font-bold">Salon</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/services" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Services
            </Link>
            <Link href="/stylists" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Stylists
            </Link>
            <Link href="/my-bookings" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              My Bookings
            </Link>
            <Link href="/my-loyalty" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Loyalty
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
