import Link from "next/link";
import { Scissors, LayoutDashboard, Calendar, Image, MessageSquare } from "lucide-react";

const stylistNav = [
  { href: "/stylist", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stylist/schedule", label: "My Schedule", icon: Calendar },
  { href: "/stylist/portfolio", label: "Portfolio", icon: Image },
  { href: "/stylist/reviews", label: "Reviews", icon: MessageSquare },
];

export default function StylistLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <aside className="hidden w-64 border-r border-[#2a2520] bg-[#0f0f0f] lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-[#2a2520] px-6">
          <Scissors className="h-5 w-5 text-gold" />
          <span className="font-heading font-bold tracking-wider text-white">STYLIST</span>
        </div>
        <nav className="space-y-1 p-4">
          {stylistNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[#8a8478] hover:bg-[#1a1714] hover:text-gold transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b border-[#2a2520] px-6">
          <h2 className="text-lg font-semibold text-white font-heading">Stylist Portal</h2>
          <Link href="/" className="text-xs tracking-widest uppercase text-[#8a8478] hover:text-gold transition-colors">
            Back to site
          </Link>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
