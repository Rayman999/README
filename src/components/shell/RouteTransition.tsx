"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Directional page transitions.
 *
 * Navigation in this app is hierarchical - workspace, project, page - so the
 * motion follows the hierarchy rather than being the same in both directions:
 * going deeper the incoming view swipes in from the right, coming back out it
 * swipes in from the left.
 *
 * Only the arriving view animates. The outgoing one is left alone: anything
 * that fades it out has to hold it at nothing until the server answers, and on
 * these force-dynamic routes that reads as the app blinking dark and back.
 */

type Direction = "forward" | "back";

/** Depth in the documentation hierarchy. Deeper = further "in". */
function depthOf(pathname: string): number {
  if (pathname === "/") return 0;
  const segments = pathname.split("/").filter(Boolean);
  // /p/<project> is depth 1, /p/<project>/<...page> is depth 2.
  if (segments[0] === "p") return Math.min(segments.length - 1, 2);
  // /new, /profile, /login and friends sit one level in from the workspace.
  return 1;
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [direction, setDirection] = useState<Direction>("forward");
  const settledPath = useRef(pathname);

  // Direction is derived from the two paths, which covers every way a
  // navigation can start - a link, a redirect, or the back/forward buttons.
  if (settledPath.current !== pathname) {
    const previous = settledPath.current;
    settledPath.current = pathname;
    setDirection(depthOf(pathname) >= depthOf(previous) ? "forward" : "back");
  }

  // The wrapper is transformed while the animation runs, which makes it the
  // containing block for the fixed header inside it. Record the scroll offset
  // so the header can be pinned to the viewport for that window: 0 for an
  // ordinary navigation, non-zero when the browser restores a position.
  const [animating, setAnimating] = useState(true);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      "--nav-scroll",
      `${window.scrollY}px`,
    );
    setAnimating(true);
  }, [pathname]);

  return (
    <div
      key={pathname}
      data-direction={direction}
      data-animating={animating ? "" : undefined}
      onAnimationEnd={(event) => {
        // Ignore animations bubbling up from the staggered children.
        if (event.target === event.currentTarget) setAnimating(false);
      }}
      className="route-transition"
    >
      {children}
    </div>
  );
}
