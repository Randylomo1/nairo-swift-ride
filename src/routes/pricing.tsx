import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DeliveryMap, type LocationPin } from "@/components/DeliveryMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateFare, formatKES, haversineKm, type DeliveryType } from "@/lib/fare";
import { Calculator, MapPin, Clock, Package } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing & fare estimate · Urban Courier" },
      { name: "description", content: "Estimate your Nairobi delivery cost in seconds — base fee, distance, weight, and delivery type." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [pickup, setPickup] = useState<LocationPin | null>(null);
  const [dropoff, setDropoff] = useState<LocationPin | null>(null);
  const [weight, setWeight] = useState(2);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("standard");

  const distanceKm = useMemo(
    () => (pickup && dropoff ? haversineKm(pickup, dropoff) : 0),
    [pickup, dropoff]
  );
  const fare = useMemo(
    () => calculateFare({ distanceKm, weightKg: weight, deliveryType }),
    [distanceKm, weight, deliveryType]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-10">
        <div className="flex items-center gap-3">
          <Calculator className="size-6 text-navy" />
          <h1 className="text-3xl font-display font-bold text-navy">Fare estimate</h1>
        </div>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Pin pickup and dropoff to see the live estimate. No booking required — when you're ready, hit "Book this delivery".
        </p>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 mt-6">
          <div className="card-surface overflow-hidden h-[420px] lg:h-[560px] relative">
            <DeliveryMap
              pickup={pickup}
              dropoff={dropoff}
              onPickupChange={setPickup}
              onDropoffChange={setDropoff}
              className="absolute inset-0"
            />
          </div>

          <div className="space-y-5">
            <div className="card-surface p-5 space-y-3">
              <Row icon={<MapPin className="size-4 text-navy" />} label="Pickup" value={pickup?.address ?? "Pin pickup on the map"} />
              <Row icon={<MapPin className="size-4 text-emerald" />} label="Dropoff" value={dropoff?.address ?? "Pin dropoff on the map"} />
              <Row icon={<Clock className="size-4 text-muted-foreground" />} label="Distance" value={distanceKm ? `${distanceKm.toFixed(1)} km` : "—"} />
            </div>

            <div className="card-surface p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Weight (kg)</Label>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Delivery type</Label>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {(["standard", "express", "same_day", "scheduled"] as DeliveryType[]).map((t) => (
                      <option key={t} value={t}>{t.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-navy text-navy-foreground p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-emerald font-bold">Estimated total</span>
                <span className="text-3xl font-display font-bold">{formatKES(fare.total)}</span>
              </div>
              <div className="text-xs opacity-80">ETA · {fare.etaMinutes} minutes</div>
              <div className="border-t border-white/10 my-3" />
              <Line label="Base fee" v={fare.base} />
              <Line label={`Distance · ${distanceKm.toFixed(1)} km`} v={fare.distance} />
              <Line label={`Weight · ${weight} kg`} v={fare.weight} />
              <Line label={`${deliveryType.replace("_", " ")} surcharge`} v={fare.typeSurcharge} />
            </div>

            <Link to="/book">
              <Button className="btn-emerald w-full h-12 text-base">
                <Package className="size-4 mr-2" /> Book this delivery
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{value}</div>
      </div>
    </div>
  );
}
function Line({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="opacity-80">{label}</span>
      <span>{formatKES(v)}</span>
    </div>
  );
}
