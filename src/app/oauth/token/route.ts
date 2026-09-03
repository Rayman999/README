import { exchangeToken } from "@/lib/mcp/oauth";
import { oauthFailure, tokenRequest } from "@/lib/mcp/http";
import { jsonResponse } from "@/lib/mcp/security";

export async function POST(req: Request) {
  try {
    const { client, form } = await tokenRequest(req);
    return jsonResponse(await exchangeToken(client.id, form));
  } catch (error) { return oauthFailure(error); }
}
