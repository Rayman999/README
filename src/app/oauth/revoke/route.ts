import { revokeToken } from "@/lib/mcp/oauth";
import { oauthFailure, tokenRequest } from "@/lib/mcp/http";
import { jsonResponse } from "@/lib/mcp/security";

export async function POST(req: Request) {
  try {
    const { client, form } = await tokenRequest(req);
    await revokeToken(client.id, form.token ?? "");
    return jsonResponse({});
  } catch (error) { return oauthFailure(error); }
}
