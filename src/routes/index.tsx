import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateFare, formatKES, haversineKm, type DeliveryType } from "@/lib/fare";
import {
  Truck, MapPin, CreditCard, Bike, PackageCheck, ShieldCheck,
  Zap, Clock, Star, ArrowRight, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Urban Courier — Fast Nairobi delivery, paid with M-Pesa" },
      {
        name: "description",
        content:
          "Send packages anywhere in Nairobi in minutes. Live tracking, fixed fares, M-Pesa STK push.",
      },
      { property: "og:title", content: "Urban Courier — Nairobi delivery" },
      {
        property: "og:description",
        content: "Same-day motorbike delivery across Nairobi with live tracking and M-Pesa.",
      },
    ],
  }),
  component: Home,
});

const ESTATES = [
  "CBD","Westlands","Kilimani","Kileleshwa","South B","South C","Embakasi","Umoja",
  "Kasarani","Roysambu","Zimmerman","Rongai","Karen","Ruaka","Syokimau","Kitengela","Ngong",
];

// Rough estate centroids for quick demo distance estimate
const ESTATE_COORDS: Record<string, { lat: number; lng: number }> = {
  CBD: { lat: -1.2864, lng: 36.8172 },
  Westlands: { lat: -1.2676, lng: 36.8108 },
  Kilimani: { lat: -1.2906, lng: 36.782 },
  Kileleshwa: { lat: -1.2772, lng: 36.7795 },
  "South B": { lat: -1.3094, lng: 36.8331 },
  "South C": { lat: -1.3196, lng: 36.8244 },
  Embakasi: { lat: -1.3247, lng: 36.8939 },
  Umoja: { lat: -1.2833, lng: 36.8917 },
  Kasarani: { lat: -1.2204, lng: 36.8965 },
  Roysambu: { lat: -1.2192, lng: 36.8856 },
  Zimmerman: { lat: -1.2128, lng: 36.8939 },
  Rongai: { lat: -1.3933, lng: 36.7426 },
  Karen: { lat: -1.3194, lng: 36.7077 },
  Ruaka: { lat: -1.2089, lng: 36.7779 },
  Syokimau: { lat: -1.3611, lng: 36.9261 },
  Kitengela: { lat: -1.4737, lng: 36.9596 },
  Ngong: { lat: -1.3526, lng: 36.6529 },
};

