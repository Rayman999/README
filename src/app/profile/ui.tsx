import type { ReactNode } from "react";

export function PanelHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[17px] font-semibold text-heading">{title}</h2>
      {description && (
        <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-secondary">{description}</p>
      )}
    </div>
  );
}

export function Panel({ children, padded = false }: { children: ReactNode; padded?: boolean }) {
  return <div className={`auth-panel ${padded ? "p-5" : ""}`}>{children}</div>;
}

export function Row({ children }: { children: ReactNode }) {
  return <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">{children}</li>;
}

export function Divider() {
  return <hr className="my-6 border-0 border-t border-border-subtle" />;
}
