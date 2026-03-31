/**
 * Now4real Channel Plugin Entry Point
 */
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { now4realPlugin } from "./src/channel.js";
import {
  parseWebhookPayload,
  verifyWebhookSignature,
  handleNow4realInbound,
} from "./src/inbound.js";

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

        // Verify webhook signature
        const signature = req.headers["x-now4real-signature"] as string ?? "";
        if (
          account.webhookSecret &&
          !verifyWebhookSignature(body, signature, account.webhookSecret)
        ) {
          res.statusCode = 401;
          res.end("Invalid signature");
          return true;
        }

        try {
          const event = parseWebhookPayload(body);
          await handleNow4realInbound(api, event, account);

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({}));
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
