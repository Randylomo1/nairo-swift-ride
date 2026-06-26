import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { formatKES } from "@/lib/fare";
import { Wallet } from "lucide-react";

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
  created_at: string;
};

function PaymentsList() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return setRows([]);
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, pickup_address, dropoff_address, fare_kes, payment_status, status, created_at")
        .eq("customer_id", u.user.id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as Row[]);
    })();
  }, []);

  const pending = (rows ?? []).filter((r) => r.payment_status !== "success" && r.status !== "cancelled");
  const paid = (rows ?? []).filter((r) => r.payment_status === "success");

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-10">
        <div className="flex items-center gap-3">
          <Wallet className="size-6 text-navy" />
          <h1 className="text-3xl font-display font-bold text-navy">Payments</h1>
        </div>
        <p className="text-muted-foreground mt-1">Settle pending deliveries and view past M-Pesa receipts.</p>

        <section className="mt-8">
          <h2 className="text-lg font-display font-semibold mb-3">Pending payments</h2>
          {rows === null ? (
            <Card>Loading…</Card>
          ) : pending.length === 0 ? (
            <Card>No outstanding payments.</Card>
          ) : (
            <div className="space-y-3">
              {pending.map((r) => (
                <div key={r.id} className="card-surface p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">{r.order_number}</div>
                    <div className="text-sm font-medium truncate">{r.pickup_address} → {r.dropoff_address}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{r.payment_status}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-display font-bold text-navy">{formatKES(r.fare_kes)}</div>
                    <Link to="/payment/$orderId" params={{ orderId: r.id }}>
                      <Button className="btn-emerald h-9">Pay now</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-display font-semibold mb-3">Paid</h2>
          {rows === null ? null : paid.length === 0 ? (
            <Card>No payments yet.</Card>
          ) : (
            <div className="card-surface divide-y divide-border overflow-hidden">
              {paid.map((r) => (
                <Link key={r.id} to="/track/$orderId" params={{ orderId: r.id }} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-secondary/60">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">{r.order_number}</div>
                    <div className="text-sm font-medium truncate">{r.pickup_address} → {r.dropoff_address}</div>
                  </div>
                  <div className="font-display font-bold text-navy">{formatKES(r.fare_kes)}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card-surface p-6 text-sm text-muted-foreground text-center">{children}</div>;
}
