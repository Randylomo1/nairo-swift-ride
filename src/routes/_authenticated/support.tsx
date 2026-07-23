import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LifeBuoy, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Support · Urban Courier" }] }),
  component: SupportPage,
});

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  order_id: string | null;
  created_at: string;
};

function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("support_tickets")
      .select("id, subject, message, status, order_id, created_at")
      .order("created_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message");
      return;
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("support_tickets").insert({
      user_id: u.user.id,
      subject: subject.trim(),
      message: message.trim(),
      order_id: orderId.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket sent. Our team will reach out.");
    setSubject("");
    setMessage("");
    setOrderId("");
    load();
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Support" subtitle="We're here to help with any delivery issue." />

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="card-surface p-6 space-y-4">
          <div className="flex items-center gap-2 text-navy">
            <LifeBuoy className="size-5" />
            <h2 className="font-display font-semibold">Open a ticket</h2>
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's going on?"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="orderid">Order # (optional)</Label>
            <Input
              id="orderid"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. UC-2026-000123"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="msg">Details</Label>
            <Textarea
              id="msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue…"
              rows={6}
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={busy} className="btn-emerald w-full h-11">
            <Send className="size-4 mr-1.5" /> {busy ? "Sending…" : "Send"}
          </Button>
        </form>

        <div>
          <h2 className="font-display font-semibold mb-3">Your tickets</h2>
          {tickets.length === 0 ? (
            <div className="card-surface p-8 text-center text-sm text-muted-foreground">
              No tickets yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id} className="card-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-display font-semibold text-navy truncate">
                      {t.subject}
                    </div>
                    <span className="rounded-full bg-secondary text-navy px-2 py-0.5 text-[10px] font-bold uppercase">
                      {t.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.message}</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(t.created_at).toLocaleString()}
                    {t.order_id && ` · order ${t.order_id.slice(0, 8)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
