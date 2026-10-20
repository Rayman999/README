"use client";

import { useActionState, useState, type ReactNode } from "react";
import { createClient } from "./connectionActions";
import { PROVIDERS, type ProviderId } from "./providers";

const strong = "text-primary";
const link = "text-primary underline underline-offset-2 hover:text-heading";
const BUTTON =
  "ease-base min-h-9 rounded-control border border-border-visible bg-ink/10 px-4 text-[13px] font-medium text-heading transition-colors duration-200 hover:bg-ink/15 disabled:opacity-50";

/** A labelled value with a copy button. */
function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2">
      <p className="text-[11.5px] text-muted">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded bg-ink/5 py-1.5 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 break-all text-[12.5px] text-primary">{value}</code>
        <button
          type="button"
          className="ease-base h-7 shrink-0 rounded-control px-2.5 text-[12px] text-muted transition-colors duration-200 hover:bg-ink/[0.06] hover:text-primary"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {secret && <p className="mt-1 text-[11.5px] text-muted">Shown only once. Paste it into the connector form, not into a conversation.</p>}
    </div>
  );
}

function CreateApp({ provider }: { provider: ProviderId }) {
  const config = PROVIDERS[provider];
  const [state, action, pending] = useActionState(createClient, {});

  if (state.clientId && state.provider === provider) {
    return (
      <div role="status">
        <CopyField label="Client ID" value={state.clientId} />
        {state.clientSecret && <CopyField label="Client secret" value={state.clientSecret} secret />}
      </div>
    );
  }

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="provider" value={provider} />
      {config.editableCallback && (
        <details className="mb-3">
          <summary className="cursor-pointer text-[12px] text-muted hover:text-secondary">
            ChatGPT shows a different callback URL?
          </summary>
          <input
            name="callback"
            defaultValue={config.callback}
            className="mt-2 block min-h-9 w-full rounded-input border border-border-visible bg-ink/[0.025] px-3 text-[12.5px] text-primary"
            aria-label="Callback URL"
          />
        </details>
      )}
      <button disabled={pending} className={BUTTON}>
        {pending ? "Creating…" : `Create ${config.label} connection`}
      </button>
      {state.error && <p role="alert" className="mt-2 text-[12.5px] text-primary">{state.error}</p>}
    </form>
  );
}

function steps(provider: ProviderId, server: string, owner: boolean): ReactNode[] {
  const config = PROVIDERS[provider];
  const create = owner
    ? <>Create the app. Everything is filled in for you. <CreateApp provider={provider} /></>
    : <>Ask a workspace owner to create a {config.label} connection on this page and send you the client ID and secret.</>;
  const open = <a href={config.settingsUrl} target="_blank" rel="noreferrer" className={link}>{config.label} settings</a>;

  if (provider === "claude") {
    return [
      create,
      <>Open {open} → <span className={strong}>Add custom connector</span>. Name it <span className={strong}>README</span> and use this URL: <CopyField label="Server URL" value={server} /></>,
      <>Choose <span className={strong}>Sign in now</span> and <span className={strong}>Use your own OAuth client</span>. Paste the client ID and secret, then click <span className={strong}>Add</span>.</>,
      <>Click <span className={strong}>Connect</span>, sign into README and approve.</>,
    ];
  }
  return [
    create,
    <>Open {open} → <span className={strong}>Advanced</span>, turn on <span className={strong}>Developer mode</span>, then <span className={strong}>Create</span> a connector. Name it <span className={strong}>README</span> and use this URL: <CopyField label="Server URL" value={server} /></>,
    <>Choose <span className={strong}>OAuth</span>, paste the client ID and secret, then click <span className={strong}>Create</span>.</>,
    <>Sign into README and approve.</>,
  ];
}

const NOTE: Record<ProviderId, string> = {
  claude: "In a Claude team, an admin adds the connector once. Everyone else finds README under Settings → Connectors and clicks Connect, signing in with their own README account.",
  chatgpt: "Start a new chat after connecting. No OpenAI API key is needed.",
};

export function SetupGuides({ server, owner }: { server: string; owner: boolean }) {
  const ids = Object.keys(PROVIDERS) as ProviderId[];
  const [active, setActive] = useState<ProviderId>(ids[0]);

  return (
    <div className="auth-panel p-5">
      <div role="tablist" aria-label="Agent" className="inline-flex gap-1 rounded-control bg-ink/[0.04] p-1">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`guide-${id}`}
            aria-selected={id === active}
            aria-controls={`guide-panel-${id}`}
            onClick={() => setActive(id)}
            className={`ease-base h-7 rounded-[6px] px-3 text-[12.5px] transition-colors duration-200 ${
              id === active ? "bg-ink/10 font-medium text-heading" : "text-muted hover:text-secondary"
            }`}
          >
            {PROVIDERS[id].label}
          </button>
        ))}
      </div>
      {/* Every panel stays mounted so a freshly created secret survives a tab switch. */}
      {ids.map((id) => (
        <div key={id} role="tabpanel" id={`guide-panel-${id}`} aria-labelledby={`guide-${id}`} hidden={id !== active}>
          <ol className="mt-5 list-decimal space-y-4 pl-5 text-[13px] leading-relaxed text-secondary">
            {steps(id, server, owner).map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          <p className="mt-4 text-[12px] text-muted">{NOTE[id]}</p>
        </div>
      ))}
    </div>
  );
}
