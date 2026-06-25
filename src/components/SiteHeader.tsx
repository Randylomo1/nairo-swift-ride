import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link to="/" hash="how" className="hover:text-foreground">How it works</Link>
          <Link to="/" hash="coverage" className="hover:text-foreground">Coverage</Link>
          <Link to="/become-rider" className="hover:text-foreground">Become a Rider</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/admin" className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground">Admin</Link>
              <Link to="/dashboard">
                <Button className="btn-navy h-9 px-4">Dashboard</Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" className="h-9 px-3">Sign in</Button>
              </Link>
              <Link to="/book">
                <Button className="btn-emerald h-9 px-4">Book delivery</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
