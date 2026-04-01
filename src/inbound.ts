/**
 * Inbound webhook handler for Now4real
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { ResolvedAccount } from "./channel.js";
import { finalizeInboundContext, dispatchInboundMessage } from "openclaw/plugin-sdk/reply-runtime";

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

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret) return true; // Skip if not configured

  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

export function parseWebhookPayload(body: string): Now4realWebhookEvent {
  return JSON.parse(body) as Now4realWebhookEvent;
}

export async function handleNow4realInbound(
  api: any,
  event: Now4realWebhookEvent,
  account: ResolvedAccount,
  hooks?: InboundReplyLifecycleHooks,
): Promise<unknown> {
  const site = String(event.context.site ?? "").trim();
  const page = String(event.context.page ?? "").trim();
  const channelContextId = `${site}::${page}`;
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
  let didSignalReplyStart = false;

  const signalReplyStart = async () => {
    if (didSignalReplyStart) return;
    didSignalReplyStart = true;
    await hooks?.onAgentReplyStart?.();
  };

  await dispatchInboundMessage({
    ctx: finalizeInboundContext(ctxPayload),
    cfg: api,
    dispatcher: {
      sendToolResult: (_payload) => {
        void signalReplyStart();
        console.log('sendToolResult');
        return true;
      },
      sendBlockReply: (_payload) => {
        void signalReplyStart();
        console.log('sendBlockReply');
        return true;
      },
      sendFinalReply: (payload) => {
        void signalReplyStart();
        finalReplyPayload = payload;
        return true;
      },
      waitForIdle: () => Promise.resolve(),
      getQueuedCounts: () => ({ tool: 0, block: 0, final: 0 }),
      getFailedCounts: () => ({ tool: 0, block: 0, final: 0 }),
      markComplete: () => console.log('markComplete'),
    },
  });

  await hooks?.onAgentReplyDone?.();

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