function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <FareCalculator />
        <HowItWorks />
        <Coverage />
        <Testimonials />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(60% 60% at 70% 0%, color-mix(in oklab, var(--emerald) 22%, transparent), transparent 60%), radial-gradient(70% 70% at 0% 30%, color-mix(in oklab, var(--navy) 18%, transparent), transparent 60%)",
        }}
      />
      <div className="container-page py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="pill">
            <Zap className="size-3.5" /> Live in Nairobi
          </span>
          <h1 className="mt-5 text-5xl lg:text-6xl font-bold leading-[1.05] text-navy">
            Fast, affordable delivery <span className="text-emerald">across Nairobi.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl">
            Send packages anywhere in the city in minutes. Pin pickup &amp; drop on the
            map, pay via M-Pesa STK push, and follow your rider live.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/book">
              <Button className="btn-emerald h-12 px-6 text-base">
                Book delivery <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline" className="h-12 px-6 text-base">
                Track order
              </Button>
            </Link>
            <Link to="/become-rider">
              <Button variant="ghost" className="h-12 px-6 text-base">
                Become a rider
              </Button>
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
            <Stat value="<30m" label="Avg pickup" />
            <Stat value="17+" label="Estates" />
            <Stat value="4.9★" label="Rider rating" />
          </div>
        </div>
        <HeroCard />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-display font-bold text-navy">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function HeroCard() {
  return (
    <div className="card-surface p-6 shadow-elevated">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Live in Nairobi right now</div>
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald font-semibold">
          <span className="size-2 rounded-full bg-emerald animate-pulse" /> active
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {[
          { from: "CBD", to: "Westlands", status: "Out for delivery", fare: 410 },
          { from: "Kilimani", to: "Karen", status: "Rider picked up", fare: 580 },
          { from: "South B", to: "Embakasi", status: "Heading to pickup", fare: 320 },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-navy text-navy-foreground grid place-items-center">
                <Bike className="size-4" />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {row.from} <ArrowRight className="inline size-3" /> {row.to}
                </div>
                <div className="text-xs text-muted-foreground">{row.status}</div>
              </div>
            </div>
            <div className="text-sm font-semibold text-navy">{formatKES(row.fare)}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-emerald" /> Insured deliveries · Verified riders · M-Pesa secure
      </div>
    </div>
  );
}

function FareCalculator() {
  const [pickup, setPickup] = useState("CBD");
  const [dropoff, setDropoff] = useState("Westlands");
  const [weight, setWeight] = useState(2);
  const [type, setType] = useState<DeliveryType>("standard");

  const km = haversineKm(ESTATE_COORDS[pickup], ESTATE_COORDS[dropoff]) || 0;
  const fare = calculateFare({ distanceKm: km, weightKg: weight, deliveryType: type });

  return (
    <section id="fare" className="container-page py-16">
      <div className="grid md:grid-cols-5 gap-8 items-center card-surface p-8 shadow-elevated">
        <div className="md:col-span-3 space-y-4">
          <h2 className="text-3xl font-bold text-navy">Instant fare estimate</h2>
          <p className="text-muted-foreground">
            Get a price in seconds. Full address pinning happens at checkout.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Select label="Pickup estate" value={pickup} onChange={setPickup} options={ESTATES} />
            <Select label="Dropoff estate" value={dropoff} onChange={setDropoff} options={ESTATES} />
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Package weight (kg)
              </label>
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
              <label className="text-xs font-semibold text-muted-foreground">Delivery type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DeliveryType)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="express">Express (+200)</option>
                <option value="same_day">Same day (+100)</option>
                <option value="scheduled">Scheduled (+80)</option>
              </select>
            </div>
          </div>
        </div>
        <div className="md:col-span-2 rounded-lg bg-navy text-navy-foreground p-6 space-y-4">
          <div className="text-xs uppercase tracking-wider text-emerald font-bold">
            Estimated fare
          </div>
          <div className="text-5xl font-display font-bold">{formatKES(fare.total)}</div>
          <div className="flex items-center justify-between text-sm border-t border-white/10 pt-3">
            <span className="opacity-80">Distance</span>
            <span className="font-semibold">{km.toFixed(1)} km</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="opacity-80">ETA</span>
            <span className="font-semibold">{fare.etaMinutes} min</span>
          </div>
          <Link to="/book">
            <Button className="btn-emerald w-full h-11 mt-2">Book this delivery</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

const STEPS = [
  { icon: MapPin, title: "Book delivery", body: "Pin pickup and drop on the map and add package details." },
  { icon: CreditCard, title: "Pay via M-Pesa", body: "Approve the STK push prompt on your phone." },
  { icon: Bike, title: "Rider picks up", body: "The nearest verified rider accepts and heads to pickup." },
  { icon: Truck, title: "Track live", body: "Follow the rider on the map in real time, end to end." },
  { icon: PackageCheck, title: "Delivered", body: "Photo + recipient signature proof, every time." },
];

function HowItWorks() {
  return (
    <section id="how" className="container-page py-16">
      <div className="text-center max-w-2xl mx-auto">
        <span className="pill">How it works</span>
        <h2 className="text-3xl md:text-4xl font-bold text-navy mt-3">
          From booking to delivered in five simple steps
        </h2>
      </div>
      <div className="mt-12 grid md:grid-cols-5 gap-4">
        {STEPS.map((s, i) => (
          <div key={i} className="card-surface p-6 relative">
            <div className="size-10 rounded-lg bg-navy text-navy-foreground grid place-items-center">
              <s.icon className="size-5" />
            </div>
            <div className="absolute top-4 right-4 text-xs font-bold text-muted-foreground">
              0{i + 1}
            </div>
            <h3 className="mt-4 font-display font-semibold">{s.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Coverage() {
  const [q, setQ] = useState("");
  const filtered = ESTATES.filter((e) => e.toLowerCase().includes(q.toLowerCase()));
  return (
    <section id="coverage" className="container-page py-16">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div>
          <span className="pill">Coverage</span>
          <h2 className="text-3xl font-bold text-navy mt-3">17+ Nairobi estates and growing</h2>
          <p className="text-muted-foreground mt-3">
            From CBD pickups to Karen drop-offs and Kitengela same-day. Search to confirm
            your area is covered today.
          </p>
          <Input
            placeholder="Search for your estate…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-5 max-w-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filtered.map((e) => (
            <span
              key={e}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium"
            >
              <CheckCircle2 className="size-3.5 text-emerald" /> {e}
            </span>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Not in our covered list yet — contact us and we'll dispatch a rider.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    { name: "Wanjiku M.", role: "Online shop owner",
      quote: "Same-day deliveries used to be impossible. Urban Courier handles all my orders now." },
    { name: "Brian K.", role: "Restaurant manager",
      quote: "Fast pickup, friendly riders, and the M-Pesa flow just works." },
    { name: "Achieng O.", role: "Customer",
      quote: "Sent legal docs from CBD to Karen in 38 minutes. Tracked live the whole way." },
  ];
  return (
    <section className="bg-secondary/50 py-20">
      <div className="container-page">
        <div className="text-center max-w-2xl mx-auto">
          <span className="pill">Trusted by Nairobi</span>
          <h2 className="text-3xl md:text-4xl font-bold text-navy mt-3">
            What customers and riders say
          </h2>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {items.map((t, i) => (
            <div key={i} className="card-surface p-6">
              <div className="flex gap-1 text-warning">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="size-4 fill-current" />
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed">"{t.quote}"</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="size-9 rounded-full bg-navy text-navy-foreground grid place-items-center font-semibold text-sm">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
                <Clock className="ml-auto size-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
