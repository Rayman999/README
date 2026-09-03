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

// --- public clients -------------------------------------------------------

test("a confidential client still cannot register an http callback of any kind", () => {
  const base = { name: "ChatGPT", scopes: ["docs:read"], clientType: "confidential" as const };
  for (const uri of ["http://127.0.0.1/callback", "http://[::1]/callback", "http://localhost/callback"]) {
    assert.equal(clientInput.safeParse({ ...base, redirectUris: [uri] }).success, false);
  }
  // Absent clientType means confidential, so existing registrations are unaffected.
  assert.equal(clientInput.safeParse({ name: "x", scopes: ["docs:read"], redirectUris: ["http://127.0.0.1/callback"] }).success, false);
});

test("a public client may register loopback http and https, and nothing else", () => {
  const base = { name: "Codex", scopes: ["docs:read"], clientType: "public" as const };
  for (const uri of ["http://127.0.0.1/callback", "http://[::1]/callback", "http://127.0.0.1:5555/callback", "https://app.example.com/cb"]) {
    assert.equal(clientInput.safeParse({ ...base, redirectUris: [uri] }).success, true, uri);
  }
  for (const uri of [
    "http://localhost/callback",            // a name, not a literal: what it resolves to is not ours to decide
    "http://127.0.0.1.evil.test/callback",  // deceptive host that merely starts with the literal
    "http://evil.test/callback",            // non-loopback http
    "http://0.0.0.0/callback",              // not a loopback address
    "http://user:pass@127.0.0.1/callback",  // credentials
    "http://127.0.0.1/callback#frag",       // fragment
    "http://127.0.0.1/callback?next=x",     // query of its own
    "http://*.example.com/callback",        // wildcard host
    "javascript:alert(1)",
  ]) {
    assert.equal(clientInput.safeParse({ ...base, redirectUris: [uri] }).success, false, uri);
  }
});

test("loopback ports vary, everything else about the callback does not", () => {
  const registered = ["http://127.0.0.1/callback/readme"];

  // RFC 8252 section 7.3: the port is chosen at login time and cannot be known
  // at registration, so any port on the registered host and path is accepted.
  for (const candidate of ["http://127.0.0.1:52341/callback/readme", "http://127.0.0.1:5555/callback/readme", "http://127.0.0.1/callback/readme"]) {
    assert.equal(redirectUriMatches(registered, candidate, "public"), true, candidate);
  }
  // A registered fixed port likewise does not pin the listener.
  assert.equal(redirectUriMatches(["http://127.0.0.1:5555/callback"], "http://127.0.0.1:8123/callback", "public"), true);

  for (const candidate of [
    "http://127.0.0.1:52341/callback/other",  // different path
    "http://127.0.0.1:52341/callback",        // prefix of the registered path
    "http://[::1]:52341/callback/readme",     // different host literal
    "http://localhost:52341/callback/readme",
    "http://127.0.0.1.evil.test/callback/readme",
    "https://127.0.0.1/callback/readme",      // different scheme
    "http://127.0.0.1:52341/callback/readme?code=stolen",
    "http://127.0.0.1:52341/callback/readme#x",
    "http://user@127.0.0.1:52341/callback/readme",
    "http://evil.test/callback/readme",
  ]) {
    assert.equal(redirectUriMatches(registered, candidate, "public"), false, candidate);
  }

  // The port rule is exclusive to public clients: a confidential client is
  // matched by exact string only, exactly as it was before.
  assert.equal(redirectUriMatches(registered, "http://127.0.0.1:52341/callback/readme", "confidential"), false);
  assert.equal(redirectUriMatches(registered, "http://127.0.0.1/callback/readme", "confidential"), true);
  const https = ["https://chatgpt.com/connector/oauth/callback"];
  assert.equal(redirectUriMatches(https, "https://chatgpt.com/connector/oauth/callback", "confidential"), true);
  assert.equal(redirectUriMatches(https, "https://chatgpt.com/connector/oauth/callback/evil", "confidential"), false);
  // An https callback gets no port flexibility even for a public client.
  assert.equal(redirectUriMatches(https, "https://chatgpt.com:8443/connector/oauth/callback", "public"), false);
});

test("the resource indicator is required of confidential clients and validated for everyone", () => {
  process.env.AUTH_URL = "http://localhost:3100";
  const target = "http://localhost:3100/api/mcp";

  assert.equal(resourceAccepted(target, "confidential"), true);
  assert.equal(resourceAccepted(target, "public"), true);
  // Omitted is unambiguous here — there is one protected resource — but it is
  // only tolerated from a public client, so ChatGPT's binding is unchanged.
  assert.equal(resourceAccepted(undefined, "confidential"), false);
  assert.equal(resourceAccepted(undefined, "public"), true);
  // A supplied value must match whoever sends it.
  for (const type of ["confidential", "public"] as const) {
    assert.equal(resourceAccepted("https://evil.test/api/mcp", type), false);
    assert.equal(resourceAccepted("http://localhost:3100/api/mcp/extra", type), false);
    assert.equal(resourceAccepted("", type), false);
  }

  // The authorization schema accepts the parameter's absence and still demands
  // S256 PKCE, a state and a valid callback.
  const authorization = { response_type: "code", client_id: "11111111-1111-4111-8111-111111111111", redirect_uri: "http://127.0.0.1/callback", code_challenge: challengeFor(secret()), code_challenge_method: "S256", state: "s", scope: "docs:read" };
  assert.equal(authorizationInput.safeParse(authorization).success, true);
  assert.equal(authorizationInput.safeParse({ ...authorization, resource: target }).success, true);
  assert.equal(authorizationInput.safeParse({ ...authorization, code_challenge: undefined }).success, false);
  assert.equal(authorizationInput.safeParse({ ...authorization, state: "" }).success, false);
  assert.equal(authorizationInput.safeParse({ ...authorization, redirect_uri: "http://evil.test/cb" }).success, false);
});
