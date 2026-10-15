import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import {
  getMembership,
  getWorkspace,
  isOwner,
  listMembers,
} from "@/lib/workspace";
import { Header } from "@/components/shell/Header";
import { HEADER_H } from "@/components/shell/icons";
import { MembersAdmin } from "./MembersAdmin";
import { NameForm, PasswordForm } from "./AccountForms";
import { AvatarUpload } from "./AvatarUpload";
import { ConnectionsPanel } from "./ConnectionsPanel";
import { ProfileTabs, resolveTab } from "./ProfileTabs";
import { Divider, Panel, PanelHeading } from "./ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile · readme" };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_BLURB: Record<string, string> = {
  owner:
    "You administer this workspace: you can change anyone's role, remove people, and open or close sign-up.",
  editor: "You can create and edit projects and documentation pages.",
  viewer: "You can read everything in this workspace, but not change it.",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">{label}</dt>
      <dd className="mt-1.5 text-[13.5px] text-primary">{children}</dd>
    </div>
  );
}

function MethodRow({ name, status, on }: { name: string; status: string; on: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="text-[13.5px] text-primary">{name}</span>
      <span className={`text-[12.5px] ${on ? "text-secondary" : "text-muted"}`}>{status}</span>
    </li>
  );
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab: rawTab } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(rawTab === "connections" ? "/login?returnTo=/connections" : "/login");
  }

  // The role is read from the database rather than the session token, for the
  // same reason the actions do it: a token minted before a role change still
  // carries the old role until it expires.
  const [account, membership, workspace] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
    getMembership(session.user.id),
    getWorkspace(),
  ]);
  if (!account) redirect("/login");

  const role = membership?.role;
  const owner = isOwner(role);
  const tab = resolveTab(rawTab, owner);
  const initial = (account.name ?? account.email).trim().charAt(0).toUpperCase();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen bg-base">
      <Header signOutAction={signOutAction} userEmail={session.user.email} />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[760px] px-6 pb-24"
        style={{ paddingTop: HEADER_H + 48 }}
      >
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-visible bg-ink/[0.03] text-[19px] font-medium text-tertiary"
          >
            {account.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={account.image} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[24px] leading-tight font-semibold text-heading">
              {account.name ?? account.email}
            </h1>
            <p className="mt-1 truncate text-[13px] text-secondary">
              {account.email}
              {role && (
                <span className="ml-2 rounded-full border border-border-visible px-2 py-0.5 text-[11px] text-tertiary">
                  {ROLE_LABEL[role]}
                </span>
              )}
            </p>
          </div>
        </div>

        <ProfileTabs active={tab} owner={owner} />

        <div className="mt-8">
          {tab === "profile" && (
            <div className="space-y-10">
              <section>
                <PanelHeading title="Your details" description="How you appear to other people in this workspace." />
                <Panel padded>
                  <AvatarUpload image={account.image} initial={initial} />
                  <Divider />
                  <NameForm initialName={account.name ?? ""} />
                </Panel>
              </section>

              <section>
                <PanelHeading title="Membership" />
                <Panel padded>
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
                    <Fact label="Workspace">{workspace?.name ?? "None yet"}</Fact>
                    <Fact label="Role">{role ? ROLE_LABEL[role] : "No membership"}</Fact>
                    <Fact label="Member since">
                      {account.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </Fact>
                  </dl>
                  {role && (
                    <p className="mt-5 text-[13px] leading-relaxed text-secondary">{ROLE_BLURB[role]}</p>
                  )}
                </Panel>
              </section>
            </div>
          )}

          {tab === "security" && <SecurityTab userId={account.id} hasPassword={Boolean(account.passwordHash)} email={account.email} />}

          {tab === "connections" &&
            (membership ? (
              <ConnectionsPanel userId={account.id} workspaceId={membership.workspaceId} owner={owner} />
            ) : (
              <p className="text-[13px] text-muted">Join a workspace to connect agents.</p>
            ))}

          {tab === "workspace" && owner && workspace && (
            <WorkspaceTab workspaceId={workspace.id} currentUserId={account.id} registrationOpen={workspace.registrationOpen} />
          )}
        </div>
      </main>
    </div>
  );
}

async function SecurityTab({ userId, hasPassword, email }: { userId: string; hasPassword: boolean; email: string }) {
  const linked = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const github = linked.some((a) => a.provider === "github");

  return (
    <div className="space-y-10">
      <section>
        <PanelHeading title="Sign-in methods" description={<>You sign in as <span className="text-primary">{email}</span>.</>} />
        <Panel>
          <ul className="divide-y divide-border-subtle">
            <MethodRow name="Email and password" status={hasPassword ? "Enabled" : "Not set"} on={hasPassword} />
            <MethodRow name="GitHub" status={github ? "Connected" : "Not connected"} on={github} />
          </ul>
        </Panel>
      </section>

      <section>
        <PanelHeading title="Password" />
        <Panel padded>
          {hasPassword ? (
            <PasswordForm />
          ) : (
            <p className="text-[13px] leading-relaxed text-muted">
              This account signs in with GitHub, so there is no password to change.
            </p>
          )}
        </Panel>
      </section>
    </div>
  );
}

async function WorkspaceTab({
  workspaceId,
  currentUserId,
  registrationOpen,
}: {
  workspaceId: string;
  currentUserId: string;
  registrationOpen: boolean;
}) {
  const members = await listMembers(workspaceId);
  return (
    <section>
      <PanelHeading
        title="People"
        description={`${members.length} member${members.length === 1 ? "" : "s"}. Only owners can see this tab or change what is in it.`}
      />
      <MembersAdmin members={members} currentUserId={currentUserId} registrationOpen={registrationOpen} />
    </section>
  );
}
