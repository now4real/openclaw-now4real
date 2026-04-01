/**
 * Now4real Channel Plugin Entry Point
 */
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { now4realPlugin } from "./src/channel.js";
import {
  parseWebhookPayload,
  handleNow4realInbound,
  type Now4realWebhookEvent,
} from "./src/inbound.js";
import type { ResolvedAccount } from "./src/channel.js";
import { timingSafeStringEqual } from "./src/utils.js";
import { now4realApi } from "./src/client.js";

async function processInboundAsyncReply(
  api: any,
  event: Now4realWebhookEvent,
  account: ResolvedAccount,
): Promise<void> {
  try {
    const pageId = String(event.context.page ?? "").trim();
    if (!pageId) {
      console.error("Now4real outbound skipped: missing page id in webhook context");
      return;
    }

    const finalReply = await handleNow4realInbound(api, event, account, {
      onAgentReplyStart: async () => {
        try {
          await now4realApi.setTyping(pageId, true);
        } catch (error) {
          console.error("Now4real typing on failed:", error);
        }
      },
      onAgentReplyDone: async () => {
        try {
          await now4realApi.setTyping(pageId, false);
        } catch (error) {
          console.error("Now4real typing off failed:", error);
        }
      },
    });

    const reply = finalReply as
      | {
          user?: { displayName?: string; displayIcon?: string };
          newMessages?: Array<{ content?: string; replyMessageId?: string }>;
        }
      | null;
    const firstContent = String(reply?.newMessages?.[0]?.content ?? "").trim();
    if (!firstContent) return;

    await now4realApi.sendMessage({
      user: {
        displayName: String(reply?.user?.displayName ?? account.openClawDisplayName ?? "Chat Bot"),
        ...(reply?.user?.displayIcon ? { displayIcon: reply.user.displayIcon } : {}),
      },
      newMessages: (reply?.newMessages ?? [])
        .map((message) => ({
          content: String(message?.content ?? "").trim(),
          ...(message?.replyMessageId ? { replyMessageId: message.replyMessageId } : {}),
        }))
        .filter((message) => message.content.length > 0),
    });
  } catch (error) {
    console.error("Error handling async Now4real inbound:", error);
  }
}

export default defineChannelPluginEntry({
  id: "now4real",
  name: "Now4real",
  description: "Connect OpenClaw to Now4real pagechat",
  plugin: now4realPlugin,

  registerCliMetadata(api) {
    api.registerCli(
      ({ program }) => {
        program
          .command("now4real")
          .description("Now4real channel management");
      },
      {
        descriptors: [
          {
            name: "now4real",
            description: "Now4real channel management",
            hasSubcommands: false,
          },
        ],
      },
    );
  },

  registerFull(api) {
    // Register webhook endpoint
    api.registerHttpRoute({
      path: "/now4real/webhook",
      auth: "plugin", // We verify signatures ourselves
      handler: async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks).toString("utf-8");

        // Get account config
        const account = now4realPlugin.setup!.resolveAccount(
          api.config,
          undefined,
        );

        // Verify webhook authorization
        const authorization = req.headers["authorization"] as string ?? "";
        if (!timingSafeStringEqual(authorization, account.webhookAuthorization)) {
          res.statusCode = 401;
          res.end("Invalid signature");
          return true;
        }

        try {
          const event = parseWebhookPayload(body);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({}));
          void processInboundAsyncReply(api, event, account);
        } catch (error) {
          console.error("Error handling Now4real webhook:", error);
          res.statusCode = 500;
          res.end("Error processing webhook");
        }

        return true;
      },
    });
  },
});
