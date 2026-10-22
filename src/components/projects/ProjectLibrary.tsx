"use client";

import { useEffect, useState } from "react";
import Link from "@/components/shell/NavigationLink";
import { Icon, ICONS } from "@/components/shell/icons";
import { DeleteProjectButton } from "./DeleteProjectButton";

type Project = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  status: string;
  children: { id: string; slug: string; name: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active", maintenance: "Maintenance", archived: "Archived", planned: "Planned",
};
const STAR = "M8 1.5l2 4.1 4.5.7-3.25 3.2.77 4.5L8 11.85l-4.02 2.15.77-4.5L1.5 6.3 6 5.6Z";
const CONTROL = "flex min-h-9 items-center justify-center gap-2 rounded-control border border-border-visible px-3 text-[12.5px] text-secondary transition-colors hover:bg-state-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

export function ProjectLibrary({ projects, canEdit, storageKey }: {
  projects: Project[];
  canEdit: boolean;
  storageKey: string;
}) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("favorites");

  useEffect(() => {
    function load() {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
        setFavorites(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
      } catch {
        setFavorites([]);
      }
      setReady(true);
    }
    load();
    function sync(event: StorageEvent) {
      if (event.key === storageKey || event.key === null) load();
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey]);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError("Browser storage is unavailable. Favorites will last until you leave this page.");
    }
  }

  function clearFilters() {
    setQuery("");
    setOnlyFavorites(false);
    setStatus("all");
  }

  const favoriteCount = projects.filter(project => favorites.includes(project.id)).length;
  const search = query.trim().toLocaleLowerCase();
  const visible = projects.filter(project =>
    (!onlyFavorites || favorites.includes(project.id)) &&
    (status === "all" || project.status === status) &&
    (!search || [project.name, project.summary, ...project.children.map(child => child.name)]
      .some(value => value.toLocaleLowerCase().includes(search))),
  ).sort((a, b) => {
    if (sort === "favorites") {
      const difference = Number(favorites.includes(b.id)) - Number(favorites.includes(a.id));
      if (difference) return difference;
    }
    return sort === "za" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
  });

  return (
    <section className="mt-9" aria-label="Project library">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div className="flex gap-1" role="group" aria-label="Project view">
          <button type="button" aria-pressed={!onlyFavorites} onClick={() => setOnlyFavorites(false)}
            className={`${CONTROL} ${!onlyFavorites ? "bg-state-selected font-medium text-primary" : "border-transparent"}`}>
            All projects <span className="text-tertiary">{projects.length}</span>
          </button>
          <button type="button" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(true)}
            className={`${CONTROL} ${onlyFavorites ? "bg-state-selected font-medium text-primary" : "border-transparent"}`}>
            <Icon path={STAR} size={13} /> Favorites <span className="text-tertiary">{favoriteCount}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <label className="flex min-h-10 min-w-0 basis-full items-center gap-2 rounded-control border border-border-visible px-3 sm:flex-1 sm:basis-0">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className="shrink-0 text-tertiary" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.5" /><path d="m10 10 4 4" />
          </svg>
          <span className="sr-only">Search projects</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Find a project…" className="min-w-0 w-full bg-transparent py-2 text-[13px] text-primary placeholder:text-tertiary" />
        </label>
        <label className="min-w-0 flex-1 sm:flex-none">
          <span className="sr-only">Filter by status</span>
          <select value={status} onChange={event => setStatus(event.target.value)}
            className="h-10 w-full rounded-control border border-border-visible bg-base px-3 text-[12.5px] text-secondary">
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-0 flex-1 sm:flex-none">
          <span className="sr-only">Sort projects</span>
          <select value={sort} onChange={event => setSort(event.target.value)}
            className="h-10 w-full rounded-control border border-border-visible bg-base px-3 text-[12.5px] text-secondary">
            <option value="favorites">Favorites first</option>
            <option value="az">Name: A–Z</option>
            <option value="za">Name: Z–A</option>
          </select>
        </label>
      </div>

      <div className="my-4 flex flex-wrap justify-between gap-2 text-[12px] text-tertiary">
        <p role="status">{visible.length} of {projects.length} projects</p>
        <p>Star your go-to projects. Saved in this browser.</p>
      </div>
      {storageError && <p role="alert" className="mb-4 text-[12px] text-secondary">{storageError}</p>}

      {visible.length === 0 ? (
        <div className="rounded-code border border-dashed border-border-visible px-6 py-12 text-center">
          <h2 className="text-[16px] font-semibold text-primary">{onlyFavorites && favoriteCount === 0 ? "Your favorites start here" : "No matching projects"}</h2>
          <p className="mt-2 text-[13px] text-secondary">{onlyFavorites && favoriteCount === 0 ? "Star a project in All projects to keep it close." : "Try another search or clear your filters."}</p>
          <button type="button" onClick={clearFilters} className={`${CONTROL} mx-auto mt-5`}>Show all projects</button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map(project => {
            const favorite = favorites.includes(project.id);
            return (
              <li key={project.id} className="min-w-0">
                <div className="project-card ease-base relative flex h-full flex-col rounded-code border border-border-subtle bg-ink/[0.018] transition-[background-color,transform] duration-200 hover:bg-ink/[0.035]">
                  <button type="button" disabled={!ready} aria-pressed={favorite}
                    aria-label={`${favorite ? "Remove" : "Add"} ${project.name} ${favorite ? "from" : "to"} favorites`}
                    title={favorite ? "Remove from favorites" : "Add to favorites"}
                    onClick={() => toggleFavorite(project.id)}
                    className={`absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-control transition-colors hover:bg-state-hover ${favorite ? "bg-state-selected text-primary" : "text-tertiary hover:text-primary"}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true"><path d={STAR} /></svg>
                  </button>
                  <Link href={`/p/${project.slug}`} className="project-card-link block flex-1 rounded-code">
                    <div className="pr-8"><span className="text-primary">{project.name}</span></div>
                    <span className="mt-2 block text-[10.5px] tracking-[0.06em] text-tertiary uppercase">{STATUS_LABEL[project.status] ?? project.status}</span>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-secondary">{project.summary}</p>
                  </Link>
                  {project.children.length > 0 && (
                    <ul aria-label={`Projects in ${project.name}`} className="mx-6 mb-4 flex flex-wrap gap-1.5">
                      {project.children.slice(0, 6).map(child => (
                        <li key={child.id} className="min-w-0 max-w-full">
                          <Link href={`/p/${child.slug}`} className="ease-base flex min-h-7 items-center gap-1.5 rounded-control border border-border-subtle px-2.5 py-1 text-[12px] text-secondary transition-colors hover:bg-state-hover hover:text-primary">
                            <Icon path={ICONS.project} size={12} /><span className="break-words min-w-0">{child.name}</span>
                          </Link>
                        </li>
                      ))}
                      {project.children.length > 6 && <li className="flex h-7 items-center text-[12px] text-tertiary">+{project.children.length - 6} more</li>}
                    </ul>
                  )}
                  {canEdit && <DeleteProjectButton project={project} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
