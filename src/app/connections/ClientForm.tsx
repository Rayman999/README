"use client";
import { useActionState, useState } from "react";
import { createClient } from "./actions";

const input = "mt-2 block min-h-11 w-full rounded-input border border-border-visible bg-white/[0.025] px-3 py-2 text-sm text-primary focus:outline-2 focus:outline-offset-2 focus:outline-white/30";

type ClientType = "confidential" | "public";

const GUIDANCE: Record<ClientType, { label: string; hint: string; placeholder: string; help: string }> = {
  confidential: {
    label: "Web app with a client secret",
    hint: "ChatGPT and other hosted services. Receives a client ID and a secret.",
    placeholder: "https://chatgpt.com/connector/oauth/callback",
    help: "One exact HTTPS URL per line. No wildcards. Paste the callback the service itself displays — do not guess its path.",
  },
  public: {
    label: "Local or CLI app, no secret",
    hint: "Codex CLI and other native agents. Proves itself with PKCE instead of a secret.",
    placeholder: "http://127.0.0.1/callback",
    help: "Paste the callback Codex prints during `codex mcp login`, with the port removed. Only http://127.0.0.1/… and http://[::1]/… are accepted, and the port is allowed to vary because Codex picks a fresh one each login.",
  },
};

export function ClientForm() {
  const [state, action, pending] = useActionState(createClient, {});
  const [clientType, setClientType] = useState<ClientType>("confidential");
  const guidance = GUIDANCE[clientType];

  return <form action={action} className="auth-panel mt-4 space-y-5 p-5">
    <label className="block text-sm text-tertiary">Connection name<input className={input} name="name" placeholder="ChatGPT" required maxLength={80} /></label>

    <fieldset>
      <legend className="text-sm text-tertiary">App type</legend>
      <div className="mt-2 space-y-2">
        {(Object.keys(GUIDANCE) as ClientType[]).map((type) => (
          <label key={type} className="flex items-start gap-3 rounded-input border border-border-visible p-3 text-sm">
            <input type="radio" name="clientType" value={type} className="mt-1" checked={clientType === type} onChange={() => setClientType(type)} />
            <span>
              <span className="block text-primary">{GUIDANCE[type].label}</span>
              <span className="mt-1 block text-xs text-secondary">{GUIDANCE[type].hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>

    <label className="block text-sm text-tertiary">Allowed callback URLs<textarea className={input} name="redirectUris" rows={3} required placeholder={guidance.placeholder} /></label>
    <p className="text-xs leading-relaxed text-secondary">{guidance.help} Only add callbacks belonging to an agent you trust.</p>

    <label className="flex items-start gap-3 text-sm text-secondary"><input type="checkbox" name="write" className="mt-1" /><span>Offer draft-writing permission. Users must also approve it when connecting.</span></label>
    {clientType === "public" && <p className="text-xs leading-relaxed text-muted">Codex asks for every scope this server advertises, so leave this on for a Codex app even if you intend read-only use — whether writing is actually granted is decided on the approval screen, per person.</p>}

    {state.error && <p role="alert" className="text-sm text-primary">{state.error}</p>}

    {state.clientId && <div role="status" className="rounded-input border border-border-visible bg-white/5 p-4 text-sm">
      <p className="font-medium text-heading">{state.clientSecret ? "Client created. Save the secret now." : "Client created."}</p>
      <p className="mt-2 text-secondary">{state.clientSecret
        ? "The secret is shown only here. Paste it into the OAuth client secret field in the agent app — not into a conversation."
        : "Public clients have no secret. The client ID is not confidential; PKCE is what proves the login came from the app that started it."}</p>
      <label className="mt-4 block">Client ID<input className={input} readOnly value={state.clientId} onFocus={(e) => e.target.select()} /></label>
      {state.clientSecret && <label className="mt-3 block">Client secret<input className={input} readOnly value={state.clientSecret} onFocus={(e) => e.target.select()} autoComplete="off" /></label>}
    </div>}

    <button disabled={pending} className="min-h-11 rounded-control border border-border-visible bg-white/10 px-5 text-sm font-medium text-heading hover:bg-white/15 disabled:opacity-50">{pending ? "Creating…" : "Create client"}</button>
  </form>;
}
