/**
 * Now4real Channel Plugin
 */
import {
  createChatChannelPlugin,
  createChannelPluginBase,
} from "openclaw/plugin-sdk/core";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { now4realApi, initClient } from "./client.js";

export type ResolvedAccount = {
  accountId: string | null;
  apiKey: string;
  siteKey: string;
  webhookSecret: string | undefined;
  allowFrom: string[];
  dmPolicy: string | undefined;
};

function resolveAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedAccount {
  const section = (cfg.channels as Record<string, any>)?.["now4real"];
  const apiKey = section?.apiKey;
  const siteKey = section?.siteKey;

  if (!apiKey) throw new Error("now4real: apiKey is required");
  if (!siteKey) throw new Error("now4real: siteKey is required");

  // Initialize client with resolved config
  initClient({ apiKey, siteKey });

  return {
    accountId: accountId ?? null,
    apiKey,
    siteKey,
    webhookSecret: section?.webhookSecret,
    allowFrom: section?.allowFrom ?? [],
    dmPolicy: section?.dmSecurity,
  };
}

export const now4realPlugin = createChatChannelPlugin<ResolvedAccount>({
  base: createChannelPluginBase({
    id: "channel-now4real",
    setup: {
      resolveAccount,
      listAccountIds(cfg) {
        const section = (cfg.channels as Record<string, any>)?.["now4real"];
        return section?.apiKey && section?.siteKey ? [null] : [];
      },
      inspectAccount(cfg, accountId) {
        const section = (cfg.channels as Record<string, any>)?.["now4real"];
        return {
          enabled: Boolean(section?.apiKey && section?.siteKey),
          configured: Boolean(section?.apiKey && section?.siteKey),
          tokenStatus: section?.apiKey ? "available" : "missing",
        };
      },
    },
  }),

  // DM security: who can message the bot
  security: {
    dm: {
      channelKey: "now4real",
      resolvePolicy: (account) => account.dmPolicy,
      resolveAllowFrom: (account) => account.allowFrom,
      defaultPolicy: "allowlist",
    },
  },

  // Pairing: approval flow for new DM contacts
  pairing: {
    text: {
      idLabel: "Now4real user ID",
      message: "Send this code to verify your identity:",
      notify: async ({ target, code }) => {
        await now4realApi.sendDm(target, `Pairing code: ${code}`);
      },
    },
  },

  // Threading: how replies are delivered
  threading: { topLevelReplyToMode: "reply" },

  // Outbound: send messages to the platform
  outbound: {
    attachedResults: {
      sendText: async (params) => {
        const result = await now4realApi.sendMessage(params.to, params.text);
        return { messageId: result.id };
      },
    },
    base: {
      sendMedia: async (params) => {
        // Now4real doesn't support direct media upload
        // Send as text link instead
        await now4realApi.sendMessage(
          params.to,
          `[Media: ${params.filePath}]`,
        );
      },
    },
  },
});
