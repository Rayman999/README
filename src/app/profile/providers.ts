// The agent services README can be connected to. Both use the same flow: an
// owner creates a web app here, then pastes its client ID and secret into the
// service's custom connector form.
export const PROVIDERS = {
  claude: {
    label: "Claude",
    callback: "https://claude.ai/api/mcp/auth_callback",
    settingsUrl: "https://claude.ai/settings/connectors",
    // Claude shows exactly this callback; there is nothing to edit.
    editableCallback: false,
  },
  chatgpt: {
    label: "ChatGPT",
    callback: "https://chatgpt.com/connector_platform_oauth_redirect",
    settingsUrl: "https://chatgpt.com/#settings/Connectors",
    // OpenAI has changed this before; let the owner paste what ChatGPT shows.
    editableCallback: true,
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

export function isProvider(value: unknown): value is ProviderId {
  return typeof value === "string" && Object.hasOwn(PROVIDERS, value);
}
