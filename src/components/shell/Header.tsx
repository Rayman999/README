"use client";

import Link from "@/components/shell/NavigationLink";
import { Icon, ICONS, HEADER_H } from "./icons";
import { SearchCommand } from "./SearchCommand";
import { ReadingPreferences } from "@/components/reading/ReadingPreferences";

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
      className="app-header fixed top-0 right-0 left-0 z-30 flex items-center gap-4 border-b border-border-faint bg-shell px-4"
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
        <span className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-border-visible bg-ink/[0.03] text-muted">
          <Icon path={ICONS.doc} size={11} />
        </span>
        <span className="text-[13.5px] font-medium text-primary">readme</span>
      </Link>

      <div className="ml-auto"><SearchCommand /></div>
      <nav aria-label="Workspace" className="hidden items-center gap-4 text-sm text-secondary md:flex">
        <Link href="/" className="hover:text-primary">Library</Link>
        <Link href="/highlights" className="hover:text-primary">Highlights</Link>
        <Link href="/document-guide" className="hidden hover:text-primary lg:block">Writing guide</Link>
      </nav>
      <div className="flex shrink-0 items-center gap-1">
        <ReadingPreferences />
        <Link
          href="/profile"
          title={userEmail ? `Profile - ${userEmail}` : "Profile"}
          aria-label="Profile"
          className="ease-base rounded-control p-2 text-muted transition-colors duration-200 hover:bg-state-hover hover:text-primary"
        >
          <Icon path={ICONS.user} />
        </Link>

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
