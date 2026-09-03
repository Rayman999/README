import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { authorize, validateAuthorization } from "@/lib/mcp/oauth";
import { issuer } from "@/lib/mcp/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Approve connection · README", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  let request: Awaited<ReturnType<typeof validateAuthorization>>;
  try { request = await validateAuthorization(query); }
  catch { return <main className="mx-auto max-w-lg px-6 py-20"><h1 className="text-2xl text-heading">Connection request rejected</h1><p className="mt-4 text-secondary">The client, callback URL, resource or permissions are invalid. Check your connection setup and try again.</p><Link href="/connections" className="mt-6 inline-block underline">Connection settings</Link></main>; }
  const { params, client, scopes } = request;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?returnTo=${encodeURIComponent(`/oauth/authorize?${new URLSearchParams(params)}`)}`);
  const [member, workspace] = await Promise.all([
    db.query.workspaceMembers.findFirst({ where: and(eq(workspaceMembers.userId, session.user.id), eq(workspaceMembers.workspaceId, client.workspaceId)) }),
    db.query.workspaces.findFirst({ where: eq(workspaces.id, client.workspaceId) }),
  ]);
  if (!member) return <main className="mx-auto max-w-lg px-6 py-20"><h1 className="text-2xl text-heading">No workspace access</h1><p className="mt-4 text-secondary">This account cannot approve access to this workspace.</p></main>;
  const canWrite = scopes.includes("docs:write") && member.role !== "viewer";

  async function decide(form: FormData) {
    "use server";
    if ((await headers()).get("origin") !== issuer()) throw new Error("Invalid request origin.");
    const current = await auth();
    if (!current?.user?.id) redirect("/login");
    const validated = await validateAuthorization(params);
    const callback = new URL(validated.params.redirect_uri);
    callback.searchParams.set("state", validated.params.state);
    callback.searchParams.set("iss", issuer());
    if (form.get("decision") === "allow") {
      const approved = await authorize(params, current.user.id, form.get("write") === "on");
      callback.searchParams.set("code", approved.code);
    } else { callback.searchParams.set("error", "access_denied"); }
    redirect(callback.toString());
  }

  return <main className="flex min-h-screen items-center justify-center px-6 py-16">
    <section className="auth-panel w-full max-w-[480px] p-7">
      <p className="text-xs tracking-widest text-muted uppercase">README / Agent connection</p>
      <h1 className="mt-4 text-[26px] font-semibold text-heading">Connect {client.name}?</h1>
      <p className="mt-3 text-sm leading-relaxed text-secondary">Signed in as {session.user.email}. You are granting access to <span className="text-primary">{workspace?.name}</span> for up to 30 days.</p>
      <form action={decide} className="mt-7">
        <div className="rounded-input border border-border-visible p-4 text-sm">
          <p className="font-medium text-heading">Read project documentation</p>
          <p className="mt-1 text-secondary">All projects and pages in this workspace, including drafts. Retrieved content will be sent to the connected agent service.</p>
          {canWrite && <label className="mt-5 flex items-start gap-3"><input type="checkbox" name="write" className="mt-1" /><span><span className="block font-medium text-heading">Also allow draft creation and editing</span><span className="mt-1 block text-secondary">Optional. No deletion, publishing or changes to stable pages.</span></span></label>}
        </div>
        <p className="mt-4 break-all text-xs leading-relaxed text-muted">Return address: {params.redirect_uri}</p>
        <p className="mt-3 text-xs text-secondary">You can revoke this connection at any time from your profile.</p>
        <div className="mt-6 flex gap-3">
          <button name="decision" value="deny" className="min-h-11 flex-1 rounded-control border border-border-visible text-sm text-secondary hover:bg-white/5">Cancel</button>
          <button name="decision" value="allow" className="min-h-11 flex-1 rounded-control border border-border-visible bg-white/10 text-sm font-medium text-heading hover:bg-white/15">Allow connection</button>
        </div>
      </form>
    </section>
  </main>;
}
