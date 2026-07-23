const STATUS_STYLES: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  payment_pending: "bg-warning/20 text-navy",
  paid: "bg-accent text-accent-foreground",
  rider_assigned: "bg-accent text-accent-foreground",
  heading_to_pickup: "bg-accent text-accent-foreground",
  picked_up: "bg-accent text-accent-foreground",
  in_transit: "bg-accent text-accent-foreground",
  out_for_delivery: "bg-accent text-accent-foreground",
  delivered: "bg-emerald/20 text-emerald",
  cancelled: "bg-destructive/20 text-destructive",
  pending: "bg-warning/20 text-navy",
  processing: "bg-warning/20 text-navy",
  success: "bg-emerald/20 text-emerald",
  failed: "bg-destructive/20 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
        (STATUS_STYLES[status] ?? "bg-muted text-muted-foreground")
      }
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
