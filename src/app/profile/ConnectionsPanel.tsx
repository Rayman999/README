import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthClients, oauthGrants } from "@/db/schema";
import { resource } from "@/lib/mcp/security";
import { clearPastConnections, disableClient, removeClient, removeDisabledClients, revokeConnection } from "./connectionActions";
import { SetupGuides } from "./SetupGuides";
import { Panel, PanelHeading, Row } from "./ui";

const BUTTON =
  "ease-base flex h-8 shrink-0 items-center rounded-control border border-border-visible px-3 text-[12.5px] text-primary transition-colors duration-200 hover:bg-ink/[0.06]";
const QUIET_BUTTON =
  "ease-base flex h-7 shrink-0 items-center rounded-control px-2.5 text-[12px] text-muted transition-colors duration-200 hover:bg-ink/[0.06] hover:text-primary";
const SUMMARY = "cursor-pointer text-[12.5px] text-muted hover:text-secondary";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function ConnectionsPanel({
  userId,
  workspaceId,
  owner,
}: {
  userId: string;
  workspaceId: string;
  owner: boolean;
}) {
  // Only the signed-in person's own connections, whatever their role. Other
  // members' agents, usage and dates are theirs alone.
  const connections = await db
    .select({ grant: oauthGrants, name: oauthClients.name, disabled: oauthClients.revokedAt })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
    .where(and(eq(oauthGrants.workspaceId, workspaceId), eq(oauthGrants.userId, userId)))
    .orderBy(desc(oauthGrants.createdAt))
    .limit(100);

  const clients = owner
    ? await db
        .select({ id: oauthClients.id, name: oauthClients.name, revokedAt: oauthClients.revokedAt, createdAt: oauthClients.createdAt })
        .from(oauthClients)
        .where(eq(oauthClients.workspaceId, workspaceId))
        .orderBy(desc(oauthClients.createdAt))
        .limit(50)
    : [];

  const now = new Date();
  const active = connections.filter(({ grant, disabled }) => !grant.revokedAt && !disabled && grant.expiresAt > now);
  const inactive = connections.filter((c) => !active.includes(c));
  const liveClients = clients.filter((client) => !client.revokedAt);
  const disabledClients = clients.filter((client) => client.revokedAt);

  return (
    <div className="space-y-10">
      <section>
        <PanelHeading
          title="Your connections"
          description="Agents you have allowed to read your documentation. Revoking takes effect on the next request; connections expire after 30 days."
        />
        <Panel>
          {active.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted">
              No agents connected yet.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {active.map(({ grant, name }) => (
                <Row key={grant.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-primary">{name}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {grant.scopes.includes("docs:write") ? "Read and write drafts" : "Read only"}
                      {" · "}Expires {formatDate(grant.expiresAt)}
                      {" · "}Last used {grant.lastUsedAt ? formatDate(grant.lastUsedAt) : "never"}
                    </p>
                  </div>
                  <form action={revokeConnection}>
                    <input type="hidden" name="id" value={grant.id} />
                    <button className={BUTTON}>Revoke</button>
                  </form>
                </Row>
              ))}
            </ul>
          )}
        </Panel>

        {inactive.length > 0 && (
          <details className="mt-3">
            <summary className={SUMMARY}>
              {inactive.length} past connection{inactive.length === 1 ? "" : "s"}
            </summary>
            <form action={clearPastConnections} className="mt-2">
              <button className={QUIET_BUTTON}>Clear past connections</button>
            </form>
            <ul className="mt-2 space-y-1.5 pl-1">
              {inactive.map(({ grant, name, disabled }) => (
                <li key={grant.id} className="text-[12.5px] text-muted">
                  {name} ·{" "}
                  {grant.revokedAt
                    ? `revoked ${formatDate(grant.revokedAt)}`
                    : disabled
                      ? "app disabled"
                      : `expired ${formatDate(grant.expiresAt)}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section>
        <PanelHeading
          title="Connect an agent"
          description="Pick your agent and follow the steps."
        />
        <SetupGuides server={resource()} owner={owner} />
      </section>

      {owner && (
        <section>
          <PanelHeading
            title="Agent apps"
            description="Connections created for this workspace. Disabling one cuts off everyone who connected through it. Only owners see this."
          />
          {liveClients.length === 0 ? (
            <p className="text-[13px] text-muted">None yet. Create one above.</p>
          ) : (
            <Panel>
              <ul className="divide-y divide-border-subtle">
                {liveClients.map((client) => (
                  <Row key={client.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-primary">{client.name}</p>
                      <p className="mt-0.5 break-all text-[11.5px] text-muted">
                        Added {formatDate(client.createdAt)} · {client.id}
                      </p>
                    </div>
                    <form action={disableClient}>
                      <input type="hidden" name="id" value={client.id} />
                      <button className={BUTTON}>Disable</button>
                    </form>
                  </Row>
                ))}
              </ul>
            </Panel>
          )}

          {disabledClients.length > 0 && (
            <details className="mt-3">
              <summary className={SUMMARY}>
                {disabledClients.length} disabled app{disabledClients.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-2 divide-y divide-border-subtle">
                {disabledClients.map((client) => (
                  <li key={client.id} className="flex items-center gap-3 py-2 pl-1">
                    <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                      {client.name} · disabled {formatDate(client.revokedAt!)}
                    </p>
                    <form action={removeClient}>
                      <input type="hidden" name="id" value={client.id} />
                      <button className={QUIET_BUTTON}>Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
              {disabledClients.length > 1 && (
                <form action={removeDisabledClients} className="mt-1">
                  <button className={QUIET_BUTTON}>Remove all disabled apps</button>
                </form>
              )}
            </details>
          )}
        </section>
      )}
    </div>
  );
}
