/**
 * Inbound webhook handler for Now4real
 */
import { now4realPlugin, type ResolvedAccount } from "./channel.js";
import {
  createReplyDispatcherWithTyping,
  dispatchInboundMessage,
  finalizeInboundContext,
} from "openclaw/plugin-sdk/reply-runtime";
import { resolveSendableOutboundReplyParts } from "openclaw/plugin-sdk/reply-payload";
import { DEFAULT_BOT_DISPLAY_NAME } from "./constants.js";
import { containsBotMention, extractKlipyGifId } from "./utils.js";

export interface Now4realWebhookUser {
  id: string;
  displayName: string;
  jwtSub: string;
  authProvider: string;
}

export interface Now4realWebhookMessage {
  id: string;
  time: string;
  user: Now4realWebhookUser;
  replyMessageId?: string;
  content: string;
}

export interface Now4realWebhookEvent {
  context: {
    site: string;
    page: string;
  };
  chat: {
    messages: Now4realWebhookMessage[];
  };
  newMessage: Now4realWebhookMessage;
}

export type InboundReplyLifecycleHooks = {
  onAgentReplyStart?: () => void | Promise<void>;
  onAgentReplyDone?: () => void | Promise<void>;
};

type KlipyGifContext = {
  id: string;
  description: string | null;
};

const KLIPY_API_BASE_URL = "https://api.klipy.com";
const KLIPY_API_POSTS_PATH = "/v2/posts";
const KLIPY_API_TIMEOUT_MS = 3500;

function resolveKlipyApiUrl(appKey: string, gifId: string): string {
  const baseUrl = KLIPY_API_BASE_URL.replace(/\/+$/, "");
  const path = KLIPY_API_POSTS_PATH;
  return `${baseUrl}${path}?key=${encodeURIComponent(appKey)}&ids=${encodeURIComponent(gifId)}`;
}

function extractStringFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const obj = payload as Record<string, unknown>;
  const candidatePaths = [
    ["results", "0", "content_description"],
    ["results", "0", "title"],
    ["results", "0", "content_description_source"],
    ["results", "0", "itemurl"],
    ["description"],
    ["title"],
    ["alt"],
    ["caption"],
    ["gif", "description"],
    ["data", "description"],
    ["data", "title"],
    ["data", "gif", "description"],
    ["result", "description"],
    ["items", "0", "description"],
    ["items", "0", "title"],
    ["data", "items", "0", "description"],
    ["data", "items", "0", "title"],
  ];

  for (const path of candidatePaths) {
    let current: unknown = obj;
    let resolved = true;

    for (const segment of path) {
      if (Array.isArray(current)) {
        const index = Number(segment);
        if (!Number.isInteger(index) || index < 0 || index >= current.length) {
          resolved = false;
          break;
        }
        current = current[index];
        continue;
      }

      if (!current || typeof current !== "object" || !(segment in (current as Record<string, unknown>))) {
        resolved = false;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    if (!resolved || typeof current !== "string") {
      continue;
    }

    const normalized = current.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function sanitizeDescription(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function resolveKlipyGifContext(config: any, message: string): Promise<KlipyGifContext | null> {
  const section = (config?.channels as Record<string, any> | undefined)?.["now4real"];
  const appKey = String(section?.klipyApiAuthorization ?? "").trim();
  if (!appKey) {
    return null;
  }

  const gifId = extractKlipyGifId(message);
  if (!gifId) {
    return null;
  }

  const timeoutMs = KLIPY_API_TIMEOUT_MS;
  const apiUrl = resolveKlipyApiUrl(appKey, gifId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3500);

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("Klipy GIF metadata request failed", {
        gifId,
        apiUrl,
        status: response.status,
        statusText: response.statusText,
      });
      return { id: gifId, description: null };
    }

    const payload = await response.json().catch(() => null);
    const description = extractStringFromPayload(payload);

    return {
      id: gifId,
      description: description ? sanitizeDescription(description) : null,
    };
  } catch (error) {
    console.warn("Klipy GIF metadata request errored", { gifId, apiUrl, error });
    return { id: gifId, description: null };
  } finally {
    clearTimeout(timer);
  }
}

function buildGifContextForOpenClaw(originalMessage: string, context: KlipyGifContext): string {
  const description = context.description ?? "description_not_available";
  return [
    originalMessage,
    "",
    "[KLIPY_GIF_CONTEXT]",
    `gif_id=${context.id}`,
    `gif_description=${description}`,
  ].join("\n");
}

export async function handleNow4realInbound(
  config: any,
  event: Now4realWebhookEvent,
  account: ResolvedAccount,
  hooks?: InboundReplyLifecycleHooks,
): Promise<void> {
  const inboundText = String(event.newMessage.content ?? "");
  if (account.requireMention) {
    const botName = String(account.openClawDisplayName ?? DEFAULT_BOT_DISPLAY_NAME).trim();
    if (!containsBotMention(inboundText, botName)) {
      console.log("Now4real inbound ignored: mention required", {
        botName,
        messageId: String(event.newMessage.id ?? "").trim(),
      });
      return;
    }
  }

  const klipyGifContext = await resolveKlipyGifContext(config, inboundText);
  const openClawBody = klipyGifContext
    ? buildGifContextForOpenClaw(inboundText, klipyGifContext)
    : inboundText;

  const site = String(event.context.site ?? "").trim();
  const page = String(event.context.page ?? "").trim();
  const channelContextId = `${site}${page}`;
  const sessionKey = `agent:main:now4real:channel:${channelContextId}`;
  const currentMessageId = String(event.newMessage.id ?? "").trim();
  const replyToMessageId = String(event.newMessage.replyMessageId ?? "").trim();

  // Construct context payload for OpenClaw
  const ctxPayload = {
    Body: openClawBody,
    From: event.newMessage.user.id,
    To: channelContextId,
    OriginatingChannel: "now4real",
    OriginatingTo: channelContextId,
    SenderName: event.newMessage.user.displayName,
    SenderId: event.newMessage.user.id,
    SessionKey: sessionKey,
    AccountId: account.accountId ?? undefined,
    ...(currentMessageId
      ? {
        MessageSid: currentMessageId,
        MessageSidFull: currentMessageId,
      }
      : {}),
    ...(replyToMessageId
      ? {
        ReplyToId: replyToMessageId,
        ReplyToIdFull: replyToMessageId,
      }
      : {}),
    Timestamp: new Date(event.newMessage.time).getTime(),
    Provider: "now4real",
    InboundHistory: event.chat.messages.map((m) => ({
      sender: m.user.displayName,
      body: m.content,
      timestamp: new Date(m.time).getTime(),
    })),
  };

  console.log('Now4real inbound message received, context payload:', ctxPayload);

  // Dispatch message to OpenClaw.
  // Reply delivery is routed by OpenClaw via channel outbound adapters.
  let didSignalReplyDone = false;

  const signalReplyDone = async () => {
    if (didSignalReplyDone) return;
    didSignalReplyDone = true;
    await hooks?.onAgentReplyDone?.();
  };

  const deliverOutboundReply = async (payload: { text?: string; mediaUrl?: string; mediaUrls?: string[]; replyToId?: string }) => {
    const outbound = now4realPlugin.outbound;
    if (!outbound?.sendText) {
      throw new Error("now4real: outbound.sendText is not available");
    }

    const parts = resolveSendableOutboundReplyParts(payload);
    if (!parts.hasContent) {
      return;
    }

    if (parts.hasMedia) {
      const sendMedia = outbound.sendMedia;
      if (!sendMedia) {
        throw new Error("now4real: outbound.sendMedia is not available");
      }

      for (let i = 0; i < parts.mediaUrls.length; i += 1) {
        const mediaUrl = parts.mediaUrls[i];
        await sendMedia({
          cfg: config,
          to: channelContextId,
          text: i === 0 ? parts.text : "",
          mediaUrl,
          replyToId: payload.replyToId ?? undefined,
          accountId: account.accountId ?? undefined,
        });
      }
      return;
    }

    await outbound.sendText({
      cfg: config,
      to: channelContextId,
      text: parts.text,
      replyToId: payload.replyToId ?? undefined,
      accountId: account.accountId ?? undefined,
    });
  };

  const { dispatcher, replyOptions, markDispatchIdle, markRunComplete } = createReplyDispatcherWithTyping({
    onReplyStart: () => hooks?.onAgentReplyStart?.(),
    onIdle: () => {
      void signalReplyDone();
    },
    deliver: async (payload) => {
      await deliverOutboundReply(payload as { text?: string; mediaUrl?: string; mediaUrls?: string[]; replyToId?: string });
    },
  });

  try {
    await dispatchInboundMessage({
      ctx: finalizeInboundContext(ctxPayload),
      cfg: config,
      dispatcher,
      replyOptions,
    });
  } finally {
    markRunComplete();
    markDispatchIdle();
    await signalReplyDone();
  }
}
