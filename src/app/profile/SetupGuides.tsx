"use client";

import { useState, type ReactNode } from "react";

const code = "rounded bg-ink/5 px-1.5 py-0.5 break-all text-primary";
const block = "mt-2 block rounded bg-ink/5 p-3 break-all text-primary";

type Guide = { id: string; label: string; steps: (server: string) => ReactNode[]; note: string };

const GUIDES: Guide[] = [
  {
    id: "claude",
    label: "Claude",
    steps: (server) => [
      <>An owner registers a <span className="text-primary">web app</span> below with the callback <code className={code}>https://claude.ai/api/mcp/auth_callback</code> and copies the client ID and secret.</>,
      <>In claude.ai open <span className="text-primary">Settings → Connectors → Add custom connector</span> and use this URL: <code className={block}>{server}</code></>,
      <>Under <span className="text-primary">Advanced settings</span>, paste the client ID and secret, then click Connect.</>,
      <>Sign into README and approve access. Claude Code and the desktop app pick up the connector from your account.</>,
    ],
    note: "Start a new conversation after connecting; existing ones don't load new connectors.",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    steps: (server) => [
      <>Enable Developer mode in ChatGPT and create a custom MCP connection.</>,
      <>Use this server URL and choose OAuth: <code className={block}>{server}</code></>,
      <>Copy the callback URL ChatGPT shows. An owner registers it below as a <span className="text-primary">web app</span> and receives a client ID and secret.</>,
      <>Enter those in ChatGPT, connect, then sign into README and approve access.</>,
    ],
    note: "No OpenAI API key or database password is needed. Past conversations are not imported.",
  },
  {
    id: "codex",
    label: "Codex CLI",
    steps: (server) => [
      <>An owner registers a <span className="text-primary">local or CLI app</span> below with the callback <code className={code}>http://127.0.0.1/callback</code> and copies the client ID. There is no secret.</>,
      <>Add the server with that client ID: <code className={block}>codex mcp add readme --url {server} --oauth-client-id &lt;client-id&gt;</code></>,
      <>In <code className={code}>~/.codex/config.toml</code>, under that server, set: <code className={block}>oauth_resource = &quot;{server}&quot;</code></>,
      <>Run <code className={code}>codex mcp login readme</code> and approve access in the browser window it opens.</>,
    ],
    note: "Codex picks a fresh port each login, so the callback carries no port. Only 127.0.0.1 and [::1] are accepted.",
  },
];

export function SetupGuides({ server }: { server: string }) {
  const [active, setActive] = useState(GUIDES[0].id);
  const guide = GUIDES.find((g) => g.id === active)!;

  return (
    <div className="auth-panel p-5">
      <div role="tablist" aria-label="Agent" className="inline-flex gap-1 rounded-control bg-ink/[0.04] p-1">
        {GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            id={`guide-${g.id}`}
            aria-selected={g.id === active}
            aria-controls="guide-panel"
            onClick={() => setActive(g.id)}
            className={`ease-base h-7 rounded-[6px] px-3 text-[12.5px] transition-colors duration-200 ${
              g.id === active ? "bg-ink/10 font-medium text-heading" : "text-muted hover:text-secondary"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="guide-panel" aria-labelledby={`guide-${guide.id}`}>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-[13px] leading-relaxed text-secondary">
          {guide.steps(server).map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] text-muted">{guide.note}</p>
      </div>
    </div>
  );
}
