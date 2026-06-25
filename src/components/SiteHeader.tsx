import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export function SiteHeader() {
  const { userId, isAdmin, isRider, homePath, loading } = useUserRole();
  const signedIn = !!userId;

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link to="/" hash="how" className="hover:text-foreground">How it works</Link>
          <Link to="/" hash="coverage" className="hover:text-foreground">Coverage</Link>
          {!isRider && !isAdmin && (
            <Link to="/become-rider" className="hover:text-foreground">Become a Rider</Link>
          )}
          {signedIn && isRider && (
            <Link to="/rider" className="hover:text-foreground">Rider portal</Link>
          )}
          {signedIn && isAdmin && (
            <Link to="/admin" className="hover:text-foreground">Admin</Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {loading ? null : signedIn ? (
            <>
              <Link to={homePath}>
                <Button className="btn-navy h-9 px-4">
                  {isAdmin ? "Admin" : isRider ? "Rider portal" : "Dashboard"}
                </Button>
              </Link>
              <Button variant="ghost" className="h-9 px-3" onClick={signOut}>Sign out</Button>
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
