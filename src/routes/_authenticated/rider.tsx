import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatKES } from "@/lib/fare";
import { toast } from "sonner";
import { Bike, MapPin, Navigation, PackageCheck } from "lucide-react";
import { StatusPill } from "@/routes/_authenticated/dashboard";

export const Route = createFileRoute("/_authenticated/rider")({
  head: () => ({ meta: [{ title: "Rider portal · Urban Courier" }] }),
  component: RiderPortal,
});

type Order = {
  id: string; order_number: string; status: string; rider_id: string | null;
  pickup_address: string; dropoff_address: string; fare_kes: number;
  pickup_lat: number; pickup_lng: number; dropoff_lat: number; dropoff_lng: number;
  payment_status: string;
};

function RiderPortal() {
  const [rider, setRider] = useState<{ approved: boolean; online: boolean } | null>(null);
  const [available, setAvailable] = useState<Order[]>([]);
  const [active, setActive] = useState<Order[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);
    const { data: r } = await supabase.from("riders").select("approved, online").eq("id", u.user.id).maybeSingle();
    setRider(r as any);
    const { data: avail } = await supabase
      .from("orders").select("*")
      .is("rider_id", null).eq("payment_status", "success")
      .order("created_at", { ascending: true }).limit(20);
    setAvailable((avail ?? []) as Order[]);
    const { data: mine } = await supabase
      .from("orders").select("*")
      .eq("rider_id", u.user.id).not("status", "in", "(delivered,cancelled)")
      .order("created_at", { ascending: false });
    setActive((mine ?? []) as Order[]);
  }

  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, []);

  async function setOnline(v: boolean) {
    if (!userId) return;
    const { error } = await supabase.from("riders").update({ online: v }).eq("id", userId);
    if (error) return toast.error(error.message);
    setRider((r) => r ? { ...r, online: v } : r);
    if (v) shareLocation();
  }

  function shareLocation() {
    if (!navigator.geolocation || !userId) return;
    navigator.geolocation.watchPosition(
      (pos) => {
        supabase.from("riders").update({
          current_lat: pos.coords.latitude, current_lng: pos.coords.longitude,
        }).eq("id", userId);
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }

  async function accept(orderId: string) {
    if (!userId) return;
    const { error } = await supabase.from("orders").update({
      rider_id: userId, status: "rider_assigned",
    }).eq("id", orderId).is("rider_id", null);
    if (error) return toast.error(error.message);
    toast.success("Job accepted!");
    load();
  }

  async function updateStatus(orderId: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    load();
  }

  if (rider && !rider.approved) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 container-page py-16 text-center">
          <Bike className="size-12 mx-auto text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-display font-bold text-navy">Pending approval</h1>
          <p className="text-muted-foreground mt-2">Our team is reviewing your rider application.</p>
        </main>
      </div>
    );
  }
  if (!rider) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 container-page py-16 text-center">
          <h1 className="text-2xl font-display font-bold text-navy">You're not registered as a rider</h1>
          <p className="text-muted-foreground mt-2">Apply to start earning.</p>
          <Link to="/become-rider"><Button className="btn-emerald mt-5">Apply now</Button></Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-navy">Rider portal</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{rider.online ? "You're online" : "Offline"}</span>
            <Switch checked={rider.online} onCheckedChange={setOnline} />
          </div>
        </div>

        <Section title="Active jobs">
          {active.length === 0 ? <Empty msg="No active jobs" /> : (
            <div className="space-y-3">
              {active.map((o) => (
                <div key={o.id} className="card-surface p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-mono text-muted-foreground">{o.order_number}</div>
                      <div className="font-semibold mt-1">{o.pickup_address} → {o.dropoff_address}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-navy font-display font-bold">{formatKES(o.fare_kes)}</div>
                      <StatusPill status={o.status} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.pickup_lat},${o.pickup_lng}&travelmode=driving`}>
                      <Button variant="outline" size="sm"><Navigation className="size-3.5 mr-1.5"/>To pickup</Button>
                    </a>
                    <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.dropoff_lat},${o.dropoff_lng}&travelmode=driving`}>
                      <Button variant="outline" size="sm"><Navigation className="size-3.5 mr-1.5"/>To dropoff</Button>
                    </a>
                    {["heading_to_pickup","picked_up","in_transit","out_for_delivery","delivered"].map((s) => (
                      <Button key={s} size="sm" onClick={() => updateStatus(o.id, s)} className={s === "delivered" ? "btn-emerald" : "btn-navy"}>
                        {s === "delivered" ? <><PackageCheck className="size-3.5 mr-1.5"/>Mark delivered</> : "Mark " + s.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Available jobs">
          {!rider.online ? <Empty msg="Go online to see available jobs." /> : available.length === 0 ? <Empty msg="No jobs available right now" /> : (
            <div className="space-y-3">
              {available.map((o) => (
                <div key={o.id} className="card-surface p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-muted-foreground">{o.order_number}</div>
                    <div className="font-semibold truncate">{o.pickup_address} → {o.dropoff_address}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-navy font-display font-bold">{formatKES(o.fare_kes)}</div>
                  </div>
                  <Button onClick={() => accept(o.id)} className="btn-emerald">Accept</Button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-8"><h2 className="text-lg font-display font-semibold mb-3">{title}</h2>{children}</section>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="card-surface p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
