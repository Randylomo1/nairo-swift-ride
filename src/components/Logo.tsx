import { Link } from "@tanstack/react-router";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 font-display font-bold text-xl tracking-tight"
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-lg shadow-[var(--shadow-glow)]"
        style={{ background: "var(--emerald)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h13l3-5h2l-2 8h-2" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      </span>
      <span className={light ? "text-white" : "text-navy"}>Urban Courier</span>
    </Link>
  );
}
