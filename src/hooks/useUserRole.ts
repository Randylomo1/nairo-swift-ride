import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "customer" | "rider" | "admin";

export function useUserRole() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!u.user) {
        setRoles([]);
        setUserId(null);
        setLoading(false);
        return;
      }
      setUserId(u.user.id);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (!mounted) return;
      setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
      setLoading(false);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isRider = roles.includes("rider");
  const isCustomer = roles.includes("customer") || (!isAdmin && !isRider);

  const homePath = isAdmin ? "/admin" : isRider ? "/rider" : "/dashboard";

  return { roles, isAdmin, isRider, isCustomer, homePath, userId, loading };
}
