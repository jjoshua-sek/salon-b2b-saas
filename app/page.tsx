import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, Star } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";

export default async function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <SiteNavbar />

      {/* Hero */}
      <main className="flex-1">
        <section className="relative container mx-auto flex flex-col items-center justify-center gap-8 px-4 py-32 text-center md:py-44">
          {/* Decorative circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-[#2a2520] opacity-30" />
          <p className="text-xs tracking-[0.4em] uppercase text-gold">Welcome to the experience</p>
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl font-heading">
            Your Best Look
            <span className="block text-crimson italic">Starts Here</span>
          </h1>
          <p className="max-w-lg text-lg text-[#8a8478] leading-relaxed">
            Book appointments, get AI-powered hairstyle recommendations, and discover your perfect stylist.
          </p>
          <div className="flex gap-4 mt-4">
            {/* /book is auth-gated by middleware; unauthenticated users get
                bounced to /login?redirect=/book and routed back after sign-in. */}
            <Link href="/book">
              <Button size="lg" className="bg-gold text-[#0a0a0a] hover:bg-gold-light tracking-wider uppercase text-xs font-semibold px-8 py-6">
                Book Now
              </Button>
            </Link>
            <Link href="/ai-recommend">
              <Button size="lg" variant="outline" className="border-[#2a2520] text-gold hover:bg-gold/10 hover:border-gold tracking-wider uppercase text-xs px-8 py-6">
                <Sparkles className="mr-2 h-4 w-4" />
                Try AI Styling
              </Button>
            </Link>
          </div>
        </section>

        {/* Divider */}
        <div className="container mx-auto px-4">
          <div className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
        </div>

        {/* Features */}
        <section className="py-24">
          <div className="container mx-auto grid gap-12 px-4 md:grid-cols-3">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30">
                <Calendar className="h-6 w-6 text-gold" />
              </div>
              <h3 className="text-lg font-semibold text-white font-heading">Easy Booking</h3>
              <p className="text-sm text-[#8a8478] leading-relaxed">
                Pick your stylist, choose a service, and book in seconds. Real-time availability, no double bookings.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-crimson/30">
                <Sparkles className="h-6 w-6 text-crimson" />
              </div>
              <h3 className="text-lg font-semibold text-white font-heading">AI Recommendations</h3>
              <p className="text-sm text-[#8a8478] leading-relaxed">
                Upload a photo and get personalized hairstyle suggestions based on your face shape and preferences.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30">
                <Star className="h-6 w-6 text-gold" />
              </div>
              <h3 className="text-lg font-semibold text-white font-heading">Loyalty Rewards</h3>
              <p className="text-sm text-[#8a8478] leading-relaxed">
                Earn points with every visit. Unlock bronze, silver, and gold tiers for exclusive discounts.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2a2520] py-8">
        <div className="container mx-auto flex flex-col items-center gap-2 px-4 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-[#8a8478]">Salon B2B SaaS</p>
          <p className="text-xs text-[#5a5448]">Prototype — 2026</p>
        </div>
      </footer>
    </div>
  );
}
