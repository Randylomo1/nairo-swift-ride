import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

/** Smart back button — returns to previous route in history; falls back to role home. */
export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { homePath } = useUserRole();

  function goBack() {
    // TanStack router history length; when there's nothing to pop, jump home.
    const canGoBack = typeof window !== "undefined" && window.history.length > 1;
    if (canGoBack) router.history.back();
    else router.navigate({ to: homePath });
  }

  return (
    <button
      onClick={goBack}
      aria-label="Go back"
      className={
        "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition " +
        className
      }
    >
      <ArrowLeft className="size-4" /> Back
    </button>
  );
}
