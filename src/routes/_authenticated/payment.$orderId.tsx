import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { initiateStkPush, checkPaymentStatus } from "@/lib/mpesa.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payment/$orderId")({
  head: () => ({
    meta: [{ title: "Payment · Urban Courier" }],
  }),
  component: PaymentPage,
});

type PaymentStatus = "pending" | "processing" | "success" | "failed" | "cancelled" | "expired";
type OrderStatus = "created" | "payment_pending" | "paid" | "rider_assigned" | "heading_to_pickup" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "cancelled";

type Order = {
  id: string;
  order_number: string;
  pickup_address: string;
  dropoff_address: string;
  distance_km: number | null;
  fare_kes: number;
  payment_status: PaymentStatus | null;
  status: OrderStatus;
  mpesa_receipt: string | null;
};


function PaymentPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const stkPush = useServerFn(initiateStkPush);
  const checkStatus = useServerFn(checkPaymentStatus);
  const [order, setOrder] = useState<Order | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, pickup_address, dropoff_address, distance_km, fare_kes, payment_status, status, mpesa_receipt")
        .eq("id", orderId)
        .maybeSingle();
      setOrder((data as Order) ?? null);
      const { data: u } = await supabase.auth.getUser();
      const ph = (u.user?.user_metadata as { phone?: string } | undefined)?.phone;
      if (ph) setPhone(ph);
      setLoading(false);
    })();
  }, [orderId]);

  // Poll while waiting for callback
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      const res = await checkStatus({ data: { orderId } });
      if (
res &&
        ((res.payment_status as any) === "success" ||
          (res.payment_status as any) === "failed" ||
          (res.payment_status as any) === "cancelled" ||
          (res.payment_status as any) === "expired")
      ) {
        setWaiting(false);
        setOrder((prev) => (prev ? { ...prev, ...res } as Order : prev));
        if (res.payment_status === "success") {
          toast.success("Payment successful");
          setTimeout(() => navigate({ to: "/track/$orderId", params: { orderId } }), 800);
        } else {
toast.error(`Payment ${res.payment_status as any}. You can retry.`);
        }
      }
    }, 3000);
    return () => clearInterval(t);
  }, [waiting, orderId, checkStatus, navigate]);


  async function pay() {
    if (!order) return;
    const clean = phone.replace(/\D+/g, "");
    if (clean.length < 9) {
      toast.error("Enter a valid M-Pesa phone number");
      return;
    }
    setPaying(true);
    try {
      const res = await stkPush({
        data: { orderId: order.id, phone: clean, amount: Math.round(order.fare_kes) },
      });
      toast.success(res.message ?? "STK push sent. Approve on your phone.");
      setWaiting(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen">
      
      <main className="flex-1 container-page py-8">
        <div className="max-w-xl mx-auto card-surface p-6">
          <h1 className="text-2xl font-display font-bold text-navy">Pay for your delivery</h1>
          {loading ? (
            <p className="mt-4 text-muted-foreground">Loading order…</p>
          ) : !order ? (
            <p className="mt-4 text-destructive">Order not found.</p>
          ) : (
            <>
              <div className="mt-5 space-y-2 text-sm">
                <Row label="Order #" value={order.order_number} />
                <Row label="Pickup" value={order.pickup_address} />
                <Row label="Dropoff" value={order.dropoff_address} />
                <Row label="Distance" value={order.distance_km ? `${order.distance_km.toFixed(1)} km` : "—"} />
                <Row label="Amount" value={`KES ${Math.round(order.fare_kes).toLocaleString()}`} />
                <Row label="Status" value={order.payment_status ?? "unpaid"} />
                {order.mpesa_receipt && <Row label="Receipt" value={order.mpesa_receipt} />}
              </div>

              {order.payment_status === "success" ? (
                <div className="mt-6 rounded-lg bg-emerald/10 p-4 text-emerald">
                  Payment successful. Redirecting to tracking…
                </div>
              ) : order.payment_status === "cancelled" || order.payment_status === "failed" || order.payment_status === "expired" ? (
                <div className="mt-6 space-y-3">
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
                    <div className="font-semibold text-destructive">Payment {order.payment_status}</div>
                    <div className="text-sm text-muted-foreground mt-1">You can retry the request.</div>
                  </div>
                  <Button
                    onClick={pay}
                    disabled={paying || waiting}
                    className="btn-emerald w-full h-11"
                  >
                    {paying ? "Sending STK push…" : "Retry payment"}
                  </Button>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  <div>
                    <Label htmlFor="phone">M-Pesa phone number</Label>
                    <Input
                      id="phone"
                      inputMode="tel"
                      placeholder="07XX XXX XXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
disabled={waiting || paying}
                      className="mt-1"
                    />
                  </div>

                  <div className="rounded-lg bg-warning/10 border border-warning/30 p-4">
                    <div className="font-semibold text-navy">Waiting for M-Pesa Confirmation…</div>
                    <div className="text-sm text-muted-foreground mt-1">If you cancel from your phone, this request will be marked accordingly.</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const res = await checkStatus({ data: { orderId } });
                        if (!res) return;
                        setOrder((prev) => (prev ? { ...prev, ...res } as Order : prev));
                        if ((res.payment_status as any) === "success") {
                          toast.success("Payment successful");
                          setTimeout(
                            () => navigate({ to: "/track/$orderId", params: { orderId } }),
                            800
                          );
                        }
                      }}

                      disabled={paying || waiting}
                    >
                      Refresh Status
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm("Cancel this payment request?")) return;
await supabase.from("payments").update({ status: "cancelled" as any }).eq("order_id", order.id);
                        await supabase.from("orders").update({ payment_status: "cancelled" as any, status: "created" }).eq("id", order.id);
                        setWaiting(false);
setOrder((prev) => (prev ? { ...prev, payment_status: "cancelled" as any, status: "created" } as Order : prev));
                        toast.success("Payment request cancelled");
                      }}
                      disabled={paying || waiting}
                    >
                      Cancel Request
                    </Button>
                  </div>

                  <Button
                    onClick={pay}
                    disabled={paying || waiting}
                    className="btn-emerald w-full h-11"
                  >
                    {waiting ? "Waiting for payment…" : paying ? "Sending STK push…" : "Pay with M-Pesa"}
                  </Button>
                </div>
              )}

            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
