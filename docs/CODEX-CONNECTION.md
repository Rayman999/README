# Codex connection

Codex CLI connects to the same MCP server as ChatGPT, at `/api/mcp`, using the
same tools. What differs is how it authenticates: Codex cannot hold a client
secret, so it uses a **public** OAuth client that proves itself with PKCE alone.

The ChatGPT connection is unaffected by any of this. Confidential clients keep
their secrets, their HTTPS-only exact-match callbacks and their mandatory
resource indicator.

## What was verified, and how

Codex's behaviour was checked against OpenAI's own documentation, not assumed:

| Question | Answer | Source |
| --- | --- | --- |
| Remote MCP over streamable HTTP with OAuth? | Yes | [MCP guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) |
| Manually registered client, or forced dynamic registration? | A configured `client_id` bypasses registration | [MCP guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) |
| Client secret? | Not supported — `client_id` only | [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference) |
| Callback URL | `http://127.0.0.1:<port>/callback/<callback_id>`; a portless registration is allowed and the live port is inserted at login | [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference) |
| Resource indicator (RFC 8707) | Optional, sent only when `oauth_resource` is configured | [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference) |

So a manually registered public client with PKCE is supported, and that is what
this implementation uses. Dynamic client registration was **not** added.

### Compatibility gaps found

1. **No client secret.** Hence the new public client type, rather than trying to
   make Codex behave like a confidential client.
2. **Ephemeral callback port.** The port is chosen by the operating system at
   login, so it cannot be registered in advance. Loopback callbacks therefore
   match on scheme, host and path with the port free, per RFC 8252 §7.3.
   Everything else about the callback is still matched exactly.
3. **Resource indicator is optional.** The server previously required it from
   everyone. It is now required from confidential clients exactly as before, and
   optional for public clients — there is only one protected resource here, so
   an omitted indicator is unambiguous. Configuring `oauth_resource` anyway is
   recommended and documented below.
4. **Codex requests every advertised scope.** It prefers the server's
   `scopes_supported` over its local configuration, so it will ask for
   `docs:read docs:write`. Register the Codex app with draft writing offered
   even if you want read-only use; whether writing is actually granted is
   decided per person on the approval screen.
5. **PKCE is not stated in Codex's documentation.** It is required by the MCP
   specification and by this server for every client, so a Codex login that
   completes has performed S256 PKCE. This is the one item confirmed only by a
   live connection, not by the vendor docs.

## Deploy

1. Back up PostgreSQL.
2. Deploy. The Docker startup runs migrations, including
   `0005_slippery_boomer.sql`, which is additive:
   - adds `oauth_clients.client_type`, defaulting to `confidential`, so every
     existing row (including the ChatGPT client) keeps its current behaviour;
   - drops `NOT NULL` from `oauth_clients.secret_hash`, since public clients
     have no secret. Existing hashes are untouched.
3. No environment variable changes. `AUTH_URL` must still be the HTTPS origin.
4. Rolling back the application without rolling back the migration is safe; the
   reverse is not, if a public client has been created by then.

## Connect Codex

### 1. Register the client (workspace owner, once)

In README, open **Profile → Agent connections**, and under *Register an agent
app* choose **Local or CLI app, no secret**:

- **Connection name**: `Codex`
- **Allowed callback URLs**: `http://127.0.0.1/callback`
- **Offer draft-writing permission**: tick it (see gap 4 above)

Copy the client ID. There is no secret to copy, and the client ID is not
confidential.

If you already know Codex's server-specific callback ID, register the full path
instead — `http://127.0.0.1/callback/readme` — which is tighter. Run
`codex mcp login` once to see the exact callback Codex prints, then register it
with the port removed.

### 2. Add the server

```bash
codex mcp add readme \
  --url https://readme.lluminaa.net/api/mcp \
  --oauth-client-id <client-id>
```

Passing `--oauth-client-id` is what stops Codex attempting dynamic client
registration, which this server does not offer.

### 3. Configure the resource indicator

In `~/.codex/config.toml` (or a project-scoped `.codex/config.toml`):

```toml
[mcp_servers.readme]
url = "https://readme.lluminaa.net/api/mcp"
auth = "oauth"
oauth_resource = "https://readme.lluminaa.net/api/mcp"

[mcp_servers.readme.oauth]
client_id = "<client-id>"
callback_url = "http://127.0.0.1/callback"
```

To pin the callback port instead of letting the OS choose, add
`callback_port = 5555` under `[mcp_servers.readme.oauth]`. The server accepts
either; it does not require the port to match what was registered.

### 4. Log in

```bash
codex mcp login readme
```

A browser window opens on README. Sign in, then approve access. Tick draft
writing only if you want Codex to be able to save documents.

```bash
codex mcp list
```

## Security

Everything the ChatGPT connection relies on still applies: codes bound to
client, callback, resource and PKCE challenge; five-minute codes, one-hour
access tokens, thirty-day grants; rotating refresh tokens; replay of a spent
code or refresh token revokes the grant; membership and role rechecked on every
request; workspace isolation; per-connection rate limits; writes restricted to
structured drafts with version checks.

Specific to public clients:

- **PKCE is mandatory**, and always S256. It is the only proof of possession a
  public client has, so there is no path that skips it.
- **A public client presenting a secret is rejected**, not ignored — a client
  cannot be nudged into the wrong authentication method.
- **A confidential client is never allowed through the secret-less path.** The
  two are separate branches keyed on the stored `client_type`.
- **HTTP is permitted only for `127.0.0.1` and `[::1]`.** `localhost` is
  rejected: it is a name, and what it resolves to is not this server's to
  decide. Non-loopback HTTP, wildcard hosts, credentials, fragments and
  deceptive hosts such as `127.0.0.1.evil.test` are all rejected, at
  registration and again at authorization.
- **Only the port is flexible**, and only for loopback, and only for public
  clients. Once a port is used in an authorization request, the code is bound
  to that exact URI: the token exchange must present the same one.

Dynamic client registration and client ID metadata documents are deliberately
not offered. An owner registers each client by hand.

## Tests

```bash
npm run test:mcp                 # no database
npm run test:mcp:codex:db        # needs MCP_TEST_DATABASE_URL
```

`test:mcp:codex:db` requires an isolated database named **readme_mcp_test** and
refuses any other name. It covers the public-client flow end to end against the
real token route and MCP transport: registration without a secret, loopback port
variance, callback spoofing, missing and wrong PKCE, a confidential client
denied the secret-less path, cross-client code exchange, code replay, refresh
rotation, read-only consent, role downgrade, revocation and client disablement.

**Automated tests are not a Codex connection test.** They exercise this server's
side of the protocol with a synthetic client. Confirming that Codex itself
completes the flow requires a live deployment and a real `codex mcp login`.
