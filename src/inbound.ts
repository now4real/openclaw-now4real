/**
 * Inbound webhook handler for Now4real
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { ResolvedAccount } from "./channel.js";
import { finalizeInboundContext } from "openclaw/plugin-sdk/reply-runtime";

export interface Now4realWebhookEvent {
  event: string;
  page_id: string;
  user_id: string;
  user_name: string;
  message: string;
  timestamp?: number;
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
  // Only handle message events
  if (event.event !== "message") {
    return;
  }

  // Construct context payload for OpenClaw
  const ctxPayload = {
    Body: event.message,
    From: event.user_id,
    To: event.page_id,
    SenderName: event.user_name,
    SenderId: event.user_id,
    SessionKey: `${event.page_id}:${event.user_id}`,
    AccountId: account.accountId ?? undefined,
    Timestamp: event.timestamp,
    Provider: "now4real",
  };

  // Dispatch message to OpenClaw
  await api.dispatchInboundMessage({
    ctx: finalizeInboundContext(ctxPayload),
  });
}
