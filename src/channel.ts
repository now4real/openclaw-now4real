import {
  createChatChannelPlugin,
  createChannelPluginBase,
} from "openclaw/plugin-sdk/core";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

import {
  inspectNow4realAccount,
  resolveNow4realAccount,
} from "./config.js";
import type { ResolvedNow4realAccount } from "./types.js";

function resolveAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedNow4realAccount {
  return resolveNow4realAccount(cfg, accountId);
}

export const now4realPlugin = createChatChannelPlugin<ResolvedNow4realAccount>({
  base: createChannelPluginBase({
    id: "now4real",
    setup: {
      resolveAccount,
      inspectAccount(cfg) {
        return inspectNow4realAccount(cfg);
      },
    },
  }),

  capabilities: {
    chatTypes: ["group", "thread"],
    reactions: false,
    threads: true,
    media: false,
    nativeCommands: false,
    blockStreaming: true,
  },

  streaming: {
    blockStreamingCoalesceDefaults: {
      minChars: 900,
      idleMs: 600,
    },
  },

  groups: {
    resolveRequireMention: (account) => account.groupRequireMention,
  },

  threading: {
    topLevelReplyToMode: "reply",
  },

  outbound: {
    attachedResults: {
      sendText: async () => {
        throw new Error(
          "Now4real MVP only supports replies generated inside an active webhook request.",
        );
      },
    },
  },
});
