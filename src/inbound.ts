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
import { containsBotMention } from "./utils.js";

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

function isReplyToChatbotMessage(event: Now4realWebhookEvent): boolean {
  const replyToMessageId = String(event.newMessage.replyMessageId ?? "").trim();
  if (!replyToMessageId) {
    return false;
  }

  const repliedMessage = event.chat.messages.find(
    (message) => String(message.id ?? "").trim() === replyToMessageId,
  );
  const authProvider = String(repliedMessage?.user?.authProvider ?? "").trim();

  return authProvider === "CHATBOT";
}

export async function handleNow4realInbound(
  config: any,
  event: Now4realWebhookEvent,
  account: ResolvedAccount,
  hooks?: InboundReplyLifecycleHooks,
): Promise<void> {
  //console.log("Now4real inbound event received:", { event });

  const inboundText = String(event.newMessage.content ?? "");
  const configuredBotName = String(account.openClawDisplayName ?? "").trim();
  const botName = configuredBotName || DEFAULT_BOT_DISPLAY_NAME;
  const hasMention = containsBotMention(inboundText, botName);
  const replyingToChatbot = isReplyToChatbotMessage(event);
  
  if (account.requireMention) {
    if (!hasMention && !replyingToChatbot) {
      /* console.log("Now4real inbound ignored: mention required", {
        botName,
        messageId: String(event.newMessage.id ?? "").trim(),
      }); */
      return;
    }
  }

  const isReply = String(event.newMessage.replyMessageId ?? "").trim().length > 0;
  if (!account.requireMention && isReply && !replyingToChatbot && !hasMention) {
    /* console.log("Now4real inbound ignored: user reply without mention", {
      botName,
      messageId: String(event.newMessage.id ?? "").trim(),
      replyMessageId: String(event.newMessage.replyMessageId ?? "").trim(),
    }); */
    return;
  }

  const site = String(event.context.site ?? "").trim();
  const page = String(event.context.page ?? "").trim();
  const channelContextId = `${site}${page}`;
  const sessionKey = `agent:main:now4real:channel:${channelContextId}`;
  const currentMessageId = String(event.newMessage.id ?? "").trim();
  const replyToMessageId = String(event.newMessage.replyMessageId ?? "").trim();
  const repliedMessage = replyToMessageId
    ? event.chat.messages.find((m) => String(m.id ?? "").trim() === replyToMessageId)
    : undefined;
  const allMessageIds = event.chat.messages
    .map((m) => String(m.id ?? "").trim())
    .filter((id) => id.length > 0);

  // Construct context payload for OpenClaw
  const ctxPayload = {
    Body: inboundText,
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
    ...(repliedMessage
      ? {
        ReplyToBody: String(repliedMessage.content ?? ""),
        ReplyToSender: String(repliedMessage.user?.displayName ?? "").trim() || undefined,
      }
      : {}),
    ...(allMessageIds.length > 1
      ? {
        MessageSids: allMessageIds,
        MessageSidFirst: allMessageIds[0],
        MessageSidLast: allMessageIds[allMessageIds.length - 1],
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
