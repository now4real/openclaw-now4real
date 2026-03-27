import type { CollectedReply, Now4realMessage, Now4realWebhookRequest, ResolvedNow4realAccount } from "./types.js";

export function buildSessionKey(
  payload: Now4realWebhookRequest,
  account: ResolvedNow4realAccount,
): string {
  const base = [
    "agent",
    account.agentId,
    "now4real",
    sanitizeKey(payload.context.site),
    sanitizeKey(payload.context.page || "/"),
  ];

  if (account.sessionMode === "page-user") {
    base.push(sanitizeKey(resolvePrincipal(payload.newMessage.user)));
  }

  return base.join(":");
}

export function shouldRespond(
  payload: Now4realWebhookRequest,
  account: ResolvedNow4realAccount,
): boolean {
  const mode = account.activation;
  const newMessage = payload.newMessage;

  if ((newMessage.user.authProvider || "").toUpperCase() === "CHATBOT") {
    return false;
  }

  if (mode === "always") {
    return true;
  }

  const repliedToBot = isReplyToBot(payload);
  if (mode === "reply-to-bot") {
    return repliedToBot;
  }

  return repliedToBot || looksMentioned(newMessage.content, account.displayName);
}

export function trimVisibleHistory(
  payload: Now4realWebhookRequest,
  maxMessages: number,
): Now4realMessage[] {
  return payload.chat.messages.slice(-Math.max(0, maxMessages));
}

export function buildConversationLabel(payload: Now4realWebhookRequest): string {
  return `${payload.context.site}${payload.context.page}`;
}

export function buildNow4realResponse(params: {
  account: ResolvedNow4realAccount;
  replies: CollectedReply[];
  moderation?: { publish: boolean };
}): Record<string, unknown> {
  const { account, replies, moderation } = params;
  const response: Record<string, unknown> = {};

  if (moderation) {
    response.moderation = moderation;
  }

  if (replies.length > 0) {
    response.user = {
      displayName: account.displayName,
      ...(account.displayIcon ? { displayIcon: account.displayIcon } : {}),
    };
    response.newMessages = replies.slice(0, 10).map((reply) => ({
      content: reply.text.slice(0, 1000),
      ...(reply.replyToId ? { replyMessageId: reply.replyToId } : {}),
    }));
  }

  if (account.suggestions.length > 0) {
    response.suggestions = account.suggestions.slice(0, 3);
  }

  return response;
}

function sanitizeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9/_-]+/g, "_");
}

function resolvePrincipal(user: Now4realMessage["user"]): string {
  return user.jwtSub || user.id || user.displayName || "anonymous";
}

function isReplyToBot(payload: Now4realWebhookRequest): boolean {
  const replyId = payload.newMessage.replyMessageId;
  if (!replyId) {
    return false;
  }

  const replied = payload.chat.messages.find((message) => message.id === replyId);
  return (replied?.user.authProvider || "").toUpperCase() === "CHATBOT";
}

function looksMentioned(text: string, displayName: string): boolean {
  const escaped = escapeRegExp(displayName.trim());
  if (!escaped) {
    return false;
  }
  const mentionRegex = new RegExp(`(^|\\s)@?${escaped}(\\b|\\s|[,:.!?])`, "i");
  return mentionRegex.test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
