import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/StatusPill";
import { formatKES } from "@/lib/fare";
import { toast } from "sonner";
import { Archive, Package, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "Orders · Urban Courier" }] }),
  component: OrdersPage,
});

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  pickup_address: string;
  dropoff_address: string;
  fare_kes: number;
  created_at: string;
  scheduled_for: string | null;
  archived_by_customer: boolean;
  rider_id: string | null;
  recipient_name: string | null;
};

type Tab =
  | "all"
  | "pending_payment"
  | "awaiting_rider"
  | "active"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "expired";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending_payment", label: "Pending payment" },
  { key: "awaiting_rider", label: "Awaiting rider" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "expired", label: "Expired" },
];

const ACTIVE_STATES = new Set([
  "rider_assigned",
  "heading_to_pickup",
  "picked_up",
  "in_transit",
  "out_for_delivery",
]);

function OrdersPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setLoading(false);
    try { await (supabase.rpc as any)("expire_stale_payments"); } catch {}
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, pickup_address, dropoff_address, fare_kes, created_at, scheduled_for, archived_by_customer, rider_id, recipient_name"
      )
      .eq("customer_id", u.user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Order[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("orders-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    const base = rows.filter((r) => showArchived || !r.archived_by_customer);
    const bucket = base.filter((r) => matchTab(r, tab));
    if (!q.trim()) return bucket;
    const needle = q.trim().toLowerCase();
    return bucket.filter(
      (r) =>
        r.order_number.toLowerCase().includes(needle) ||
        r.pickup_address.toLowerCase().includes(needle) ||
        r.dropoff_address.toLowerCase().includes(needle) ||
        (r.recipient_name ?? "").toLowerCase().includes(needle)
    );
  }, [rows, tab, q, showArchived]);

  const counts = useMemo(() => {
    const base = rows.filter((r) => showArchived || !r.archived_by_customer);
    const map: Record<Tab, number> = {
      all: base.length,
      pending_payment: 0,
      awaiting_rider: 0,
      active: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
      expired: 0,
    };
    for (const r of base) {
      for (const t of TABS) if (t.key !== "all" && matchTab(r, t.key)) map[t.key]++;
    }
    return map;
  }, [rows, showArchived]);

  async function onCancel(order: Order) {
    if (!confirm(`Cancel order ${order.order_number}?`)) return;
    const { data, error } = await supabase.rpc("cancel_order", {
      _order_id: order.id,
      _reason: "Customer cancelled",
    });
    if (error) return toast.error(error.message);
    if (data === true) {
      toast.success("Order cancelled");
      load();
    } else toast.error("This order can no longer be cancelled");
  }

  async function onArchive(order: Order) {
    const { data, error } = await supabase.rpc("archive_order", { _order_id: order.id });
    if (error) return toast.error(error.message);
    if (data === true) {
      toast.success("Order archived");
      load();
    }
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Orders"
        subtitle="Every delivery you've booked."
        actions={
          <Link to="/book">
            <Button className="btn-emerald h-11 px-5">
              <Plus className="size-4 mr-1.5" /> New delivery
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search order #, estate, recipient"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition border",
              tab === t.key
                ? "bg-navy text-navy-foreground border-navy"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {t.label}
            <span className="ml-1.5 opacity-70">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <Package className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No orders in this view.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} onCancel={onCancel} onArchive={onArchive} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onCancel,
  onArchive,
}: {
  order: Order;
  onCancel: (o: Order) => void;
  onArchive: (o: Order) => void;
}) {
  const canCancel =
    !order.rider_id && order.payment_status !== "success" && order.status !== "cancelled";
  const canRetry =
    ["cancelled", "failed", "expired"].includes(order.payment_status) &&
    order.status !== "cancelled";
  const canPay = order.payment_status === "pending" && order.status !== "cancelled";
  const canArchive = ["delivered", "cancelled"].includes(order.status) && !order.archived_by_customer;

  return (
    <div className="card-surface p-4 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground">{order.order_number}</span>
            <StatusPill status={order.status} />
            <StatusPill status={order.payment_status} />
          </div>
          <div className="mt-1.5 text-sm font-medium truncate">
            {order.pickup_address} → {order.dropoff_address}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {new Date(order.created_at).toLocaleString()}
            {order.scheduled_for && ` · scheduled ${new Date(order.scheduled_for).toLocaleString()}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display font-bold text-navy">{formatKES(order.fare_kes)}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/track/$orderId" params={{ orderId: order.id }}>
          <Button size="sm" variant="outline">View</Button>
        </Link>
        {canPay && (
          <Link to="/payment/$orderId" params={{ orderId: order.id }}>
            <Button size="sm" className="btn-emerald">Pay now</Button>
          </Link>
        )}
        {canRetry && (
          <Link to="/payment/$orderId" params={{ orderId: order.id }}>
            <Button size="sm" className="btn-emerald">Retry payment</Button>
          </Link>
        )}
        {canCancel && (
          <Button size="sm" variant="destructive" onClick={() => onCancel(order)}>
            <Trash2 className="size-3.5 mr-1.5" /> Cancel
          </Button>
        )}
        {canArchive && (
          <Button size="sm" variant="outline" onClick={() => onArchive(order)}>
            <Archive className="size-3.5 mr-1.5" /> Archive
          </Button>
        )}
      </div>
    </div>
  );
}

function matchTab(o: Order, tab: Tab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "pending_payment":
      return o.payment_status === "pending" && o.status !== "cancelled";
    case "awaiting_rider":
      return o.payment_status === "success" && !o.rider_id && o.status !== "delivered" && o.status !== "cancelled";
    case "active":
      return ACTIVE_STATES.has(o.status);
    case "scheduled":
      return !!o.scheduled_for && !["delivered", "cancelled"].includes(o.status);
    case "completed":
      return o.status === "delivered";
    case "cancelled":
      return o.status === "cancelled";
    case "expired":
      return o.payment_status === "expired";
  }
}
