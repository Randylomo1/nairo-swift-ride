import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Urban Courier" }] }),
  component: NotificationsPage,
});

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificationsPage() {
  const [rows, setRows] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data ?? []) as Notif[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("notif-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function markRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    load();
  }

  async function markAllRead() {
    const ids = rows.filter((r) => !r.read_at).map((r) => r.id);
    if (ids.length === 0) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    toast.success("All notifications marked as read");
    load();
  }

  async function remove(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    load();
  }

  const unread = rows.filter((r) => !r.read_at);

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={
          unread.length > 0
            ? `${unread.length} unread`
            : "You're all caught up."
        }
        actions={
          unread.length > 0 ? (
            <Button variant="outline" className="h-10" onClick={markAllRead}>
              <Check className="size-4 mr-1.5" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <Bell className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li
              key={n.id}
              className={cn(
                "card-surface p-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3",
                !n.read_at && "border-l-4 border-emerald"
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                  {!n.read_at && (
                    <span className="rounded-full bg-emerald/15 text-emerald px-2 py-0.5 text-[10px] font-bold uppercase">
                      New
                    </span>
                  )}
                </div>
                <div className="mt-1 font-display font-semibold text-navy">{n.title}</div>
                {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
                {n.order_id && (
                  <Link
                    to="/track/$orderId"
                    params={{ orderId: n.order_id }}
                    className="mt-2 inline-block text-xs font-semibold text-emerald hover:underline"
                  >
                    View order →
                  </Link>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {!n.read_at && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                    <Check className="size-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(n.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
