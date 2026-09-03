"use client";
import { useActionState } from "react";
import { createClient } from "./actions";

const input = "mt-2 block min-h-11 w-full rounded-input border border-border-visible bg-white/[0.025] px-3 py-2 text-sm text-primary focus:outline-2 focus:outline-offset-2 focus:outline-white/30";

export function ClientForm() {
  const [state, action, pending] = useActionState(createClient, {});
  return <form action={action} className="auth-panel mt-4 space-y-5 p-5">
    <label className="block text-sm text-tertiary">Connection name<input className={input} name="name" placeholder="ChatGPT" required maxLength={80} /></label>
    <label className="block text-sm text-tertiary">Allowed callback URLs<textarea className={input} name="redirectUris" rows={3} required placeholder="Paste the exact HTTPS callback URL shown in ChatGPT" /></label>
    <p className="text-xs leading-relaxed text-secondary">One exact URL per line. No wildcards. Only add callbacks belonging to an agent service you trust.</p>
    <label className="flex items-start gap-3 text-sm text-secondary"><input type="checkbox" name="write" className="mt-1" /><span>Offer draft-writing permission. Users must also approve it when connecting.</span></label>
    {state.error && <p role="alert" className="text-sm text-primary">{state.error}</p>}
    {state.clientSecret && <div role="status" className="rounded-input border border-border-visible bg-white/5 p-4 text-sm">
      <p className="font-medium text-heading">Client created. Save the secret now.</p>
      <p className="mt-2 text-secondary">It is shown only here. Paste it into the OAuth client secret field in ChatGPT—not into a conversation.</p>
      <label className="mt-4 block">Client ID<input className={input} readOnly value={state.clientId} onFocus={(e) => e.target.select()} /></label>
      <label className="mt-3 block">Client secret<input className={input} readOnly value={state.clientSecret} onFocus={(e) => e.target.select()} autoComplete="off" /></label>
    </div>}
    <button disabled={pending} className="min-h-11 rounded-control border border-border-visible bg-white/10 px-5 text-sm font-medium text-heading hover:bg-white/15 disabled:opacity-50">{pending ? "Creating…" : "Create client"}</button>
  </form>;
}
