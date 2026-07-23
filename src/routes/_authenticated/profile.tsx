import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKES } from "@/lib/fare";
import { toast } from "sonner";
import { Copy, LogOut, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile · Urban Courier" }] }),
  component: ProfilePage,
});

type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  referral_code: string | null;
  credits_kes: number;
};

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, referral_code, credits_kes")
      .eq("id", u.user.id)
      .maybeSingle();
    const p = data as Profile | null;
    setProfile(p);
    setFullName(p?.full_name ?? "");
    setPhone(p?.phone ?? "");
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function copyReferral() {
    if (!profile?.referral_code) return;
    navigator.clipboard.writeText(profile.referral_code);
    toast.success("Referral code copied");
  }

  return (
    <div className="container-page py-8 space-y-6 max-w-2xl">
      <PageHeader title="Profile" subtitle="Manage your account and referral rewards." />

      {!profile ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="card-surface p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-navy text-navy-foreground grid place-items-center">
                <User className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-semibold text-navy truncate">
                  {profile.full_name || "Anonymous"}
                </div>
                <div className="text-sm text-muted-foreground truncate">{profile.email}</div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="mt-1"
                />
              </div>
            </div>

            <Button onClick={save} disabled={busy} className="btn-emerald h-11">
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card-surface p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Wallet credit
              </div>
              <div className="mt-1 text-2xl font-display font-bold text-navy">
                {formatKES(profile.credits_kes)}
              </div>
            </div>
            <div className="card-surface p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Referral code
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-display font-bold text-navy">
                  {profile.referral_code ?? "—"}
                </span>
                {profile.referral_code && (
                  <Button size="sm" variant="ghost" onClick={copyReferral}>
                    <Copy className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="card-surface p-5 flex items-center justify-between">
            <div>
              <div className="font-semibold">Sign out</div>
              <div className="text-sm text-muted-foreground">End your session on this device.</div>
            </div>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="size-4 mr-1.5" /> Sign out
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
