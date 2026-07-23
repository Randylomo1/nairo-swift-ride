import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import { formatKES } from "@/lib/fare";
import { Plus, RefreshCw, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/payment/")({
  head: () => ({ meta: [{ title: "Payments · Urban Courier" }] }),
  component: PaymentsList,
});

type Row = {
  id: string;
  order_number: string;
  pickup_address: string;
  dropoff_address: string;
  fare_kes: number;
  payment_status: string;
  status: string;
  mpesa_receipt: string | null;
  created_at: string;
};

type Bucket = "pending" | "success" | "cancelled" | "expired" | "failed";
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "success", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "failed", label: "Failed" },
  { key: "expired", label: "Expired" },
];

function PaymentsList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<Bucket>("pending");

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setRows([]);
    await supabase.rpc("expire_stale_payments").catch(() => null);
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_number, pickup_address, dropoff_address, fare_kes, payment_status, status, mpesa_receipt, created_at"
      )
      .eq("customer_id", u.user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("payments-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const buckets = useMemo(() => {
    const all = rows ?? [];
    return {
      pending: all.filter((r) => r.payment_status === "pending" && r.status !== "cancelled"),
      success: all.filter((r) => r.payment_status === "success"),
      cancelled: all.filter((r) => r.payment_status === "cancelled" || r.status === "cancelled"),
      failed: all.filter((r) => r.payment_status === "failed"),
      expired: all.filter((r) => r.payment_status === "expired"),
    } as Record<Bucket, Row[]>;
  }, [rows]);

  const list = buckets[tab];

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Settle pending deliveries and view past M-Pesa receipts."
        actions={
          <>
            <Button variant="outline" className="h-10" onClick={load}>
              <RefreshCw className="size-4 mr-1.5" /> Refresh
            </Button>
            <Link to="/book">
              <Button className="btn-emerald h-10">
                <Plus className="size-4 mr-1.5" /> Book delivery
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex gap-1 overflow-x-auto -mx-4 px-4">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            onClick={() => setTab(b.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition border",
              tab === b.key
                ? "bg-navy text-navy-foreground border-navy"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {b.label}
            <span className="ml-1.5 opacity-70">{buckets[b.key].length}</span>
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : list.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <Wallet className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nothing in {tab}.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((o) => (
            <li key={o.id} className="card-surface p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">{o.order_number}</span>
                    <StatusPill status={o.payment_status} />
                  </div>
                  <div className="mt-1 text-sm font-medium truncate">
                    {o.pickup_address} → {o.dropoff_address}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(o.created_at).toLocaleString()}
                    {o.mpesa_receipt && ` · receipt ${o.mpesa_receipt}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-bold text-navy">{formatKES(o.fare_kes)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(tab === "pending" || tab === "cancelled" || tab === "failed" || tab === "expired") &&
                  o.status !== "cancelled" && (
                    <Link to="/payment/$orderId" params={{ orderId: o.id }}>
                      <Button size="sm" className="btn-emerald">
                        {tab === "pending" ? "Complete payment" : "Retry payment"}
                      </Button>
                    </Link>
                  )}
                <Link to="/track/$orderId" params={{ orderId: o.id }}>
                  <Button size="sm" variant="outline">View order</Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
