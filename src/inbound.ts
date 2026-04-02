/**
 * Inbound webhook handler for Now4real
 */
import type { ResolvedAccount } from "./channel.js";
import {
  createReplyDispatcherWithTyping,
  dispatchInboundMessage,
  finalizeInboundContext,
} from "openclaw/plugin-sdk/reply-runtime";

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

export function parseWebhookPayload(body: string): Now4realWebhookEvent {
  return JSON.parse(body) as Now4realWebhookEvent;
}

export async function handleNow4realInbound(
  config: any,
  event: Now4realWebhookEvent,
  account: ResolvedAccount,
  hooks?: InboundReplyLifecycleHooks,
): Promise<unknown> {
  const site = String(event.context.site ?? "").trim();
  const page = String(event.context.page ?? "").trim();
  const channelContextId = `${site}${page}`;
  const sessionKey = `agent:main:now4real:channel:${channelContextId}`;

  // Construct context payload for OpenClaw
  const ctxPayload = {
    Body: event.newMessage.content,
    From: event.newMessage.user.id,
    To: channelContextId,
    SenderName: event.newMessage.user.displayName,
    SenderId: event.newMessage.user.id,
    SessionKey: sessionKey,
    AccountId: account.accountId ?? undefined,
    Timestamp: new Date(event.newMessage.time).getTime(),
    Provider: "now4real",
    InboundHistory: event.chat.messages.map((m) => ({
      sender: m.user.displayName,
      body: m.content,
      timestamp: new Date(m.time).getTime(),
    })),
  };

  // Dispatch message to OpenClaw
  let finalReplyPayload: unknown;
  let didSignalReplyDone = false;

  const signalReplyDone = async () => {
    if (didSignalReplyDone) return;
    didSignalReplyDone = true;
    await hooks?.onAgentReplyDone?.();
  };

  const { dispatcher, replyOptions, markDispatchIdle, markRunComplete } = createReplyDispatcherWithTyping({
    onReplyStart: () => hooks?.onAgentReplyStart?.(),
    onIdle: () => {
      void signalReplyDone();
    },
    deliver: async (payload: unknown, info: { kind: "tool" | "block" | "final" }) => {
      if (info.kind === "final") {
        finalReplyPayload = payload;
      }
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

  if (!finalReplyPayload) return null;

  const p = finalReplyPayload as any;
  const content: string = p.text ?? p.content ?? p.body ?? "";
  const displayIcon = account.openClawDisplayIcon?.trim();

  return {
    user: {
      displayName: account.openClawDisplayName ?? "ChatBot",
      ...(displayIcon ? { displayIcon } : {}),
    },
    newMessages: [
      {
        content,
        replyMessageId: event.newMessage.id,
      },
    ],
  };
}
