/**
 * Inbound webhook handler for Now4real
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { ResolvedAccount } from "./channel.js";
import { finalizeInboundContext } from "openclaw/plugin-sdk/reply-runtime";

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
): Promise<void> {
  // Construct context payload for OpenClaw
  const ctxPayload = {
    Body: event.newMessage.content,
    From: event.newMessage.user.id,
    To: event.context.site+event.context.page,
    SenderName: event.newMessage.user.displayName,
    SenderId: event.newMessage.user.id,
    SessionKey: `${event.context.site+event.context.page}:${event.newMessage.user.id}`,
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
  await api.dispatchInboundMessage({
    ctx: finalizeInboundContext(ctxPayload),
  });
}
