import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { formatKES } from "@/lib/fare";
import { toast } from "sonner";
import { ShieldCheck, Bike, Package, Users, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { StatusPill } from "@/routes/_authenticated/dashboard";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · Urban Courier" }] }),
  component: AdminPanel,
});

type RiderRow = {
  id: string;
  national_id: string | null;
  bike_registration: string | null;
  license_number: string | null;
  id_photo_url: string | null;
  license_photo_url: string | null;
  approved: boolean;
  total_deliveries: number;
};

type OrderRow = {
  id: string; order_number: string; status: string; payment_status: string;
  pickup_address: string; dropoff_address: string; fare_kes: number;
  customer_id: string; rider_id: string | null; created_at: string;
};

function AdminPanel() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<"riders" | "orders">("riders");
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  async function checkAdmin() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setIsAdmin(false); setChecking(false); return; }
    const { data, error } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (error) { setIsAdmin(false); setChecking(false); return; }
    setIsAdmin(data === true);
    setChecking(false);
  }

  async function claim() {
    const { data, error } = await supabase.rpc("claim_first_admin");
    if (error) return toast.error(error.message);
    if (data === true) { toast.success("You're now the admin."); checkAdmin(); }
    else toast.error("An admin already exists. Ask them to grant you access.");
  }

  async function load() {
    const [r, o] = await Promise.all([
      supabase.from("riders").select("id, national_id, bike_registration, license_number, id_photo_url, license_photo_url, approved, total_deliveries").order("created_at", { ascending: false }),
      supabase.from("orders").select("id, order_number, status, payment_status, pickup_address, dropoff_address, fare_kes, customer_id, rider_id, created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setRiders((r.data ?? []) as RiderRow[]);
    setOrders((o.data ?? []) as OrderRow[]);
  }

  useEffect(() => { checkAdmin(); }, []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function setApproved(id: string, approved: boolean) {
    const { error } = await supabase.from("riders").update({ approved }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approved ? "Rider approved" : "Approval revoked");
    if (approved) {
      // Ensure they have a rider role
      await supabase.from("user_roles").upsert({ user_id: id, role: "rider" } as any, { onConflict: "user_id,role" });
    }
    load();
  }

  async function viewDoc(path: string | null) {
    if (!path) return;
    const { data, error } = await supabase.storage.from("rider-documents").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function cancelOrder(id: string) {
    if (!confirm("Cancel this order?")) return;
    const { error } = await supabase.from("orders").update({ status: "cancelled" } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Order cancelled");
    load();
  }

  if (checking) {
    return <Shell><div className="card-surface p-8 text-center text-sm text-muted-foreground">Checking access…</div></Shell>;
  }
  if (!isAdmin) {
    return (
      <Shell>
        <div className="card-surface p-8 text-center max-w-md mx-auto">
          <ShieldCheck className="size-10 mx-auto text-navy" />
          <h2 className="mt-3 text-xl font-display font-bold text-navy">Admin access required</h2>
          <p className="text-sm text-muted-foreground mt-2">If no admin exists yet, the first signed-in user can claim it.</p>
          <Button className="btn-navy mt-4" onClick={claim}>Claim admin role</Button>
          <div className="mt-4"><Link to="/dashboard" className="text-sm text-muted-foreground underline">Back to dashboard</Link></div>
        </div>
      </Shell>
    );
  }

  const pendingCount = riders.filter((r) => !r.approved).length;
  const activeOrders = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-navy">Admin control</h1>
          <p className="text-muted-foreground mt-1">Approve riders and oversee active deliveries.</p>
        </div>
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <Stat icon={Bike} label="Pending riders" value={pendingCount.toString()} />
        <Stat icon={Package} label="Active orders" value={activeOrders.toString()} />
        <Stat icon={Users} label="Total riders" value={riders.length.toString()} />
      </div>

      <div className="mt-8 flex gap-2 border-b border-border">
        <TabBtn active={tab === "riders"} onClick={() => setTab("riders")}>Riders</TabBtn>
        <TabBtn active={tab === "orders"} onClick={() => setTab("orders")}>Orders</TabBtn>
      </div>

      {tab === "riders" ? (
        <section className="mt-6 space-y-3">
          {riders.length === 0 ? <Empty msg="No rider applications yet." /> : riders.map((r) => (
            <div key={r.id} className="card-surface p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</div>
                  <div className="font-semibold mt-1">Bike: {r.bike_registration ?? "—"}</div>
                  <div className="text-sm text-muted-foreground">ID: {r.national_id ?? "—"} · License: {r.license_number ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">{r.total_deliveries} deliveries completed</div>
                </div>
                <div className="text-right">
                  <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " + (r.approved ? "bg-emerald/20 text-emerald" : "bg-warning/20 text-navy")}>
                    {r.approved ? "Approved" : "Pending"}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!r.id_photo_url} onClick={() => viewDoc(r.id_photo_url)}><ExternalLink className="size-3.5 mr-1.5"/>ID photo</Button>
                <Button size="sm" variant="outline" disabled={!r.license_photo_url} onClick={() => viewDoc(r.license_photo_url)}><ExternalLink className="size-3.5 mr-1.5"/>License photo</Button>
                {r.approved ? (
                  <Button size="sm" variant="outline" onClick={() => setApproved(r.id, false)}><XCircle className="size-3.5 mr-1.5"/>Revoke</Button>
                ) : (
                  <Button size="sm" className="btn-emerald" onClick={() => setApproved(r.id, true)}><CheckCircle2 className="size-3.5 mr-1.5"/>Approve</Button>
                )}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="mt-6 space-y-3">
          {orders.length === 0 ? <Empty msg="No orders yet." /> : orders.map((o) => (
            <div key={o.id} className="card-surface p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{o.order_number}</span>
                  <StatusPill status={o.status} />
                  <span className="uppercase tracking-wider text-[10px] font-bold">{o.payment_status}</span>
                </div>
                <div className="mt-1 text-sm font-medium truncate">{o.pickup_address} → {o.dropoff_address}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-display font-bold text-navy">{formatKES(o.fare_kes)}</div>
                  <div className="text-xs text-muted-foreground">{o.rider_id ? "Assigned" : "Unassigned"}</div>
                </div>
                <Link to="/track/$orderId" params={{ orderId: o.id }}><Button size="sm" variant="outline">Track</Button></Link>
                {!["delivered", "cancelled"].includes(o.status) && (
                  <Button size="sm" variant="outline" onClick={() => cancelOrder(o.id)}>Cancel</Button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      
      <main className="flex-1 container-page py-10">{children}</main>
    </div>
  );
}
function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="card-surface p-5 flex items-center gap-4">
      <div className="size-11 rounded-lg bg-accent grid place-items-center text-navy"><Icon className="size-5"/></div>
      <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-display font-bold text-navy">{value}</div></div>
    </div>
  );
}
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={"px-4 py-2 text-sm font-semibold border-b-2 -mb-px " + (active ? "border-navy text-navy" : "border-transparent text-muted-foreground hover:text-foreground")}>
      {children}
    </button>
  );
}
function Empty({ msg }: { msg: string }) {
  return <div className="card-surface p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
