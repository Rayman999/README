import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizationInput, challengeFor, clientInput, digest, matchesSecret, parseScopes, safeReturnTo, secret } from "../src/lib/mcp/security";

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
