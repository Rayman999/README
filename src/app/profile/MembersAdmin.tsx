"use client";

import { useState, useTransition } from "react";
import type { Member, Role } from "@/lib/workspace";
import {
  changeMemberRole,
  changeRegistration,
  removeWorkspaceMember,
} from "./actions";

const ROLE_HINT: Record<Role, string> = {
  owner: "Full access, including this page.",
  editor: "Can create and edit projects and pages.",
  viewer: "Read-only.",
};

function initialOf(member: Member) {
  return (member.name ?? member.email).trim().charAt(0).toUpperCase();
}

function methodLabel(member: Member) {
  const methods: string[] = [];
  if (member.hasPassword) methods.push("Password");
  if (member.providers.includes("github")) methods.push("GitHub");
  return methods.length > 0 ? methods.join(" · ") : "No sign-in method";
}

export function MembersAdmin({
  members,
  currentUserId,
  registrationOpen,
}: {
  members: Member[];
  currentUserId: string;
  registrationOpen: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  // Which row is mid-flight, so a slow request disables only that row rather
  // than greying out the whole table.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ownerCount = members.filter((m) => m.role === "owner").length;

  const run = (
    id: string,
    work: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      setBusyId(null);
      setConfirmingId(null);
    });
  };

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-code border border-border-subtle bg-white/[0.022] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-secondary"
          style={{ borderLeft: "2px solid #8A6A62" }}
        >
          {error}
        </div>
      )}

      {/* --- sign-up switch ------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-code border border-border-subtle bg-white/[0.018] px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-primary">Open sign-up</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-secondary">
            {registrationOpen
              ? "Anyone with the link can create an account, and joins as a viewer."
              : "The sign-up form is closed. Existing members can still sign in."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={registrationOpen}
          aria-label="Open sign-up"
          disabled={isPending && busyId === "registration"}
          onClick={() =>
            run("registration", () => changeRegistration(!registrationOpen))
          }
          className={`ease-base relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-50 ${
            registrationOpen
              ? "border-white/20 bg-white/[0.16]"
              : "border-border-visible bg-white/[0.03]"
          }`}
        >
          <span
            aria-hidden
            className="ease-base absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white/70 transition-[left] duration-200"
            style={{ left: registrationOpen ? 18 : 2 }}
          />
        </button>
      </div>

      {/* --- member list --------------------------------------------------- */}
      <ul className="mt-4 divide-y divide-border-subtle rounded-code border border-border-subtle">
        {members.map((member) => {
          const isSelf = member.userId === currentUserId;
          const lastOwner = member.role === "owner" && ownerCount <= 1;
          // Self-management is refused by the server too; disabling the
          // controls here just stops people asking for something they cannot
          // have. The last owner is locked for the same reason.
          const locked = isSelf || lastOwner;
          const rowBusy = isPending && busyId === member.userId;

          return (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-visible bg-white/[0.03] text-[12px] font-medium text-tertiary"
              >
                {initialOf(member)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-primary">
                  {member.name ?? member.email}
                  {isSelf && (
                    <span className="ml-2 text-[11px] text-muted">you</span>
                  )}
                </p>
                <p className="truncate text-[12px] text-muted">
                  {member.name ? `${member.email} · ` : ""}
                  {methodLabel(member)}
                </p>
              </div>

              <select
                aria-label={`Role for ${member.name ?? member.email}`}
                value={member.role}
                disabled={locked || rowBusy}
                onChange={(e) =>
                  run(member.userId, () =>
                    changeMemberRole(member.userId, e.target.value as Role),
                  )
                }
                title={
                  isSelf
                    ? "You cannot change your own role."
                    : lastOwner
                      ? "The only owner cannot be demoted."
                      : ROLE_HINT[member.role]
                }
                className="ease-base h-8 rounded-control border border-border-visible px-2 text-[12.5px] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="owner">Owner</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>

              {confirmingId === member.userId ? (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() =>
                      run(member.userId, () =>
                        removeWorkspaceMember(member.userId),
                      )
                    }
                    className="ease-base h-8 rounded-control border px-2.5 text-[12px] text-primary transition-colors duration-200 hover:bg-white/[0.06] disabled:opacity-50"
                    style={{ borderColor: "rgba(138,106,98,0.55)" }}
                  >
                    {rowBusy ? "Removing…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="ease-base h-8 rounded-control px-2 text-[12px] text-muted transition-colors duration-200 hover:text-secondary"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={locked || rowBusy}
                  onClick={() => setConfirmingId(member.userId)}
                  title={
                    isSelf
                      ? "You cannot remove yourself."
                      : lastOwner
                        ? "The only owner cannot be removed."
                        : "Remove from the workspace"
                  }
                  className="ease-base h-8 rounded-control px-2.5 text-[12px] text-muted transition-colors duration-200 hover:bg-state-hover hover:text-secondary disabled:pointer-events-none disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
        Removing someone keeps their account but drops their access. Their
        session ends on their next request, and they cannot sign back in until
        an owner adds them again.
      </p>
    </>
  );
}
