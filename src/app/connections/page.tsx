import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { oauthClients, oauthGrants } from "@/db/schema";
import { getMembership } from "@/lib/workspace";
import { resource } from "@/lib/mcp/security";
import { ClientForm } from "./ClientForm";
import { disableClient, revokeConnection } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent connections · README" };

export default async function ConnectionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?returnTo=/connections");
  const member = await getMembership(session.user.id);
  if (!member) redirect("/login");
  const owner = member.role === "owner";
  const connections = await db.select({ grant: oauthGrants, name: oauthClients.name, disabled: oauthClients.revokedAt }).from(oauthGrants).innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
    .where(and(eq(oauthGrants.workspaceId, member.workspaceId), owner ? undefined : eq(oauthGrants.userId, member.userId))).orderBy(desc(oauthGrants.createdAt)).limit(100);
  const clients = owner ? await db.select({ id: oauthClients.id, name: oauthClients.name, revokedAt: oauthClients.revokedAt }).from(oauthClients).where(eq(oauthClients.workspaceId, member.workspaceId)).orderBy(desc(oauthClients.createdAt)).limit(50) : [];

  return <main className="mx-auto max-w-[760px] px-6 py-12 text-primary">
    <nav className="text-sm text-secondary"><Link href="/profile" className="hover:underline">Profile</Link><span className="mx-2">/</span>Agent connections</nav>
    <p className="mt-10 text-xs tracking-widest text-muted uppercase">Your knowledge, connected</p>
    <h1 className="mt-3 text-3xl font-semibold text-heading">Agent connections</h1>
    <p className="mt-4 max-w-xl text-sm leading-relaxed text-secondary">Let an agent read your projects and help write documentation. Access stays inside this workspace, and you stay in control.</p>
    <section className="mt-8 rounded-input border border-border-visible p-5">
      <h2 className="text-lg font-medium text-heading">Connect ChatGPT</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-secondary">
        <li>Enable Developer mode in ChatGPT and create a custom MCP connection.</li>
        <li>Use this server URL and choose OAuth: <code className="mt-2 block break-all rounded bg-white/5 p-3 text-primary">{resource()}</code></li>
        <li>Copy the callback URL ChatGPT provides. An owner registers it below and receives a client ID and secret.</li>
        <li>Enter those credentials in ChatGPT, connect, then sign into README and approve access. Tick draft writing if you want the agent to save documents.</li>
      </ol>
      <p className="mt-5 text-xs text-muted">No OpenAI API key or database password is needed. This connection does not import your past conversations automatically.</p>
    </section>
    <section className="mt-6 rounded-input border border-border-visible p-5">
      <h2 className="text-lg font-medium text-heading">Connect Codex CLI</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-secondary">
        <li>An owner registers a <span className="text-primary">local or CLI app</span> below with the callback <code className="rounded bg-white/5 px-1.5 py-0.5 text-primary">http://127.0.0.1/callback</code> and copies the client ID. There is no secret to copy.</li>
        <li>Add the server, passing that client ID so Codex skips dynamic registration:
          <code className="mt-2 block break-all rounded bg-white/5 p-3 text-primary">codex mcp add readme --url {resource()} --oauth-client-id &lt;client-id&gt;</code></li>
        <li>Set the resource indicator in <code className="rounded bg-white/5 px-1.5 py-0.5 text-primary">~/.codex/config.toml</code> under that server:
          <code className="mt-2 block break-all rounded bg-white/5 p-3 text-primary">oauth_resource = &quot;{resource()}&quot;</code></li>
        <li>Run <code className="rounded bg-white/5 px-1.5 py-0.5 text-primary">codex mcp login readme</code>, then sign into README and approve access in the browser window it opens.</li>
      </ol>
      <p className="mt-5 text-xs text-muted">Codex listens on a fresh loopback port each login, so the registered callback carries no port. Only 127.0.0.1 and [::1] are accepted, and only over loopback.</p>
    </section>
    {owner && <section className="mt-10"><h2 className="text-xl font-medium text-heading">Register an agent app</h2><ClientForm />
      <ul className="mt-5 divide-y divide-border-subtle">{clients.map((client) => <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm">{client.name}</p><p className="mt-1 break-all text-xs text-muted">{client.id}</p></div>{client.revokedAt ? <span className="text-xs text-muted">Disabled</span> : <form action={disableClient}><input type="hidden" name="id" value={client.id} /><button className="min-h-11 rounded-control border border-border-visible px-3 text-xs hover:bg-white/5">Disable app access</button></form>}</li>)}</ul>
    </section>}
    <section className="mt-10"><h2 className="text-xl font-medium text-heading">{owner ? "Workspace connections" : "Your connections"}</h2>
      <p className="mt-2 text-sm text-secondary">Revoking access takes effect on the next request. Connections expire after 30 days.</p>
      {!connections.length && <p className="mt-5 rounded-input border border-dashed border-border-visible p-6 text-sm text-muted">No agents connected yet.</p>}
      <ul className="mt-4 divide-y divide-border-subtle">{connections.map(({ grant, name, disabled }) => {
        const inactive = Boolean(grant.revokedAt || disabled || grant.expiresAt < new Date());
        return <li key={grant.id} className="flex flex-wrap items-center justify-between gap-3 py-5"><div><p className="font-medium">{name}</p><p className="mt-1 text-xs text-secondary">{grant.scopes.includes("docs:write") ? "Read + write drafts" : "Read only"} · {inactive ? "Inactive" : `Expires ${grant.expiresAt.toLocaleDateString("en-GB")}`}</p><p className="mt-1 text-xs text-muted">Last used: {grant.lastUsedAt?.toLocaleString("en-GB") ?? "Not yet"}</p></div>{!inactive && <form action={revokeConnection}><input type="hidden" name="id" value={grant.id} /><button className="min-h-11 rounded-control border border-border-visible px-4 text-sm hover:bg-white/5">Revoke access</button></form>}</li>;
      })}</ul>
    </section>
  </main>;
}
