import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, DollarSign, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white font-heading">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#2a2520] bg-[#141414]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#8a8478]">Today&apos;s Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white font-heading">0</div>
            <p className="text-xs text-[#5a5448]">No bookings yet</p>
          </CardContent>
        </Card>
        <Card className="border-[#2a2520] bg-[#141414]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#8a8478]">Active Stylists</CardTitle>
            <Users className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white font-heading">0</div>
            <p className="text-xs text-[#5a5448]">No stylists added</p>
          </CardContent>
        </Card>
        <Card className="border-[#2a2520] bg-[#141414]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#8a8478]">Revenue Today</CardTitle>
            <DollarSign className="h-4 w-4 text-crimson" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white font-heading">P0.00</div>
            <p className="text-xs text-[#5a5448]">No transactions yet</p>
          </CardContent>
        </Card>
        <Card className="border-[#2a2520] bg-[#141414]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#8a8478]">Total Customers</CardTitle>
            <TrendingUp className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white font-heading">0</div>
            <p className="text-xs text-[#5a5448]">Grow your client base</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
