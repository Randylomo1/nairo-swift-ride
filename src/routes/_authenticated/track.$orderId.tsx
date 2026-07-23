import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { DeliveryMap } from "@/components/DeliveryMap";
import { StatusPill } from "@/routes/_authenticated/dashboard";
import { formatKES } from "@/lib/fare";
import { ArrowLeft, Bike, CheckCircle2, Clock, Phone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/track/$orderId")({
  head: () => ({ meta: [{ title: "Track delivery · Urban Courier" }] }),
  component: TrackOrder,
});

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  recipient_name: string;
  recipient_phone: string;
  fare_kes: number;
  distance_km: number;
  eta_minutes: number;
  mpesa_receipt: string | null;
  rider_id: string | null;
};

const TIMELINE: { key: string; label: string }[] = [
  { key: "created", label: "Order created" },
  { key: "payment_pending", label: "Awaiting M-Pesa confirmation" },
  { key: "paid", label: "Payment received" },
  { key: "rider_assigned", label: "Rider assigned" },
  { key: "heading_to_pickup", label: "Rider heading to pickup" },
  { key: "picked_up", label: "Package picked up" },
  { key: "in_transit", label: "In transit" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

function TrackOrder() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("orders").select("*").eq("id", orderId).maybeSingle();
      if (mounted) setOrder(data as Order | null);
      if (data?.rider_id) {
        const { data: r } = await supabase.from("riders")
          .select("current_lat, current_lng").eq("id", data.rider_id).maybeSingle();
        if (mounted && r?.current_lat && r?.current_lng) {
          setRiderPos({ lat: Number(r.current_lat), lng: Number(r.current_lng) });
        }
      }
    }
    load();
    // Realtime updates
    const ch = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          if (!mounted) return;
          setOrder((prev) => ({ ...(prev as Order), ...(payload.new as Order) }));
        }
      )
      .subscribe();
    const poll = setInterval(load, 12000);
    return () => { mounted = false; supabase.removeChannel(ch); clearInterval(poll); };
  }, [orderId]);

  if (!order) {
    return (
      <div className="min-h-screen">
        
        <main className="flex-1 grid place-items-center text-muted-foreground">Loading…</main>
      </div>
    );
  }

  const currentIdx = Math.max(0, TIMELINE.findIndex((t) => t.key === order.status));
  const pickup = { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng), address: order.pickup_address };
  const dropoff = { lat: Number(order.dropoff_lat), lng: Number(order.dropoff_lng), address: order.dropoff_address };

  return (
    <div className="min-h-screen">
      
      <main className="flex-1 container-page py-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
        {order.payment_status !== "success" && order.status !== "cancelled" && (
          <div className="mt-4 card-surface p-4 border-l-4 border-emerald flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display font-semibold text-navy">Payment required</div>
              <div className="text-sm text-muted-foreground">Complete M-Pesa payment to dispatch a rider.</div>
            </div>
            <Link to="/payment/$orderId" params={{ orderId: order.id }}>
              <button className="btn-emerald h-10 px-4 rounded-md text-sm font-semibold">Continue to payment</button>
            </Link>
          </div>
        )}
        <div className="mt-4 grid lg:grid-cols-[1.3fr_1fr] gap-6">
          <div className="card-surface overflow-hidden h-[420px] lg:h-[620px] relative">
            <DeliveryMap
              pickup={pickup}
              dropoff={dropoff}
              riderPosition={riderPos}
              onPickupChange={() => {}}
              onDropoffChange={() => {}}
              readonly
              className="absolute inset-0"
            />
          </div>

          <div className="space-y-5">
            <div className="card-surface p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-mono">{order.order_number}</div>
                  <div className="mt-1 text-lg font-display font-bold text-navy">{formatKES(order.fare_kes)}</div>
                </div>
                <StatusPill status={order.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 text-center divide-x divide-border border-y border-border py-3">
                <Stat label="Distance" value={`${Number(order.distance_km).toFixed(1)} km`} />
                <Stat label="ETA" value={`${order.eta_minutes} min`} />
                <Stat label="Payment" value={order.payment_status} />
              </div>
              {order.mpesa_receipt && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald font-semibold">
                  <CheckCircle2 className="size-4" /> M-Pesa receipt: {order.mpesa_receipt}
                </div>
              )}
            </div>

            <div className="card-surface p-5">
              <h3 className="font-display font-semibold mb-3">Recipient</h3>
              <div className="text-sm">{order.recipient_name}</div>
              <a href={`tel:${order.recipient_phone}`} className="inline-flex items-center gap-1.5 text-sm text-emerald font-semibold mt-1">
                <Phone className="size-4" /> {order.recipient_phone}
              </a>
            </div>

            <div className="card-surface p-5">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <Clock className="size-4" /> Live progress
              </h3>
              <ol className="space-y-3">
                {TIMELINE.map((t, i) => {
                  const done = i <= currentIdx;
                  return (
                    <li key={t.key} className="flex items-center gap-3">
                      <span className={"size-6 rounded-full grid place-items-center text-[10px] font-bold " + (done ? "bg-emerald text-white" : "bg-secondary text-muted-foreground")}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={"text-sm " + (done ? "text-foreground font-medium" : "text-muted-foreground")}>{t.label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-1 capitalize">{value}</div>
    </div>
  );
}
