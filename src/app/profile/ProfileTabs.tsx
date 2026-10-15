import Link from "@/components/shell/NavigationLink";

export const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "connections", label: "Connections" },
  { id: "workspace", label: "Workspace", ownerOnly: true },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function resolveTab(raw: string | string[] | undefined, owner: boolean): TabId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const tab = TABS.find((t) => t.id === value);
  if (!tab || ("ownerOnly" in tab && tab.ownerOnly && !owner)) return "profile";
  return tab.id;
}

// Tabs are plain links to ?tab=…, so every tab has its own URL, works without
// JavaScript, and only the open tab's data is rendered.
export function ProfileTabs({ active, owner }: { active: TabId; owner: boolean }) {
  return (
    <nav
      aria-label="Profile sections"
      className="-mx-6 mt-8 overflow-x-auto border-b border-border-subtle px-6"
    >
      <ul className="flex min-w-max gap-1">
        {TABS.filter((t) => owner || !("ownerOnly" in t && t.ownerOnly)).map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={tab.id === "profile" ? "/profile" : `/profile?tab=${tab.id}`}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={`ease-base relative -mb-px flex h-11 items-center border-b-2 px-3 text-[13.5px] transition-colors duration-200 ${
                  current
                    ? "border-ink/60 font-medium text-heading"
                    : "border-transparent text-muted hover:text-secondary"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
