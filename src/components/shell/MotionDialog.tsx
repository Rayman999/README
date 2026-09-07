"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Keep native focus containment active until the exit motion completes. */
export function MotionDialog({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const restore = useRef<(() => void) | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const previous = document.activeElement as HTMLElement | null;
      const overflow = document.body.style.overflow;
      restore.current = () => {
        document.body.style.overflow = overflow;
        previous?.focus({ preventScroll: true });
      };
      dialog.showModal();
      document.body.style.overflow = "hidden";
    }
    if (!dialog.open) return;
    const close = () => { dialog.close(); restore.current?.(); restore.current = null; };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) { if (!open) close(); return; }
    const panel = dialog.querySelector(".drawer-panel")!;
    const slide = panel.animate([
      { transform: open ? "translateX(-100%)" : "translateX(0)" },
      { transform: open ? "translateX(0)" : "translateX(-100%)" },
    ], { duration: open ? 300 : 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    const fade = dialog.animate([{ opacity: open ? 0 : 1 }, { opacity: open ? 1 : 0 }], { duration: open ? 220 : 180 });
    slide.onfinish = () => { if (!open) close(); };
    const stop = () => {
      if (reduced.matches) { slide.cancel(); fade.cancel(); if (!open) close(); }
    };
    reduced.addEventListener("change", stop);
    return () => { slide.cancel(); fade.cancel(); reduced.removeEventListener("change", stop); };
  }, [open]);

  useEffect(() => () => { ref.current?.close(); restore.current?.(); restore.current = null; }, []);

  return <dialog ref={ref} aria-label="Documentation navigation" className="navigation-dialog"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <button type="button" tabIndex={-1} aria-label="Close navigation" onClick={onClose} className="drawer-scrim" />
    <div className="drawer-panel" onClick={event => {
      if ((event.target as HTMLElement).closest("a[href]")) onClose();
    }}>{children}</div>
  </dialog>;
}
