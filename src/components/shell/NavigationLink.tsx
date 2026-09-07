"use client";

import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  // Portalling keeps the loading line fixed even when the clicked card moves.
  return pending ? createPortal(
    <div className="navigation-progress" role="status">
      <span className="sr-only">Loading page…</span><span className="navigation-progress-line" />
    </div>, document.body,
  ) : null;
}

export default function NavigationLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<PendingNavigation /></Link>;
}
