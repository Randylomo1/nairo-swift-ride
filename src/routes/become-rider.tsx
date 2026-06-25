import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bike, ShieldCheck, Banknote, Zap, Upload, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/become-rider")({
  head: () => ({
    meta: [
      { title: "Become a rider · Urban Courier" },
      { name: "description", content: "Earn money delivering across Nairobi on your own schedule." },
    ],
  }),
  component: BecomeRider,
});

function BecomeRider() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [nationalId, setNationalId] = useState("");
  const [bike, setBike] = useState("");
  const [license, setLicense] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<{ approved: boolean; id_photo_url: string | null; license_photo_url: string | null } | null>(null);

  async function refresh(uid: string) {
    const { data } = await supabase.from("riders").select("approved, id_photo_url, license_photo_url").eq("id", uid).maybeSingle();
    setExisting(data as any);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUser({ id: data.user.id });
      refresh(data.user.id);
    });
  }, []);

  async function uploadDoc(uid: string, file: File, kind: "id" | "license") {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${uid}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("rider-documents").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!nationalId || !bike || !license) return toast.error("All fields required");
    if (!idFile || !licenseFile) return toast.error("Upload both ID and license photos");
    setSubmitting(true);
    try {
      const [idPath, licPath] = await Promise.all([
        uploadDoc(user.id, idFile, "id"),
        uploadDoc(user.id, licenseFile, "license"),
      ]);
      const { error } = await supabase.from("riders").upsert({
        id: user.id,
        national_id: nationalId,
        bike_registration: bike,
        license_number: license,
        id_photo_url: idPath,
        license_photo_url: licPath,
      });
      if (error) throw error;
      toast.success("Application submitted! We'll review within 24 hours.");
      await refresh(user.id);
    } catch (err: any) {
      toast.error(err.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-12 grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <span className="pill"><Zap className="size-3.5" /> Ride with us</span>
          <h1 className="mt-4 text-4xl font-display font-bold text-navy">
            Earn money delivering across Nairobi.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            Bring your own bike and license, set your own hours, and get paid instantly to your M-Pesa.
          </p>
          <ul className="mt-6 space-y-4">
            {[
              { i: Banknote, t: "Daily M-Pesa payouts", b: "Get your earnings the same day, no waiting." },
              { i: Bike, t: "You own your schedule", b: "Go online when you want, offline when you're done." },
              { i: ShieldCheck, t: "Insured deliveries", b: "Every shift, every drop." },
            ].map((f, i) => (
              <li key={i} className="flex gap-4">
                <div className="size-10 rounded-lg bg-accent text-navy grid place-items-center"><f.i className="size-5"/></div>
                <div>
                  <div className="font-semibold">{f.t}</div>
                  <div className="text-sm text-muted-foreground">{f.b}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card-surface p-6 shadow-elevated">
          <h2 className="text-xl font-display font-bold text-navy">Apply to ride</h2>
          {!user ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">Create an account or sign in to apply.</p>
              <Link to="/auth"><Button className="btn-navy w-full h-11">Sign in to continue</Button></Link>
            </div>
          ) : existing?.approved ? (
            <div className="mt-6 text-center space-y-3 py-8">
              <CheckCircle2 className="size-10 mx-auto text-emerald" />
              <h3 className="font-display font-semibold">You're approved</h3>
              <Link to="/rider"><Button className="btn-emerald">Open rider portal</Button></Link>
            </div>
          ) : existing ? (
            <div className="mt-6 text-center space-y-3 py-8">
              <ShieldCheck className="size-10 mx-auto text-emerald" />
              <h3 className="font-display font-semibold">Application under review</h3>
              <p className="text-sm text-muted-foreground">We'll notify you once approved (usually within 24 hours).</p>
              <Link to="/rider"><Button variant="outline">Open rider portal</Button></Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div><Label htmlFor="nid">National ID number</Label><Input id="nid" value={nationalId} onChange={(e) => setNationalId(e.target.value)} className="mt-1"/></div>
              <div><Label htmlFor="bike">Bike registration (e.g. KMDA 123X)</Label><Input id="bike" value={bike} onChange={(e) => setBike(e.target.value)} className="mt-1"/></div>
              <div><Label htmlFor="lic">Driver's license number</Label><Input id="lic" value={license} onChange={(e) => setLicense(e.target.value)} className="mt-1"/></div>

              <FileField label="ID photo (front)" file={idFile} onChange={setIdFile} />
              <FileField label="Driver's license photo" file={licenseFile} onChange={setLicenseFile} />

              <Button disabled={submitting} type="submit" className="btn-emerald w-full h-11">
                {submitting ? "Submitting…" : "Submit application"}
              </Button>
              <p className="text-xs text-muted-foreground">Photos are private and only visible to you and our review team.</p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function FileField({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <label className="mt-1 flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-border px-4 py-3 hover:bg-secondary/40">
        <Upload className="size-4 text-muted-foreground" />
        <span className="text-sm truncate">{file ? file.name : "Choose photo (JPG/PNG, max 5 MB)"}</span>
        <input
          type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 5 * 1024 * 1024) return alert("Max 5 MB");
            onChange(f);
          }}
        />
      </label>
    </div>
  );
}
