import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { DeliveryMap, type LocationPin } from "@/components/DeliveryMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { initiateStkPush } from "@/lib/mpesa.functions";
import { calculateFare, formatKES, haversineKm, type DeliveryType } from "@/lib/fare";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, MapPin, Package, Phone, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({ meta: [{ title: "Book delivery · Urban Courier" }] }),
  component: BookDelivery,
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^(?:\+?254|0)?(7|1)\d{8}$/, "Use a valid Kenyan number (07.. or 2547..)");

function BookDelivery() {
  const navigate = useNavigate();
  const stkPush = useServerFn(initiateStkPush);

  const [pickup, setPickup] = useState<LocationPin | null>(null);
  const [dropoff, setDropoff] = useState<LocationPin | null>(null);
  const [pickupContact, setPickupContact] = useState("");
  const [pickupPhone, setPickupPhone] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [category, setCategory] = useState("Documents");
  const [weight, setWeight] = useState(2);
  const [size, setSize] = useState("Small");
  const [fragile, setFragile] = useState(false);
  const [notes, setNotes] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("standard");
  const [payPhone, setPayPhone] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  const distanceKm = useMemo(
    () => (pickup && dropoff ? haversineKm(pickup, dropoff) : 0),
    [pickup, dropoff]
  );
  const fare = useMemo(
    () => calculateFare({ distanceKm, weightKg: weight, deliveryType }),
    [distanceKm, weight, deliveryType]
  );

  async function handlePay() {
    if (!pickup || !dropoff) return toast.error("Pin both pickup and dropoff");
    try {
      phoneSchema.parse(pickupPhone);
      phoneSchema.parse(recipientPhone);
      phoneSchema.parse(payPhone);
      if (!pickupContact.trim()) throw new Error("Pickup contact required");
      if (!recipient.trim()) throw new Error("Recipient name required");
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Invalid input";
      return toast.error(msg);
    }

    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_id: u.user.id,
          status: "created",
          delivery_type: deliveryType,
          pickup_address: pickup.address,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          pickup_contact_name: pickupContact,
          pickup_phone: pickupPhone,
          dropoff_address: dropoff.address,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          recipient_name: recipient,
          recipient_phone: recipientPhone,
          package_category: category,
          package_weight_kg: weight,
          package_size: size,
          fragile,
          notes,
          distance_km: Number(distanceKm.toFixed(2)),
          eta_minutes: fare.etaMinutes,
          fare_kes: fare.total,
        })
        .select("id")
        .single();
      if (error || !order) throw error ?? new Error("Failed to create order");

      const res = await stkPush({
        data: { orderId: order.id, phone: payPhone, amount: fare.total },
      });
      toast.success(res.message ?? "STK push sent. Approve on your phone.");
      navigate({ to: "/track/$orderId", params: { orderId: order.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-8">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
          {/* Map */}
          <div className="card-surface overflow-hidden h-[420px] lg:h-[640px] relative">
            <DeliveryMap
              pickup={pickup}
              dropoff={dropoff}
              onPickupChange={setPickup}
              onDropoffChange={setDropoff}
              className="absolute inset-0"
            />
          </div>

          {/* Form */}
          <div className="card-surface p-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-display font-bold text-navy">Book a delivery</h1>
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={"size-2 rounded-full " + (n <= step ? "bg-emerald" : "bg-border")}
                  />
                ))}
              </div>
            </div>

            {step === 1 && (
              <div className="mt-5 space-y-4">
                <Hint>Tap the map to pin pickup, then dropoff (toggle the buttons on top of the map).</Hint>
                <PinRow label="Pickup" pin={pickup} accent="navy" />
                <PinRow label="Dropoff" pin={dropoff} accent="emerald" />
                <Button
                  className="btn-navy w-full h-11"
                  disabled={!pickup || !dropoff}
                  onClick={() => setStep(2)}
                >
                  Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="mt-5 space-y-4">
                <BackBtn onClick={() => setStep(1)} />
                <div className="grid grid-cols-2 gap-3">
                  <FieldLbl label="Pickup contact"><Input value={pickupContact} onChange={(e) => setPickupContact(e.target.value)} /></FieldLbl>
                  <FieldLbl label="Pickup phone"><Input value={pickupPhone} placeholder="07.." onChange={(e) => setPickupPhone(e.target.value)} /></FieldLbl>
                  <FieldLbl label="Recipient name"><Input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></FieldLbl>
                  <FieldLbl label="Recipient phone"><Input value={recipientPhone} placeholder="07.." onChange={(e) => setRecipientPhone(e.target.value)} /></FieldLbl>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FieldLbl label="Category">
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {["Documents", "Food", "Clothing", "Electronics", "Groceries", "Other"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </FieldLbl>
                  <FieldLbl label="Weight (kg)"><Input type="number" min={0.5} step={0.5} value={weight} onChange={(e) => setWeight(Number(e.target.value) || 0)} /></FieldLbl>
                  <FieldLbl label="Size">
                    <select value={size} onChange={(e) => setSize(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {["Small", "Medium", "Large"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </FieldLbl>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={fragile} onChange={(e) => setFragile(e.target.checked)} /> Fragile package
                </label>
                <FieldLbl label="Notes (optional)"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></FieldLbl>
                <FieldLbl label="Delivery type">
                  <div className="grid grid-cols-2 gap-2">
                    {(["standard", "express", "same_day", "scheduled"] as DeliveryType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDeliveryType(t)}
                        className={
                          "rounded-md border px-3 py-2 text-sm font-semibold capitalize transition " +
                          (deliveryType === t ? "border-emerald bg-emerald text-emerald-foreground" : "border-border hover:bg-secondary")
                        }
                      >
                        {t.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </FieldLbl>
                <Button className="btn-navy w-full h-11" onClick={() => setStep(3)}>Review &amp; pay</Button>
              </div>
            )}

            {step === 3 && (
              <div className="mt-5 space-y-5">
                <BackBtn onClick={() => setStep(2)} />
                <FareBreakdownView distance={distanceKm} weight={weight} type={deliveryType} fare={fare} />
                <div>
                  <Label htmlFor="payPhone" className="flex items-center gap-2">
                    <Smartphone className="size-4" /> M-Pesa phone number
                  </Label>
                  <Input
                    id="payPhone"
                    placeholder="07XX XXX XXX"
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">You'll receive a Safaricom STK prompt to confirm payment.</p>
                </div>
                <Button onClick={handlePay} disabled={submitting} className="btn-emerald w-full h-12 text-base">
                  {submitting ? "Sending STK push…" : `Pay ${formatKES(fare.total)} via M-Pesa`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function PinRow({ label, pin, accent }: { label: string; pin: LocationPin | null; accent: "navy" | "emerald" }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-secondary p-3">
      <div className={"size-8 rounded-full grid place-items-center text-white shrink-0 " + (accent === "navy" ? "bg-navy" : "bg-emerald")}>
        <MapPin className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{pin ? pin.address : <span className="text-muted-foreground">Tap the map to pin</span>}</div>
      </div>
    </div>
  );
}
function FieldLbl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground bg-secondary rounded-md p-3 leading-relaxed">{children}</p>;
}
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3.5" /> Back
    </button>
  );
}
function FareBreakdownView({ distance, weight, type, fare }: { distance: number; weight: number; type: DeliveryType; fare: ReturnType<typeof calculateFare> }) {
  const rows = [
    ["Base fee", fare.base],
    [`Distance · ${distance.toFixed(1)} km`, fare.distance],
    [`Weight · ${weight} kg`, fare.weight],
    [`${type.replace("_", " ")} surcharge`, fare.typeSurcharge],
  ];
  return (
    <div className="rounded-lg bg-navy text-navy-foreground p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-emerald font-bold">Total</span>
        <span className="text-3xl font-display font-bold">{formatKES(fare.total)}</span>
      </div>
      <div className="text-xs opacity-80">ETA · {fare.etaMinutes} minutes</div>
      <div className="border-t border-white/10 my-3" />
      {rows.map(([l, v]) => (
        <div key={l as string} className="flex justify-between text-sm">
          <span className="opacity-80">{l}</span><span>{formatKES(v as number)}</span>
        </div>
      ))}
    </div>
  );
}
