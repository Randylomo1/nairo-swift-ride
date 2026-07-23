import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { formatKES } from "@/lib/fare";
import { StatusPill } from "@/components/StatusPill";
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  LifeBuoy,
  Package,
  Plus,
  RefreshCw,
  Wallet,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Urban Courier" }] }),
  component: Dashboard,
});

export { StatusPill };

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  fare_kes: number;
  created_at: string;
  payment_status: string;
  scheduled_for: string | null;
  archived_by_customer: boolean;
};

type Profile = {
  full_name: string;
  referral_code: string | null;
  credits_kes: number;
};

const TERMINAL = new Set(["delivered", "cancelled"]);

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    const roles = ((rolesData ?? []) as { role: string }[]).map((r) => r.role);
    if (roles.includes("admin")) return navigate({ to: "/admin" });
    if (roles.includes("rider")) return navigate({ to: "/rider" });

    // Best-effort auto-expire stale payments
    await supabase.rpc("expire_stale_payments").catch(() => null);

    const [p, o, n] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, referral_code, credits_kes")
        .eq("id", u.user.id)
        .maybeSingle(),
      supabase
        .from("orders")
        .select(
          "id, order_number, status, pickup_address, dropoff_address, fare_kes, created_at, payment_status, scheduled_for, archived_by_customer"
        )
        .eq("customer_id", u.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null),
    ]);
    setProfile(p.data as Profile | null);
    setOrders((o.data ?? []) as OrderRow[]);
    setUnreadCount(n.count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    load();
    const ch = supabase
      .channel("orders-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (mounted) load();
      })
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => orders.filter((o) => !o.archived_by_customer), [orders]);
  const active = visible.filter(
    (o) => !TERMINAL.has(o.status) && o.payment_status === "success"
  );
  const pendingPay = visible.filter(
    (o) => o.payment_status !== "success" && o.status !== "cancelled"
  );
  const scheduled = visible.filter((o) => !!o.scheduled_for && !TERMINAL.has(o.status));
  const completed = visible.filter((o) => o.status === "delivered");
  const cancelled = visible.filter((o) => o.status === "cancelled");
  const totalSpent = orders
    .filter((o) => o.payment_status === "success")
    .reduce((s, o) => s + Number(o.fare_kes), 0);

  return (
    <div className="container-page py-8 space-y-8">
      <PageHeader
        title={`Welcome${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        subtitle="Your deliveries and account at a glance."
        actions={
          <>
            <Link to="/book">
              <Button className="btn-emerald h-11 px-5">
                <Plus className="size-4 mr-1.5" /> New delivery
              </Button>
            </Link>
            <Button variant="outline" className="h-11" onClick={load}>
              <RefreshCw className="size-4 mr-1.5" /> Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Package} label="Active" value={active.length} tint="emerald" />
        <StatCard icon={Wallet} label="Pending payment" value={pendingPay.length} tint="warning" />
        <StatCard icon={Calendar} label="Scheduled" value={scheduled.length} tint="navy" />
        <StatCard icon={CheckCircle2} label="Completed" value={completed.length} tint="emerald" />
        <StatCard icon={XCircle} label="Cancelled" value={cancelled.length} tint="destructive" />
        <StatCard icon={Package} label="Total orders" value={orders.length} tint="navy" />
        <StatCard icon={Wallet} label="Total spent" value={formatKES(totalSpent)} tint="emerald" />
        <StatCard
          icon={Bell}
          label="Referral code"
          value={profile?.referral_code ?? "—"}
          tint="navy"
        />
      </div>

      {pendingPay.length > 0 && (
        <section className="card-surface p-5 border-l-4 border-warning">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-display font-semibold text-navy">Pending payments</h2>
              <p className="text-sm text-muted-foreground">
                {pendingPay.length} order{pendingPay.length > 1 ? "s" : ""} · {" "}
                {formatKES(pendingPay.reduce((s, o) => s + Number(o.fare_kes), 0))} due
              </p>
            </div>
            <Link to="/payment">
              <Button className="btn-emerald h-10 shrink-0">View all</Button>
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {pendingPay.slice(0, 3).map((o) => (
              <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <div className="min-w-0 truncate">
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {o.order_number}
                  </span>
                  {o.pickup_address} → {o.dropoff_address}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-display font-bold text-navy hidden sm:inline">
                    {formatKES(o.fare_kes)}
                  </span>
                  <Link to="/payment/$orderId" params={{ orderId: o.id }}>
                    <Button size="sm" className="btn-emerald">Pay now</Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid md:grid-cols-4 gap-3 text-sm">
        <QuickAction to="/book" icon={Plus} label="Book delivery" tint="emerald" />
        <QuickAction to="/orders" icon={Package} label="View orders" tint="navy" />
        <QuickAction to="/payment" icon={Wallet} label="View payments" tint="warning" />
        <QuickAction to="/support" icon={LifeBuoy} label="Contact support" tint="navy" />
      </section>

      <Section
        title="Active deliveries"
        cta={active.length ? { to: "/orders", label: "See all" } : undefined}
      >
        {loading ? (
          <Skeleton />
        ) : active.length === 0 ? (
          <Empty msg="No active deliveries. Book one to get started." />
        ) : (
          <OrderList orders={active.slice(0, 5)} />
        )}
      </Section>

      <Section
        title="Recent activity"
        cta={visible.length ? { to: "/orders", label: "View all" } : undefined}
      >
        {loading ? (
          <Skeleton />
        ) : visible.length === 0 ? (
          <Empty msg="Your orders will appear here." />
        ) : (
          <OrderList orders={visible.slice(0, 5)} />
        )}
      </Section>

      {unreadCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          You have {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}. {" "}
          <Link to="/notifications" className="underline text-emerald font-semibold">Open</Link>
        </p>
      )}
    </div>
  );
}

const TINTS: Record<string, string> = {
  emerald: "bg-emerald/10 text-emerald",
  navy: "bg-navy/10 text-navy",
  warning: "bg-warning/20 text-navy",
  destructive: "bg-destructive/10 text-destructive",
};

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tint: keyof typeof TINTS;
}) {
  return (
    <div className="card-surface p-4 flex items-center gap-3 min-w-0">
      <div className={"size-10 rounded-lg grid place-items-center shrink-0 " + TINTS[tint]}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-lg font-display font-bold text-navy truncate">{value}</div>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  tint,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  tint: keyof typeof TINTS;
}) {
  return (
    <Link
      to={to}
      className="card-surface p-4 flex items-center gap-3 hover:shadow-elevated transition min-w-0"
    >
      <div className={"size-10 rounded-lg grid place-items-center shrink-0 " + TINTS[tint]}>
        <Icon className="size-5" />
      </div>
      <div className="font-semibold text-navy truncate flex-1">{label}</div>
      <ArrowRight className="size-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

function Section({
  title,
  children,
  cta,
}: {
  title: string;
  children: React.ReactNode;
  cta?: { to: string; label: string };
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-display font-semibold">{title}</h2>
        {cta && (
          <Link to={cta.to} className="text-sm text-emerald font-semibold hover:underline">
            {cta.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function OrderList({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {orders.map((o) => {
        const unpaid = o.payment_status !== "success" && o.status !== "cancelled";
        return (
          <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-5 py-4 hover:bg-secondary/60 transition">
            <Link to="/track/$orderId" params={{ orderId: o.id }} className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="font-mono">{o.order_number}</span>
                <StatusPill status={o.status} />
                {unpaid && (
                  <span className="rounded-full bg-warning/30 text-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Unpaid
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm font-medium truncate">
                {o.pickup_address} → {o.dropoff_address}
              </div>
            </Link>
            <div className="text-right shrink-0 flex items-center gap-3">
              <div className="hidden sm:block">
                <div className="font-display font-bold text-navy">{formatKES(o.fare_kes)}</div>
              </div>
              {unpaid ? (
                <Link to="/payment/$orderId" params={{ orderId: o.id }}>
                  <Button size="sm" className="btn-emerald">Pay</Button>
                </Link>
              ) : (
                <Link to="/track/$orderId" params={{ orderId: o.id }}>
                  <Button size="sm" variant="outline">View</Button>
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="card-surface p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
function Skeleton() {
  return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>;
}
