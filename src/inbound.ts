/**
 * Inbound webhook handler for Now4real
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { ResolvedAccount } from "./channel.js";

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

  // Dispatch message to OpenClaw
  await api.dispatchInboundMessage({
    channelId: "now4real",
    conversationId: `now4real_${event.page_id}_${event.user_id}`,
    senderId: event.user_id,
    senderName: event.user_name,
    text: event.message,
    timestamp: event.timestamp ?? Date.now(),
    metadata: {
      pageId: event.page_id,
    },
  });
}
