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
    siteKey
  };
}

export const now4realPlugin = createChatChannelPlugin<ResolvedAccount>({
  base: createChannelPluginBase({
    id: "now4real",
    config: {
      resolveAccount,
      listAccountIds: () => ["default"],
      inspectAccount(cfg, accountId) {
        const section = (cfg.channels as Record<string, any>)?.["now4real"];
        const active = Boolean(section?.apiKey && section?.siteKey);
        return {
          enabled: active,
          configured: active,
          running: active,
          tokenStatus: section?.apiKey ? "available" : "missing",
        };
      },
    }
  }),

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
