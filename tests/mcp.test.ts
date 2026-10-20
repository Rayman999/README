import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizationInput, challengeFor, clientInput, digest, matchesSecret, parseScopes, redirectUriMatches, resourceAccepted, safeReturnTo, secret } from "../src/lib/mcp/security";

test("random secrets are hashed and PKCE is S256", () => {
  const token = secret();
  assert.equal(token.length, 43);
  assert.notEqual(token, secret());
  assert.equal(matchesSecret(token, digest(token)), true);
  assert.equal(matchesSecret(secret(), digest(token)), false);
  assert.equal(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("client redirects, scopes, return paths and PKCE are constrained", () => {
  const client = { name: "ChatGPT", redirectUris: ["https://chatgpt.com/connector/oauth/callback"], scopes: ["docs:read"] };
  assert.equal(clientInput.safeParse(client).success, true);
  for (const uri of ["http://example.com/callback", "javascript:alert(1)", "https://user:pass@example.com/callback", "https://example.com/callback#fragment"]) {
    assert.equal(clientInput.safeParse({ ...client, redirectUris: [uri] }).success, false);
  }
  assert.throws(() => parseScopes("docs:write"));
  assert.throws(() => parseScopes("docs:read admin"));
  assert.deepEqual(parseScopes("docs:read docs:read"), ["docs:read"]);
  assert.equal(authorizationInput.safeParse({ code_challenge_method: "plain" }).success, false);
  for (const path of ["//evil.test", "https://evil.test", "/\\evil.test", "/oauth/authorize/../../evil", "javascript:alert(1)"]) assert.equal(safeReturnTo(path), "/");
  assert.equal(safeReturnTo("/oauth/authorize?state=abc"), "/oauth/authorize?state=abc");
});

test("callbacks are HTTPS only and matched exactly", () => {
  const base = { name: "Claude", scopes: ["docs:read"] };
  for (const uri of ["http://127.0.0.1/callback", "http://[::1]/callback", "http://localhost/callback"]) {
    assert.equal(clientInput.safeParse({ ...base, redirectUris: [uri] }).success, false, uri);
  }
  // The retired client type is no longer accepted at registration.
  assert.equal(clientInput.safeParse({ ...base, clientType: "public", redirectUris: ["https://claude.ai/api/mcp/auth_callback"] }).success, false);
  const registered = ["https://claude.ai/api/mcp/auth_callback"];
  assert.equal(redirectUriMatches(registered, "https://claude.ai/api/mcp/auth_callback"), true);
  for (const candidate of ["https://claude.ai/api/mcp/auth_callback/evil", "https://claude.ai:8443/api/mcp/auth_callback", "https://claude.ai/api/mcp/auth_callback?x=1"]) {
    assert.equal(redirectUriMatches(registered, candidate), false, candidate);
  }
});

test("the resource indicator is required and must name this server", () => {
  process.env.AUTH_URL = "http://localhost:3100";
  const target = "http://localhost:3100/api/mcp";
  assert.equal(resourceAccepted(target), true);
  for (const value of [undefined, "", "https://evil.test/api/mcp", "http://localhost:3100/api/mcp/extra"]) assert.equal(resourceAccepted(value), false);

  const authorization = { response_type: "code", client_id: "11111111-1111-4111-8111-111111111111", redirect_uri: "https://claude.ai/api/mcp/auth_callback", code_challenge: challengeFor(secret()), code_challenge_method: "S256", state: "s", scope: "docs:read", resource: target };
  assert.equal(authorizationInput.safeParse(authorization).success, true);
  assert.equal(authorizationInput.safeParse({ ...authorization, resource: undefined }).success, false);
  assert.equal(authorizationInput.safeParse({ ...authorization, code_challenge: undefined }).success, false);
  assert.equal(authorizationInput.safeParse({ ...authorization, state: "" }).success, false);
  assert.equal(authorizationInput.safeParse({ ...authorization, redirect_uri: "http://127.0.0.1/callback" }).success, false);
});
