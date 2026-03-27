import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

import type { Now4realChannelConfig, ResolvedNow4realAccount } from "./types.js";

const DEFAULTS = {
  agentId: "main",
  displayName: "OpenClaw",
  activation: "mention-or-reply",
  sessionMode: "page",
  groupRequireMention: true,
  maxContextMessages: 40,
  webhookPath: "/now4real/webhook",
} as const;

export function readNow4realConfig(cfg: OpenClawConfig): Now4realChannelConfig {
  return ((cfg.channels as Record<string, unknown> | undefined)?.now4real ??
    {}) as Now4realChannelConfig;
}

export function resolveNow4realAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedNow4realAccount {
  const section = readNow4realConfig(cfg);
  return {
    accountId: accountId ?? null,
    enabled: section.enabled !== false,
    agentId: section.agentId?.trim() || DEFAULTS.agentId,
    displayName: section.displayName?.trim() || DEFAULTS.displayName,
    displayIcon: section.displayIcon?.trim() || undefined,
    activation: section.activation ?? DEFAULTS.activation,
    sessionMode: section.sessionMode ?? DEFAULTS.sessionMode,
    groupRequireMention: section.groupRequireMention ?? DEFAULTS.groupRequireMention,
    siteAllowlist: section.siteAllowlist ?? [],
    allowedQueryTokens: section.allowedQueryTokens ?? [],
    suggestions: section.suggestions ?? [],
    maxContextMessages: section.maxContextMessages ?? DEFAULTS.maxContextMessages,
    webhookPath: section.webhookPath ?? DEFAULTS.webhookPath,
  };
}

export function inspectNow4realAccount(cfg: OpenClawConfig) {
  const section = readNow4realConfig(cfg);
  return {
    enabled: section.enabled !== false,
    configured: true,
    agentId: section.agentId ?? DEFAULTS.agentId,
    activation: section.activation ?? DEFAULTS.activation,
    webhookPath: section.webhookPath ?? DEFAULTS.webhookPath,
  };
}
