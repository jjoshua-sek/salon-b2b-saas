import { createClient } from "@/lib/supabase/server";
import ServiceFilter from "./service-filter";

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("name");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-heading">Our Services</h1>
        <p className="text-muted-foreground mt-1">Browse our full menu of hair services</p>
      </div>
      <ServiceFilter services={data ?? []} />
    </div>
  );
}
