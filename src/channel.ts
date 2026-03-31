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
  webhookAuthorization: string;
};

function resolveAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedAccount {
  const section = (cfg.channels as Record<string, any>)?.["now4real"];
  const webhookAuthorization = section?.webhookAuthorization;

  if (!webhookAuthorization) throw new Error("now4real: webhookAuthorization is required");

  // Initialize client
  initClient();

  return {
    accountId: accountId ?? null,
    webhookAuthorization,
  };
}

export const now4realPlugin = createChatChannelPlugin<ResolvedAccount>({
  base: createChannelPluginBase({
    id: "now4real",
    capabilities: {
      chatTypes: ["group"],
      polls: false,
      reactions: false,
      threads: false,
      media: false,
      nativeCommands: false,
    },
    config: {
      resolveAccount,
      listAccountIds: () => ["default"],
      inspectAccount(cfg, accountId) {
        const section = (cfg.channels as Record<string, any>)?.["now4real"];
        const active = Boolean(section?.webhookAuthorization);
        return {
          enabled: active,
          configured: active,
          running: active,
          tokenStatus: active ? "available" : "missing",
        };
      },
    },
    setup: {
      resolveAccount,
      listAccountIds: () => ["default"],
      inspectAccount(cfg, accountId) {
        const section = (cfg.channels as Record<string, any>)?.["now4real"];
        const active = Boolean(section?.webhookAuthorization);
        return {
          enabled: active,
          configured: active,
          running: false,
          tokenStatus: active ? "available" : "missing",
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
