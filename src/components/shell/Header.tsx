"use client";

import Link from "next/link";
import { Icon, ICONS, HEADER_H } from "./icons";

// Deliberately not re-exported. Re-exporting them from this "use client"
// module is what made them arrive as undefined in server components.
// Import icons and constants from "./icons" directly.

export function Header({
  onMenu,
  signOutAction,
  userEmail,
}: {
  onMenu?: () => void;
  signOutAction?: () => Promise<void>;
  userEmail?: string | null;
}) {
  return (
    <header
      className="fixed top-0 right-0 left-0 z-30 flex items-center gap-4 border-b border-border-faint bg-shell px-4"
      style={{ height: HEADER_H }}
    >
      {onMenu && (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          className="ease-base -ml-1 rounded-control p-2 text-muted transition-colors duration-200 hover:bg-state-hover hover:text-primary lg:hidden"
        >
          <Icon path={ICONS.menu} size={16} />
        </button>
      )}

      <Link href="/" className="flex shrink-0 items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-border-visible bg-white/[0.03] text-muted">
          <Icon path={ICONS.doc} size={11} />
        </span>
        <span className="text-[13.5px] font-medium text-primary">readme</span>
      </Link>

      <div className="mx-auto hidden w-full max-w-[420px] px-6 sm:block">
        <input
          type="search"
          placeholder="Search documentation…"
          aria-label="Search documentation"
          className="ease-base shadow-inset-soft h-8 w-full rounded-input border border-border-visible bg-white/[0.02] px-3 text-[13px] text-primary transition-[background-color,border-color] duration-200 outline-none placeholder:text-muted hover:border-white/[0.09] focus:border-white/[0.14] focus:bg-white/[0.03]"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {[ICONS.clock, ICONS.sun].map((p, i) => (
          <button
            key={i}
            type="button"
            className="ease-base rounded-control p-2 text-muted transition-colors duration-200 hover:bg-state-hover hover:text-primary"
          >
            <Icon path={p} />
          </button>
        ))}

        {signOutAction && (
          <form action={signOutAction} className="flex">
            <button
              type="submit"
              title={userEmail ? `Sign out ${userEmail}` : "Sign out"}
              aria-label="Sign out"
              className="ease-base rounded-control p-2 text-muted transition-colors duration-200 hover:bg-state-hover hover:text-primary"
            >
              <Icon path={ICONS.signOut} />
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
