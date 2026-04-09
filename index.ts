/**
 * Now4real Channel Plugin Entry Point
 */
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { now4realPlugin } from "./src/channel.js";
import {
  handleNow4realInbound,
  type Now4realWebhookEvent,
} from "./src/inbound.js";
import type { ResolvedAccount } from "./src/channel.js";
import { DEFAULT_BOT_DISPLAY_NAME } from "./src/constants.js";
import { parseWebhookPayload, timingSafeStringEqual } from "./src/utils.js";
import { now4realApi } from "./src/client.js";

async function processInboundAsyncReply(
  config: any,
  event: Now4realWebhookEvent,
  account: ResolvedAccount,
): Promise<void> {
  try {
    const context = {
      site: String(event.context.site ?? "").trim(),
      page: String(event.context.page ?? "").trim(),
    };
    if (!context.site || !context.page) {
      console.error("Now4real outbound skipped: missing site/page in webhook context");
      return;
    }

    const typingUser = {
      displayName: String(account.openClawDisplayName ?? DEFAULT_BOT_DISPLAY_NAME),
      ...(account.openClawDisplayIcon ? { displayIcon: account.openClawDisplayIcon } : {}),
    };

    await handleNow4realInbound(config, event, account, {
      onAgentReplyStart: async () => {
        try {
          await now4realApi.setTyping({
            context,
            user: typingUser,
            typing: true,
            //timeout: 2
          });
        } catch (error) {
          console.error("Now4real typing on failed:", error);
        }
      },
      onAgentReplyDone: async () => {
        try {
          await now4realApi.setTyping({
            context,
            user: typingUser,
            typing: false,
          });
        } catch (error) {
          console.error("Now4real typing off failed:", error);
        }
      },
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
        const account = now4realPlugin.config.resolveAccount(
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
          const event = parseWebhookPayload<Now4realWebhookEvent>(body);

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({}));
          void processInboundAsyncReply(api.config, event, account);
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
