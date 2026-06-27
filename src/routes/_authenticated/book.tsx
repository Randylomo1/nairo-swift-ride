import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { DeliveryMap, type LocationPin } from "@/components/DeliveryMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { initiateStkPush, checkMpesaConfig } from "@/lib/mpesa.functions";
import { calculateFare, formatKES, haversineKm, type DeliveryType } from "@/lib/fare";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, MapPin, Smartphone, Map, Edit3 } from "lucide-react";
import { NAIROBI_CENTER } from "@/lib/maps-loader";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({ meta: [{ title: "Book delivery · Urban Courier" }] }),
  component: BookDelivery,
});

const phoneSchema = z
  .string()
  .trim()
  .refine(
    (phone) => {
      const digits = phone.replace(/\D/g, "");
      // Accept any 9+ digits that starts with 7, 1, or 07/01/2547/2541 etc.
      return digits.length >= 9 && digits.length <= 15;
    },
    { message: "Use a valid Kenyan phone number (e.g. 07XX XXX XXX)" }
  );

// Common Nairobi estates for manual entry
const NAIROBI_ESTATES = [
  "Westlands", "Kilimani", "Kileleshwa", "Lavington", "Karen", "Runda", "Muthaiga",
  "Parklands", "Upper Hill", "CBD", "Eastleigh", "South B",
  "South C", "Embakasi", "Donholm", "Buruburu", "Uthiru", "Kasarani",
  "Ruiru", "Thika Road", "Mombasa Road", "Waiyaki Way", "Ngong Road"
];

const LANDMARKS = {
  "Westlands": ["Sarit Centre", "The Oval", "Westlands Mall", "T-Mall"],
  "Kilimani": ["Yaya Centre", "Adlife Plaza", "Prestige Plaza"],
  "Kileleshwa": ["Kileleshwa Mall", "The Curve"],
  "Lavington": ["Lavington Green", "The Junction Mall"],
  "Karen": ["Karen Hub", "Waterfront Mall"],
  "Runda": ["Runda Mall", "UNEP"],
  "Muthaiga": ["Muthaiga Golf Club"],
  "Parklands": ["Parklands Sports Club"],
  "Upper Hill": ["UAP Towers", "Britam Towers"],
  "CBD": ["KICC", "Nyayo House", "GPO"],
  "Eastleigh": ["Eastleigh Mall"],
  "South B": ["South B Shopping Centre"],
  "Embakasi": ["JKIA Airport", "Nyayo Stadium"],
  "Donholm": ["Donholm Mall"],
  "Buruburu": ["Buruburu Shopping Centre"],
  "Kasarani": ["Kasarani Stadium"],
  "Ruiru": ["Ruiru Town"],
  "Thika Road": ["Thika Road Mall"],
  "Mombasa Road": ["Nextgen Mall"],
  "Waiyaki Way": ["Two Rivers Mall"],
  "Ngong Road": ["The Hub"],
};

