# ChatGPT connection

README exposes a remote, stateless MCP server at `/api/mcp`. It does not call
OpenAI's API, run a model, or require an OpenAI API key. The agent performs the
reasoning; README validates, retrieves and stores documentation.

## Deploy

1. Back up PostgreSQL before deploying the schema migration.
2. Set `AUTH_URL=https://readme.lluminaa.net` in the application environment.
   Keep the existing `AUTH_SECRET`, `AUTH_TRUST_HOST` and `DATABASE_URL` settings.
3. Deploy the application. The existing Docker startup runs migrations,
   including `0004_cuddly_revanche.sql`, before starting Next.js.
4. Verify `/.well-known/oauth-authorization-server` returns the correct HTTPS
   issuer and `/api/mcp` returns HTTP 401 with a `WWW-Authenticate` header when
   no access token is supplied. Do not expose the database publicly.

## Connect ChatGPT

1. In ChatGPT on the web, enable Developer mode, then create a custom MCP
   connection. Availability and labels depend on the account/workspace.
2. Server URL: `https://readme.lluminaa.net/api/mcp`. Authentication: OAuth.
3. Copy the exact OAuth callback URL shown by ChatGPT. Do not guess its path.
4. In README, open **Profile → Agent connections** as a workspace owner.
   Register a client named ChatGPT with that callback URL. Check the draft-writing
   option if desired. Callback URIs use exact matching and must be HTTPS.
5. Copy the generated client ID and secret into ChatGPT's OAuth configuration.
   The secret is displayed once; only its SHA-256 hash is stored. Never paste
   the secret into a chat. If lost, disable the client and create another.
6. Connect, log into README and approve read access. Explicitly check draft
   writing on the consent screen to allow create/update tools.
7. Select the connection in a conversation. Try:

   > Use README to list my projects. Read the context for the README project,
   > then create a draft documenting the decisions in this conversation. Use
   > the document schema and only include verified facts. Return the saved URL.

If consent finishes with read-only access, writing tools are deliberately
absent. Reconnect and approve draft writing, then refresh ChatGPT's tool list.
Connections do not grant access to previous conversations or repository files.

## Supported tools

- `list_projects`: paginated summaries.
- `get_project_context`: project metadata and paginated page summaries.
- `search_docs`: PostgreSQL full-text search within the authorized workspace.
- `read_document`: compact context by default; explicit full-content mode.
- `get_document_schema`: strict structured document schema and example.
- `create_document`: new structured draft, with revision attribution.
- `update_document`: structured drafts only, requiring the current version.

No delete, publish, member-administration or repository-execution tools exist.
To propose changes to a stable or Markdown page, create a separate draft.
An uncertain network outcome is not proof a write failed: read the target
document before retrying. Slug uniqueness prevents duplicate create retries.

## Security and operations

- Owner-created confidential OAuth clients only. No open dynamic registration
  or arbitrary client-metadata URL fetching; configure clients manually.
- Authorization code + S256 PKCE. Exact callback, client and resource binding.
- Codes expire in 5 minutes; access tokens in 1 hour; grants in 30 days.
- At most 20 active grants per member/workspace. Excessive refresh history
  invalidates a grant at 1,600 token records; reconnect if a client hits this
  safety limit. Normal hourly refreshes fit within the 30-day lifetime.
- Refresh tokens rotate. Reusing a consumed code/refresh token revokes its
  grant. Tokens and client secrets are random 256-bit values stored as hashes.
- User membership and current role are rechecked on every MCP request.
- Revoke an individual connection or disable all access for an app in settings.
- MCP uses no browser session authentication. Origin checks, Next.js server
  action CSRF checks, consent framing protection and no-store responses apply.
- PostgreSQL-backed per-connection limits: 120 requests and 10 writes per
  minute (writes also consume the request budget). A supplemental per-process
  ceiling bounds public requests. Use Dokploy/reverse-proxy rate limits as
  well for an internet-facing installation.
- Request bodies: at most 320 KiB; documents: at most 256 KiB. Search/list
  results are paginated. Refresh replay records remain until the grant expires;
  expired grants and their tokens are cleaned during subsequent authorizations.
- Do not log Authorization headers, OAuth secrets, codes or token response
  bodies at the reverse proxy. Configure access logs to omit OAuth query strings.
- The generic MCP endpoint can support other clients, but Claude setup has not
  been verified. Register a separate client with its exact callback URLs.
- Codex CLI connects as a separate *public* client (no secret, PKCE only, and
  loopback callbacks). See `docs/CODEX-CONNECTION.md`. Nothing about the
  confidential client type used here changes because of it.

## Tests

`npm run test:documents` and `npm run test:mcp` run without a database.

`npm run test:mcp:db` requires `MCP_TEST_DATABASE_URL` pointing to an isolated
database named **readme_mcp_test**. The test refuses any other database name,
applies migrations, creates isolated fixtures and removes them afterward.
Never point test commands at the application's database.

The integration test uses the official MCP client against the route's real
Streamable HTTP transport. A successful ChatGPT sign-in still requires a live
deployment and user approval in ChatGPT; automated tests do not establish that.

References: [OpenAI authentication](https://developers.openai.com/plugins/build/auth),
[Developer mode](https://developers.openai.com/api/docs/guides/developer-mode).
