import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { formatKES } from "@/lib/fare";
import { ArrowRight, Package, Plus, Wallet, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · Urban Courier" }],
  }),
  component: Dashboard,
});

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  fare_kes: number;
  created_at: string;
  payment_status: string;
};

type Profile = {
  full_name: string;
  referral_code: string | null;
  credits_kes: number;
};

function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [p, o] = await Promise.all([
        supabase.from("profiles").select("full_name, referral_code, credits_kes").eq("id", u.user.id).maybeSingle(),
        supabase.from("orders").select("id, order_number, status, pickup_address, dropoff_address, fare_kes, created_at, payment_status").order("created_at", { ascending: false }).limit(20),
      ]);
      if (!mounted) return;
      setProfile(p.data as Profile | null);
      setOrders((o.data ?? []) as OrderRow[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const active = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const completed = orders.filter((o) => o.status === "delivered");

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-navy">
              Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-muted-foreground mt-1">Your deliveries and account at a glance.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/book"><Button className="btn-emerald h-11 px-5"><Plus className="size-4 mr-1.5"/>New delivery</Button></Link>
            <Button variant="outline" className="h-11" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>Sign out</Button>
          </div>
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <StatCard icon={Package} label="Active deliveries" value={active.length.toString()} />
          <StatCard icon={Wallet} label="Wallet credit" value={formatKES(profile?.credits_kes ?? 0)} />
          <StatCard icon={Users} label="Referral code" value={profile?.referral_code ?? "—"} />
        </div>

        <Section title="Active deliveries">
          {loading ? <Skeleton /> : active.length === 0 ? <Empty msg="No active deliveries. Book one to get started." /> : <OrderList orders={active} />}
        </Section>

        <Section title="Completed deliveries">
          {loading ? <Skeleton /> : completed.length === 0 ? <Empty msg="Your completed deliveries will appear here." /> : <OrderList orders={completed} />}
        </Section>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="card-surface p-5 flex items-center gap-4">
      <div className="size-11 rounded-lg bg-accent grid place-items-center text-navy">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-display font-bold text-navy">{value}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-display font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function OrderList({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {orders.map((o) => (
        <Link
          key={o.id}
          to="/track/$orderId"
          params={{ orderId: o.id }}
          className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-secondary/60 transition"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{o.order_number}</span>
              <StatusPill status={o.status} />
            </div>
            <div className="mt-1 text-sm font-medium truncate">
              {o.pickup_address} → {o.dropoff_address}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display font-bold text-navy">{formatKES(o.fare_kes)}</div>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              View <ArrowRight className="size-3" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    created: "bg-muted text-muted-foreground",
    payment_pending: "bg-warning/20 text-navy",
    paid: "bg-accent text-accent-foreground",
    rider_assigned: "bg-accent text-accent-foreground",
    heading_to_pickup: "bg-accent text-accent-foreground",
    picked_up: "bg-accent text-accent-foreground",
    in_transit: "bg-accent text-accent-foreground",
    out_for_delivery: "bg-accent text-accent-foreground",
    delivered: "bg-emerald/20 text-emerald",
    cancelled: "bg-destructive/20 text-destructive",
  };
  return (
    <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " + (map[status] ?? "bg-muted")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="card-surface p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
function Skeleton() {
  return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>;
}
