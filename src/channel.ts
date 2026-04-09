/**
 * Now4real Channel Plugin
 */
import {
  createChatChannelPlugin,
} from "openclaw/plugin-sdk/core";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { chunkMarkdownText } from "openclaw/plugin-sdk/reply-runtime";
import { now4realApi, initClient } from "./client.js";
import { DEFAULT_BOT_DISPLAY_NAME } from "./constants.js";

const DEFAULT_NOW4REAL_MAX_MESSAGE_LENGTH = 1000;

export type ResolvedAccount = {
  accountId: string | null;
  webhookAuthorization: string;
  now4realApiKey: string;
  openClawDisplayName: string | null;
  openClawDisplayIcon: string | null;
  requireMention: boolean;
};

function resolveAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedAccount {
  const section = (cfg.channels as Record<string, any>)?.["now4real"];
  const enabled = section?.enabled;
  const webhookAuthorization = section?.webhookAuthorization;
  const now4realApiKey = section?.now4realApiKey;

  if (!enabled) throw new Error("now4real channel disabled");
  if (!webhookAuthorization) throw new Error("now4real: webhookAuthorization is required");
  if (!now4realApiKey) {
    throw new Error("now4real: now4realApiKey is required");
  }

  // Initialize client
  initClient(now4realApiKey);

  return {
    accountId: accountId ?? null,
    webhookAuthorization,
    now4realApiKey,
    openClawDisplayName: section?.openClawDisplayName ?? null,
    openClawDisplayIcon: section?.openClawDisplayIcon ?? null,
    requireMention: section?.requireMention === true,
  };
}

function resolveOutboundUser(params: any): { displayName: string; displayIcon?: string } {
  const section = (params?.cfg?.channels as Record<string, any> | undefined)?.["now4real"]
    ?? (params?.config?.channels as Record<string, any> | undefined)?.["now4real"];

  const displayName = String(
    params?.account?.openClawDisplayName
      ?? params?.resolvedAccount?.openClawDisplayName
      ?? section?.openClawDisplayName
      ?? DEFAULT_BOT_DISPLAY_NAME,
  ).trim() || DEFAULT_BOT_DISPLAY_NAME;

  const rawIcon =
    params?.account?.openClawDisplayIcon
    ?? params?.resolvedAccount?.openClawDisplayIcon
    ?? section?.openClawDisplayIcon;
  const displayIcon = typeof rawIcon === "string" ? rawIcon.trim() : "";

  return {
    displayName,
    ...(displayIcon ? { displayIcon } : {}),
  };
}

function resolveOutboundContext(params: any): { site: string; page: string } {
  const fromExplicitContext = params?.context ?? params?.ctx?.context;
  const site = String(fromExplicitContext?.site ?? "").trim();
  const page = String(fromExplicitContext?.page ?? "").trim();
  if (site && page) {
    return { site, page };
  }

  // Fallback: To is built as `${site}${page}` in inbound flow.
  const rawTo = String(params?.ctx?.To ?? params?.to ?? "").trim();
  const firstSlash = rawTo.indexOf("/");
  if (firstSlash > 0) {
    const fallbackSite = rawTo.slice(0, firstSlash).trim();
    const fallbackPage = rawTo.slice(firstSlash).trim();
    if (fallbackSite && fallbackPage) {
      return {
        site: fallbackSite,
        page: fallbackPage,
      };
    }
  }

  throw new Error("now4real: missing outbound context (site/page)");
}

export const now4realPlugin = createChatChannelPlugin<ResolvedAccount>({
  base: {
    id: "now4real",
    meta: {
      id: "now4real",
      label: "Now4real",
      selectionLabel: "Now4real",
      docsPath: "plugins/channels/now4real",
      blurb: "Connect OpenClaw to Now4real pagechat.",
    },
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
      listAccountIds: (_cfg: OpenClawConfig) => ["default"],
      inspectAccount(cfg: OpenClawConfig, _accountId?: string | null) {
        const section = (cfg.channels as Record<string, any>)?.["now4real"];
        const enabled = Boolean(section?.enabled);
        const configured = Boolean(
          section?.webhookAuthorization && section?.now4realApiKey,
        );
        return {
          enabled: enabled,
          configured: configured,
          running: enabled && configured,
          tokenStatus: configured ? "available" : "missing",
        };
      },
    },
    setup: {
      resolveAccountId: ({ accountId }) => accountId?.trim() || "default",
      applyAccountConfig: ({ cfg, accountId }) => {
        const channels = (cfg.channels as Record<string, any> | undefined) ?? {};
        const section = (channels["now4real"] as Record<string, any> | undefined) ?? {};

        return {
          ...cfg,
          channels: {
            ...channels,
            now4real: {
              ...section,
              enabled: true,
              accountId: accountId || "default",
            },
          },
        } as OpenClawConfig;
      },
    }
  },

  // Threading: read replyToMode from channels.now4real.replyToMode
  threading: { topLevelReplyToMode: "now4real" },

  // Outbound: send messages to the platform
  outbound: {
    attachedResults: {
      channel: "now4real",
      sendText: async (params) => {
        console.log("Now4real outbound sendText params:", params);

        const user = resolveOutboundUser(params);
        const context = resolveOutboundContext(params);
        const replyMessageId = String(params.replyToId ?? "").trim();
        const chunks = chunkMarkdownText(
          String(params.text ?? "").trim(),
          DEFAULT_NOW4REAL_MAX_MESSAGE_LENGTH,
        );

        if (chunks.length === 0) {
          return { messageId: `now4real-${Date.now()}` };
        }

        const payload = {
          context,
          user,
          newMessages: chunks.map((content, index) => ({
            content,
            ...(index === 0 && replyMessageId ? { replyMessageId } : {}),
          })),
        };

        let result;
        try {
          result = await now4realApi.sendMessage(payload);
        } catch (error) {
          console.error("Now4real outbound sendText failed:", error);
          throw error;
        }

        return { messageId: result.id ?? `now4real-${Date.now()}` };
      },
      sendMedia: async (params) => {
        console.log("Now4real outbound sendMedia params:", params);

        const user = resolveOutboundUser(params);
        const context = resolveOutboundContext(params);
        const mediaRef = String(params.mediaUrl ?? params.text ?? "media");
        const replyMessageId = String(params.replyToId ?? "").trim();
        const mediaText = `[Media: ${mediaRef}]`;
        const chunks = chunkMarkdownText(mediaText, DEFAULT_NOW4REAL_MAX_MESSAGE_LENGTH);

        if (chunks.length === 0) {
          return { messageId: `now4real-${Date.now()}` };
        }

        // Now4real doesn't support direct media upload
        // Send as text link instead
        const payload = {
          context,
          user,
          newMessages: chunks.map((content, index) => ({
            content,
            ...(index === 0 && replyMessageId ? { replyMessageId } : {}),
          })),
        };

        let result;
        try {
          result = await now4realApi.sendMessage(payload);
        } catch (error) {
          console.error("Now4real outbound sendMedia failed:", error);
          throw error;
        }

        return { messageId: result.id ?? `now4real-${Date.now()}` };
      },
    },
    base: {
      deliveryMode: "gateway",
    },
  },
});
