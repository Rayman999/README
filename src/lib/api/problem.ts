/**
 * RFC 7807 `application/problem+json` errors (BUILD.md §6). The API is
 * agent-facing — a vague `{ error: "..." }` string costs an agent a round
 * trip to figure out what went wrong; a typed, consistent shape doesn't.
 */
export function problem(
  status: number,
  title: string,
  detail?: string,
  extra?: Record<string, unknown>,
) {
  return Response.json(
    { type: "about:blank", title, status, detail, ...extra },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

export const notFound = (detail?: string) =>
  problem(404, "Not Found", detail);

export const badRequest = (detail?: string, extra?: Record<string, unknown>) =>
  problem(400, "Bad Request", detail, extra);

export const unauthorized = (detail?: string) =>
  problem(401, "Unauthorized", detail);

export const forbidden = (detail?: string) =>
  problem(403, "Forbidden", detail);

export const conflict = (detail?: string) =>
  problem(409, "Conflict", detail);
