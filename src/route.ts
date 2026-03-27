import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import { createChannelReplyPipeline } from "openclaw/plugin-sdk/channel-reply-pipeline";

import { resolveNow4realAccount } from "./config.js";
import {
  buildConversationLabel,
  buildNow4realResponse,
  buildSessionKey,
  shouldRespond,
  trimVisibleHistory,
} from "./context.js";
import { getNow4realRuntime } from "./runtime.js";
import type {
  CollectedReply,
  Now4realWebhookRequest,
  ResolvedNow4realAccount,
} from "./types.js";

export async function handleNow4realWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  logger?: {
    debug?: (message: string) => void;
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  },
): Promise<boolean> {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    return false;
  }

  const runtime = getNow4realRuntime() as any;
  const cfg = await runtime.config.loadConfig();
  const account = resolveNow4realAccount(cfg);

  if (!account.enabled) {
    respondJson(res, {});
    return true;
  }

  const url = new URL(req.url || account.webhookPath, "http://localhost");
  if (!isTokenAllowed(url, account)) {
    respondJson(res, {});
    return true;
  }

  const payload = (await readJsonBody(req)) as Now4realWebhookRequest;

  if (!isSiteAllowed(payload.context.site, account)) {
    logger?.warn?.(`[now4real] ignoring site ${payload.context.site}`);
    respondJson(res, {});
    return true;
  }

  if (!shouldRespond(payload, account)) {
    respondJson(res, {});
    return true;
  }

  try {
    const replies = await runReplyPipeline({
      runtime,
      cfg,
      account,
      payload,
      logger,
    });

    respondJson(
      res,
      buildNow4realResponse({
        account,
        replies,
      }),
    );
  } catch (error) {
    logger?.error?.(`[now4real] webhook failed: ${String(error)}`);
    respondJson(res, {});
  }

  return true;
}

async function runReplyPipeline(params: {
  runtime: any;
  cfg: any;
  account: ResolvedNow4realAccount;
  payload: Now4realWebhookRequest;
  logger?: {
    debug?: (message: string) => void;
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
}): Promise<CollectedReply[]> {
  const { runtime, cfg, account, payload, logger } = params;

  const replies: CollectedReply[] = [];
  const sessionKey = buildSessionKey(payload, account);
  const visibleHistory = trimVisibleHistory(payload, account.maxContextMessages);

  const historyText = visibleHistory
    .map((message) => `${message.user.displayName}: ${message.content}`)
    .join("\n");

  const rawBody = payload.newMessage.content;
  const ctxBase = {
    Body: rawBody,
    BodyForAgent: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `now4real:${payload.newMessage.user.id}`,
    To: `now4real:${payload.context.site}${payload.context.page}`,
    SessionKey: sessionKey,
    AccountId: account.accountId ?? undefined,
    ChatType: "channel",
    ConversationLabel: buildConversationLabel(payload),
    SenderName: payload.newMessage.user.displayName,
    SenderId: payload.newMessage.user.id,
    SenderUsername: payload.newMessage.user.jwtSub,
    Provider: "now4real",
    Surface: "now4real",
    MessageSid: payload.newMessage.id,
    MessageSidFull: payload.newMessage.id,
    ReplyToId: payload.newMessage.replyMessageId,
    ReplyToIdFull: payload.newMessage.replyMessageId,
    OriginatingChannel: "now4real",
    OriginatingTo: `now4real:${payload.context.site}${payload.context.page}`,
    GroupSpace: `${payload.context.site}${payload.context.page}`,
    GroupSystemPrompt: historyText ? `Visible pagechat history:\n${historyText}` : undefined,
  };

  const ctx = runtime.channel?.reply?.finalizeInboundContext
    ? runtime.channel.reply.finalizeInboundContext(ctxBase)
    : ctxBase;

  const { onModelSelected, ...replyPipeline } = createChannelReplyPipeline({
    cfg,
    agentId: account.agentId,
    channel: "now4real",
    accountId: account.accountId ?? undefined,
  }) as any;

  await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx,
    cfg,
    dispatcherOptions: {
      ...replyPipeline,
      deliver: async (payloadPart: {
        text?: string;
        mediaUrl?: string;
        mediaUrls?: string[];
        replyToId?: string;
      }) => {
        const text = normalizeText(payloadPart);
        if (!text) {
          return;
        }

        replies.push({
          text,
          replyToId: payload.newMessage.id,
        });
      },
      onError: (error: unknown, info: { kind?: string }) => {
        logger?.error?.(
          `[now4real] ${info?.kind || "reply"} delivery failed: ${String(error)}`,
        );
      },
    },
    replyOptions: {
      onModelSelected,
    },
  });

  return replies;
}

function normalizeText(payloadPart: {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
}): string {
  const text = (payloadPart.text || "").trim();
  if (text) {
    return text;
  }

  const mediaCount = Number(Boolean(payloadPart.mediaUrl)) + (payloadPart.mediaUrls?.length || 0);
  if (mediaCount > 0) {
    return "I produced media, but this Now4real MVP currently returns text replies only.";
  }

  return "";
}

function isTokenAllowed(url: URL, account: ResolvedNow4realAccount): boolean {
  if (account.allowedQueryTokens.length === 0) {
    return true;
  }

  const token = url.searchParams.get("token") || "";
  return account.allowedQueryTokens.includes(token);
}

function isSiteAllowed(site: string, account: ResolvedNow4realAccount): boolean {
  if (account.siteAllowlist.length === 0) {
    return true;
  }
  return account.siteAllowlist.includes(site);
}

function respondJson(res: ServerResponse, body: unknown): void {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}
