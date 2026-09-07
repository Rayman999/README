"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";

function depthOf(path: string): number {
  if (path === "/") return 0;
  const segments = path.split("/").filter(Boolean);
  return segments[0] === "p" ? Math.min(segments.length - 1, 2) : 1;
}

/** Animate committed content only; keep the fixed shell and React tree intact. */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(pathname);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    const main = root.current?.querySelector("main");
    if (!main) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    // Back navigation settles upward; neighbouring articles only fade.
    const sameLevel = from !== pathname && depthOf(from) === depthOf(pathname);
    const offset = sameLevel ? 0 : depthOf(pathname) < depthOf(from) ? -8 : 12;
    const animation = main.animate([
      { opacity: 0, transform: `translateY(${offset}px)` },
      { opacity: 1, transform: "translateY(0)" },
    ], { duration: sameLevel ? 200 : 340, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    const stop = () => { if (reduced.matches) animation.cancel(); };
    reduced.addEventListener("change", stop);
    return () => { animation.cancel(); reduced.removeEventListener("change", stop); };
  }, [pathname]);

  return <div ref={root} className="route-transition">{children}</div>;
}
