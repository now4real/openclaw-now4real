/**
 * Now4real Channel Plugin
 */
import {
  createChatChannelPlugin,
} from "openclaw/plugin-sdk/core";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { now4realApi, initClient } from "./client.js";

export type ResolvedAccount = {
  accountId: string | null;
  webhookAuthorization: string;
  now4realApiKey: string;
  openClawDisplayName: string | null;
  openClawDisplayIcon: string | null;
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
  };
}

function resolveOutboundUser(params: any): { displayName: string; displayIcon?: string } {
  const section = (params?.cfg?.channels as Record<string, any> | undefined)?.["now4real"]
    ?? (params?.config?.channels as Record<string, any> | undefined)?.["now4real"];

  const displayName = String(
    params?.account?.openClawDisplayName
      ?? params?.resolvedAccount?.openClawDisplayName
      ?? section?.openClawDisplayName
      ?? "Chat Bot",
  ).trim() || "Chat Bot";

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

  // Threading: how replies are delivered
  threading: { topLevelReplyToMode: "reply" },

  // Outbound: send messages to the platform
  outbound: {
    attachedResults: {
      channel: "now4real",
      sendText: async (params) => {
        const user = resolveOutboundUser(params);
        const context = resolveOutboundContext(params);
        const result = await now4realApi.sendMessage({
          context,
          user,
          newMessages: [
            {
              content: params.text,
            },
          ],
        });
        return { messageId: result.id ?? `now4real-${Date.now()}` };
      },
      sendMedia: async (params) => {
        const user = resolveOutboundUser(params);
        const context = resolveOutboundContext(params);
        const mediaRef = String(params.mediaUrl ?? params.text ?? "media");
        // Now4real doesn't support direct media upload
        // Send as text link instead
        await now4realApi.sendMessage({
          context,
          user,
          newMessages: [
            {
              content: `[Media: ${mediaRef}]`,
            },
          ],
        });
        return { messageId: `now4real-${Date.now()}` };
      },
    },
    base: {
      deliveryMode: "direct",
    },
  },
});