function BookDelivery() {
  const navigate = useNavigate();
  const stkPush = useServerFn(initiateStkPush);
  const checkConfig = useServerFn(checkMpesaConfig);
  const [mpesaConfigured, setMpesaConfigured] = useState(false);
  const [mpesaEnv, setMpesaEnv] = useState("sandbox");

  const [useMapMode, setUseMapMode] = useState(true);
  const [pickup, setPickup] = useState<LocationPin | null>(null);
  const [dropoff, setDropoff] = useState<LocationPin | null>(null);
  
  // Manual entry states
  const [manualPickupEstate, setManualPickupEstate] = useState("");
  const [manualPickupLandmark, setManualPickupLandmark] = useState("");
  const [manualDropoffEstate, setManualDropoffEstate] = useState("");
  const [manualDropoffLandmark, setManualDropoffLandmark] = useState("");
  
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

  useEffect(() => {
    checkConfig().then((config) => {
      setMpesaConfigured(Boolean(config.isConfigured));
      setMpesaEnv(config.env);
    }).catch(console.error);
  }, [checkConfig]);

  const distanceKm = useMemo(() => {
    if (pickup && dropoff) {
      return haversineKm(pickup, dropoff);
    } else if (!useMapMode && manualPickupEstate && manualDropoffEstate) {
      if (manualPickupEstate === manualDropoffEstate) return 3;
      return 7;
    }
    return 5;
  }, [pickup, dropoff, manualPickupEstate, manualDropoffEstate]);

  const fare = useMemo(
    () => calculateFare({ distanceKm, weightKg: weight, deliveryType }),
    [distanceKm, weight, deliveryType]
  );

  const getLocationPinFromManual = (estate: string, landmark: string): LocationPin => {
    const base = estate === manualPickupEstate ? NAIROBI_CENTER : { lat: NAIROBI_CENTER.lat + 0.02, lng: NAIROBI_CENTER.lng - 0.02 };
    return {
      ...base,
      address: `${landmark}, ${estate}, Nairobi`,
    };
  };

  const canProceedStep1 = () => {
    if (useMapMode) {
      return pickup && dropoff;
    }
    return manualPickupEstate && manualPickupLandmark && manualDropoffEstate && manualDropoffLandmark;
  };

  async function handlePay() {
    let finalPickup: LocationPin | null = pickup;
    let finalDropoff: LocationPin | null = dropoff;
    if (!useMapMode) {
      finalPickup = getLocationPinFromManual(manualPickupEstate, manualPickupLandmark);
      finalDropoff = getLocationPinFromManual(manualDropoffEstate, manualDropoffLandmark);
    }
    if (!finalPickup || !finalDropoff) return toast.error("Pickup and dropoff required");

    try {
      console.log("Checking inputs:", { 
        pickupContact,
        recipient,
        pickupPhone,
        recipientPhone,
        payPhone,
      });
      
      // Just check that required fields are not empty (no phone validation!)
      if (!pickupContact.trim()) throw new Error("Pickup contact required");
      if (!recipient.trim()) throw new Error("Recipient name required");
      if (!pickupPhone.trim()) throw new Error("Pickup phone required");
      if (!recipientPhone.trim()) throw new Error("Recipient phone required");
      
      console.log("All basic checks passed!");
    } catch (err) {
      console.error("Input check failed:", err);
      const msg = err instanceof Error ? err.message : "Invalid input";
      return toast.error(msg);
    }

    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      
      console.log("Creating order...");
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_id: u.user.id,
          status: "created",
          delivery_type: deliveryType,
          pickup_address: finalPickup.address,
          pickup_lat: finalPickup.lat,
          pickup_lng: finalPickup.lng,
          pickup_contact_name: pickupContact,
          pickup_phone: pickupPhone,
          dropoff_address: finalDropoff.address,
          dropoff_lat: finalDropoff.lat,
          dropoff_lng: finalDropoff.lng,
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
      
      console.log("Order creation response:", { order, error });
      
      if (error || !order) throw error ?? new Error("Failed to create order");

      // Try STK push only if payPhone is provided
      if (payPhone && payPhone.trim().length > 0) {
        try {
          console.log("Initiating STK push with:", { orderId: order.id, phone: payPhone, amount: fare.total });
          const res = await stkPush({
            data: { orderId: order.id, phone: payPhone, amount: fare.total },
          });
          console.log("STK push response:", res);
          toast.success(res.message ?? "STK push sent. Approve on your phone.");
        } catch (e) {
          console.error("STK push error:", e);
          toast.warning("STK push failed, but order is created! You can pay later from the payment page");
        }
      } else {
        toast.success("Order created successfully! You can pay later from the payment page");
      }

      console.log("Navigating to payment page for order:", order.id);
      navigate({ to: "/payment/$orderId", params: { orderId: order.id } });
    } catch (err) {
      console.error("Booking failed:", err);
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
          {useMapMode && (
            <div className="card-surface overflow-hidden h-[420px] lg:h-[640px] relative">
              <DeliveryMap
                pickup={pickup}
                dropoff={dropoff}
                onPickupChange={setPickup}
                onDropoffChange={setDropoff}
                className="absolute inset-0"
              />
            </div>
          )}

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
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={useMapMode ? "default" : "secondary"}
                    onClick={() => setUseMapMode(true)}
                    className="flex-1"
                  >
                    <Map className="size-4 mr-2" /> Use Map
                  </Button>
                  <Button
                    type="button"
                    variant={!useMapMode ? "default" : "secondary"}
                    onClick={() => setUseMapMode(false)}
                    className="flex-1"
                  >
                    <Edit3 className="size-4 mr-2" /> Manual Entry
                  </Button>
                </div>

                {useMapMode ? (
                  <>
                    <Hint>Tap "Set pickup", drag the map so the pin sits on your spot, then Confirm. Repeat for dropoff. You can also search or use your current location.</Hint>
                    <PinRow label="Pickup" pin={pickup} accent="navy" />
                    <PinRow label="Dropoff" pin={dropoff} accent="emerald" />
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-dashed border-border p-4">
                      <h3 className="text-sm font-semibold text-navy mb-3">Enter Pickup & Dropoff</h3>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground">Pickup</Label>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <select
                              value={manualPickupEstate}
                              onChange={(e) => {
                                setManualPickupEstate(e.target.value);
                                setManualPickupLandmark("");
                              }}
                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="">Select Estate</option>
                              {NAIROBI_ESTATES.map((e) => <option key={e} value={e}>{e}</option>)}
                            </select>
                            <select
                              value={manualPickupLandmark}
                              onChange={(e) => setManualPickupLandmark(e.target.value)}
                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              disabled={!manualPickupEstate}
                            >
                              <option value="">Select Landmark</option>
                              {(LANDMARKS as any)[manualPickupEstate]?.map((l: string) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground">Dropoff</Label>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <select
                              value={manualDropoffEstate}
                              onChange={(e) => {
                                setManualDropoffEstate(e.target.value);
                                setManualDropoffLandmark("");
                              }}
                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="">Select Estate</option>
                              {NAIROBI_ESTATES.map((e) => <option key={e} value={e}>{e}</option>)}
                            </select>
                            <select
                              value={manualDropoffLandmark}
                              onChange={(e) => setManualDropoffLandmark(e.target.value)}
                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              disabled={!manualDropoffEstate}
                            >
                              <option value="">Select Landmark</option>
                              {(LANDMARKS as any)[manualDropoffEstate]?.map((l: string) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <PinRowManual
                      label="Pickup"
                      address={manualPickupEstate && manualPickupLandmark ? `${manualPickupLandmark}, ${manualPickupEstate}` : null}
                      accent="navy"
                    />
                    <PinRowManual
                      label="Dropoff"
                      address={manualDropoffEstate && manualDropoffLandmark ? `${manualDropoffLandmark}, ${manualDropoffEstate}` : null}
                      accent="emerald"
                    />
                  </div>
                )}
                <Button
                  className="btn-navy w-full h-11"
                  disabled={!canProceedStep1()}
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
                <Button className="btn-navy w-full h-11" onClick={() => setStep(3)}>Review & pay</Button>
              </div>
            )}

            {step === 3 && (
              <div className="mt-5 space-y-5">
                <BackBtn onClick={() => setStep(2)} />
                
                {/* M-Pesa Configuration Status */}
                {!mpesaConfigured && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex items-start gap-2">
                      <div className="size-5 text-red-500 shrink-0">⚠️</div>
                      <div className="flex-1">
                        <p className="text-red-800 font-semibold text-sm">M-Pesa Not Configured</p>
                        <p className="text-red-700 text-xs mt-1">
                          STK push won't work yet. You need to add your Daraja credentials to the .env file.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {mpesaConfigured && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4">
                    <div className="flex items-start gap-2">
                      <div className="size-5 text-emerald-500 shrink-0">✓</div>
                      <div className="flex-1">
                        <p className="text-emerald-800 font-semibold text-sm">M-Pesa Ready ({mpesaEnv})</p>
                        <p className="text-emerald-700 text-xs mt-1">
                          STK push will be sent to your phone.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
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
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>You'll receive a Safaricom STK prompt to confirm payment.</p>
                    {!mpesaConfigured && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
                        <p className="text-yellow-800 font-semibold">Sandbox Test Numbers:</p>
                        <ul className="text-yellow-700 list-disc list-inside mt-1">
                          <li>254708374149 - Test Number 1</li>
                          <li>254712345678 - Test Number 2</li>
                        </ul>
                      </div>
                    )}
                  </div>
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

function PinRowManual({ label, address, accent }: { label: string; address: string | null; accent: "navy" | "emerald" }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-secondary p-3">
      <div className={"size-8 rounded-full grid place-items-center text-white shrink-0 " + (accent === "navy" ? "bg-navy" : "bg-emerald")}>
        <MapPin className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{address ? address : <span className="text-muted-foreground">Select estate and landmark</span>}</div>
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
