import Link from "next/link";
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

export const dynamic = "force-dynamic";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 text-[13.5px] text-primary">{children}</dd>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[19px] font-semibold text-heading">{children}</h2>
  );
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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

  const linked = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, account.id));

  const methods = [
    ...(account.passwordHash ? ["Email and password"] : []),
    ...linked.map((a) => (a.provider === "github" ? "GitHub" : a.provider)),
  ];

  const members = owner && workspace ? await listMembers(workspace.id) : [];

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen bg-base">
      <Header signOutAction={signOutAction} userEmail={session.user.email} />

      <main
        className="mx-auto w-full max-w-[760px] px-6 pb-24"
        style={{ paddingTop: HEADER_H + 48 }}
      >
        <nav aria-label="Breadcrumb" className="text-[11.5px] text-muted">
          <Link
            href="/"
            className="ease-base transition-colors duration-200 hover:text-tertiary"
          >
            Workspace
          </Link>
          <span className="mx-1.5 opacity-50">/</span>
          <span className="text-tertiary">Profile</span>
        </nav>

        <div className="mt-4 flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border-visible bg-white/[0.03] text-[17px] font-medium text-tertiary"
          >
            {(account.name ?? account.email).trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[26px] leading-tight font-semibold text-heading">
              {account.name ?? account.email}
            </h1>
            <p className="mt-0.5 text-[13.5px] text-secondary">
              {account.email}
            </p>
          </div>
        </div>

        <hr className="my-8 border-0 border-t border-border-subtle" />

        {/* --- who you are in this workspace ------------------------------- */}
        <section>
          <SectionHeading>Account</SectionHeading>

          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="Role">
              {role ? ROLE_LABEL[role] : "No membership"}
            </Field>
            <Field label="Workspace">{workspace?.name ?? "None yet"}</Field>
            <Field label="Member since">
              {account.createdAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Field>
            <Field label="Sign-in methods">
              {methods.length > 0 ? methods.join(" · ") : "None"}
            </Field>
          </dl>

          {role && (
            <p className="mt-4 text-[13px] leading-relaxed text-secondary">
              {ROLE_BLURB[role]}
            </p>
          )}
        </section>

        {/* --- editing your own details ------------------------------------ */}
        <section className="mt-10">
          <SectionHeading>Details</SectionHeading>
          <div className="auth-panel mt-4 p-5">
            <NameForm initialName={account.name ?? ""} />

            <hr className="my-6 border-0 border-t border-border-subtle" />

            {account.passwordHash ? (
              <PasswordForm />
            ) : (
              <p className="text-[13px] leading-relaxed text-muted">
                This account signs in with GitHub, so there is no password to
                change here.
              </p>
            )}
          </div>
        </section>

        {/* --- owner-only administration ----------------------------------- */}
        {owner && workspace && (
          <section className="mt-10">
            <SectionHeading>People</SectionHeading>
            <p className="mt-1.5 mb-4 text-[13px] leading-relaxed text-secondary">
              {members.length} member{members.length === 1 ? "" : "s"}. Only
              owners can see this section or change what is in it.
            </p>

            <MembersAdmin
              members={members}
              currentUserId={account.id}
              registrationOpen={workspace.registrationOpen}
            />
          </section>
        )}
      </main>
    </div>
  );
}
