"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Directional page transitions.
 *
 * Navigation in this app is hierarchical — workspace → project → page — so the
 * motion follows the hierarchy rather than being the same in both directions:
 * going deeper the outgoing view slides out to the left and the incoming one
 * swipes in from the right; coming back out, both reverse.
 *
 * The exit half starts on the click, before Next has the new route's payload,
 * and holds its end state (animation-fill-mode: both). Whenever the payload
 * lands the wrapper is re-keyed and the enter half plays. If the two never
 * meet — a cancelled navigation, a same-route click, a server redirect — the
 * safety timer below puts the view back.
 */

type Direction = "forward" | "back";

/** Depth in the documentation hierarchy. Deeper = further "in". */
function depthOf(pathname: string): number {
  if (pathname === "/") return 0;
  const segments = pathname.split("/").filter(Boolean);
  // /p/<project> is depth 1, /p/<project>/<…page> is depth 2.
  if (segments[0] === "p") return Math.min(segments.length - 1, 2);
  // /new, /login and friends sit one level in from the workspace.
  return 1;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [direction, setDirection] = useState<Direction>("forward");
  // The path the exit animation belongs to. Once the router settles on a new
  // pathname this no longer matches, so the exit state releases itself.
  const [exitPath, setExitPath] = useState<string | null>(null);
  const exiting = exitPath !== null && exitPath === pathname;

  // The rendered subtree is re-keyed per pathname so the enter animation
  // restarts on every navigation.
  const settledPath = useRef(pathname);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start the exit half as soon as a link is pressed, so the outgoing view is
  // already moving while the route payload is still in flight.
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      setDirection(depthOf(url.pathname) >= depthOf(window.location.pathname)
        ? "forward"
        : "back");
      // The exiting view is transformed, which turns it into the containing
      // block for the fixed header. Hand the current scroll offset to CSS so
      // the header can be held at the viewport top for the duration.
      document.documentElement.style.setProperty(
        "--exit-scroll",
        `${window.scrollY}px`,
      );
      setExitPath(window.location.pathname);

      // If the navigation never lands, bring the view back rather than
      // leaving it parked off-screen.
      if (exitTimer.current) clearTimeout(exitTimer.current);
      exitTimer.current = setTimeout(() => setExitPath(null), 1200);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  // The payload landed: pick up the direction for the enter half (covers
  // back/forward buttons and redirects, where no click was seen) and release
  // the exit state.
  if (settledPath.current !== pathname) {
    const previous = settledPath.current;
    settledPath.current = pathname;
    if (exitPath === null) {
      // No click drove this — a back/forward button or a redirect. Read the
      // direction off the two paths instead.
      setDirection(depthOf(pathname) >= depthOf(previous) ? "forward" : "back");
    } else {
      // Retire the finished exit so a later return to that same path is not
      // mistaken for one still in progress.
      setExitPath(null);
    }
  }

  return (
    <div
      key={pathname}
      data-direction={direction}
      data-exiting={exiting ? "" : undefined}
      className="route-transition"
    >
      {children}
    </div>
  );
}
