// No "use client" here on purpose.
// These are plain values and a pure presentational component, imported by
// both server and client components. Exporting them from a "use client"
// module makes them arrive as undefined in a server component — which
// silently produced empty <path d=""> icons and a NaN padding.

export const HEADER_H = 54;

export const ICONS = {
  doc: "M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5zM9.5 1.5V5H13",
  chevron: "M6 4l4 4-4 4",
  menu: "M2.5 4h11M2.5 8h11M2.5 12h11",
  clock: "M8 4v4l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z",
  sun: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.9 3.1l-1 1M4.1 11.9l-1 1M12.9 12.9l-1-1M4.1 4.1l-1-1",
  signOut: "M6 14H3.5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1H6M10.5 11 13.5 8l-3-3M13.5 8h-8",
  close: "M12 4L4 12M4 4l8 8",
  plus: "M8 3.5v9M3.5 8h9",
  folder: "M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h5.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1z",
  book: "M2.5 2.5h4a2 2 0 0 1 2 2v9a1.5 1.5 0 0 0-1.5-1.5h-4.5zM13.5 2.5h-4a2 2 0 0 0-2 2v9a1.5 1.5 0 0 1 1.5-1.5h4.5z",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ path, size = 14 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
