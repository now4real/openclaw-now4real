import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";

import { now4realPlugin } from "./src/channel.js";
import { handleNow4realWebhook } from "./src/route.js";
import { setNow4realRuntime } from "./src/runtime.js";

export default defineChannelPluginEntry({
  id: "now4real",
  name: "Now4real",
  description: "Now4real pagechat channel plugin",
  plugin: now4realPlugin,
  setRuntime: setNow4realRuntime,
  registerFull(api) {
    api.registerHttpRoute({
      path: "/now4real/webhook",
      auth: "plugin",
      handler: async (req, res) => {
        const handled = await handleNow4realWebhook(req, res, api.logger);
        if (!handled && !res.headersSent) {
          res.statusCode = 404;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("Not Found");
        }
        return true;
      },
    });

    api.registerCli(
      ({ program }) => {
        program
          .command("now4real")
          .description("Now4real channel management commands");
      },
      { commands: ["now4real"] },
    );
  },
});
