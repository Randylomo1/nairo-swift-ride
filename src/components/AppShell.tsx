import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell,
  Bike,
  ChevronDown,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Package,
  Plus,
  ShieldCheck,
  User,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { BackButton } from "./BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: React.ElementType };

const CUSTOMER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/book", label: "Book", icon: Plus },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/payment", label: "Payments", icon: Wallet },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/profile", label: "Profile", icon: User },
];

const RIDER_NAV: NavItem[] = [
  { to: "/rider", label: "Rider portal", icon: Bike },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/profile", label: "Profile", icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Operations", icon: ShieldCheck },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAdmin, isRider, homePath, userId } = useUserRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  const nav = isAdmin ? ADMIN_NAV : isRider ? RIDER_NAV : CUSTOMER_NAV;

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    async function loadCount() {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null);
      if (mounted) setUnread(count ?? 0);
    }
    loadCount();
    const ch = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => loadCount()
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex w-full bg-secondary/40">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 border-r border-border bg-background flex-col z-30">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <Link to={homePath}><Logo /></Link>
        </div>
        <SidebarNav items={nav} pathname={pathname} unread={unread} />
        <div className="p-3 border-t border-border">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-background border-r border-border flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-border">
              <Link to={homePath}><Logo /></Link>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav items={nav} pathname={pathname} unread={unread} />
            <div className="p-3 border-t border-border">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-60 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="lg:hidden text-navy"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-6" />
              </button>
              <BackButton className="hidden sm:inline-flex" />
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                className="relative size-9 grid place-items-center rounded-full hover:bg-secondary transition"
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
              >
                <Bell className="size-4 text-navy" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center px-1">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="h-9 pl-2 pr-3 rounded-full border border-border hover:bg-secondary flex items-center gap-1.5 text-sm font-medium"
                >
                  <span className="size-6 rounded-full bg-navy text-navy-foreground grid place-items-center text-[10px] font-bold">
                    {isAdmin ? "AD" : isRider ? "RD" : "ME"}
                  </span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
                {profileOpen && (
                  <div
                    className="absolute right-0 mt-1 w-48 rounded-lg border border-border bg-popover shadow-elevated py-1 text-sm"
                    onMouseLeave={() => setProfileOpen(false)}
                  >
                    <Link to="/profile" className="block px-3 py-2 hover:bg-secondary">Profile</Link>
                    <Link to="/support" className="block px-3 py-2 hover:bg-secondary">Support</Link>
                    <button onClick={signOut} className="w-full text-left px-3 py-2 hover:bg-secondary text-destructive">
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="sm:hidden px-4 pb-2">
            <BackButton />
          </div>
        </header>

        <main className="flex-1 min-w-0 pb-24 lg:pb-8">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="grid grid-cols-5">
            {nav.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                    active ? "text-emerald" : "text-muted-foreground"
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

function SidebarNav({
  items,
  pathname,
  unread,
}: {
  items: NavItem[];
  pathname: string;
  unread: number;
}) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        const showBadge = item.to === "/notifications" && unread > 0;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-navy text-navy-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2.5">
              <Icon className="size-4" />
              {item.label}
            </span>
            {showBadge && (
              <span className="min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center px-1.5">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Page header with title/subtitle/actions — use in every authenticated page. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl sm:text-3xl font-display font-bold text-navy">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
