import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db";
import { registrationAllowed } from "../src/lib/workspace";
import { signUpWithPassword } from "../src/app/login/actions";

const workspace = {
  id: "workspace", slug: "main", name: "Workspace", publicRead: false,
  registrationOpen: false, createdAt: new Date(),
};

test("closed signup rejects direct and stale-form requests before checking accounts", async context => {
  context.mock.method(db.query.workspaces, "findFirst", async () => workspace);
  const lookup = context.mock.method(db.query.users, "findFirst", async () => {
    throw new Error("Closed signup must not query accounts");
  });
  const insert = context.mock.method(db, "insert", () => {
    throw new Error("Closed signup must not create accounts");
  });
  context.after(() => context.mock.restoreAll());

  const valid = new FormData();
  valid.set("name", "New user");
  valid.set("email", "new@example.test");
  valid.set("password", "TestPassword123!");
  for (const form of [valid, new FormData()]) {
    assert.deepEqual(await signUpWithPassword(undefined, form), {
      error: "Registration is closed. Ask a workspace owner to add you.",
    });
  }
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal(insert.mock.callCount(), 0);
});

test("signup fails closed when registration settings cannot be read", async context => {
  context.mock.method(db.query.workspaces, "findFirst", async () => {
    throw new Error("Database unavailable");
  });
  const insert = context.mock.method(db, "insert", () => {
    throw new Error("Unavailable settings must not allow signup");
  });
  context.after(() => context.mock.restoreAll());
  const result = await signUpWithPassword(undefined, new FormData());
  assert.match(result?.error ?? "", /database is unavailable/i);
  assert.equal(insert.mock.callCount(), 0);
});

test("registration respects the workspace setting and allows initial setup", async context => {
  context.after(() => context.mock.restoreAll());
  let current: typeof workspace | undefined = workspace;
  context.mock.method(db.query.workspaces, "findFirst", async () => current);
  assert.equal(await registrationAllowed(), false);
  current = { ...workspace, registrationOpen: true };
  assert.equal(await registrationAllowed(), true);
  current = undefined;
  assert.equal(await registrationAllowed(), true);
});
