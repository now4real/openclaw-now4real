import { describe, expect, it } from "vitest";

import {
  buildNow4realResponse,
  buildSessionKey,
  shouldRespond,
  trimVisibleHistory,
} from "./context.js";
import type { Now4realWebhookRequest, ResolvedNow4realAccount } from "./types.js";

const account: ResolvedNow4realAccount = {
  accountId: null,
  enabled: true,
  agentId: "main",
  displayName: "OpenClaw",
  activation: "mention-or-reply",
  sessionMode: "page",
  groupRequireMention: true,
  siteAllowlist: [],
  allowedQueryTokens: [],
  suggestions: ["One", "Two", "Three", "Four"],
  maxContextMessages: 2,
  webhookPath: "/now4real/webhook",
};

const payload: Now4realWebhookRequest = {
  context: {
    site: "example.com",
    page: "/post/123",
  },
  chat: {
    messages: [
      {
        id: "m1",
        time: "2026-03-26T12:00:00Z",
        user: {
          id: "u1",
          displayName: "Alice",
          jwtSub: "alice",
          authProvider: "JWT",
        },
        content: "hello",
      },
      {
        id: "m2",
        time: "2026-03-26T12:01:00Z",
        user: {
          id: "bot1",
          displayName: "OpenClaw",
          authProvider: "CHATBOT",
        },
        content: "hi",
      },
    ],
  },
  newMessage: {
    id: "m3",
    time: "2026-03-26T12:02:00Z",
    user: {
      id: "u1",
      displayName: "Alice",
      jwtSub: "alice",
      authProvider: "JWT",
    },
    replyMessageId: "m2",
    content: "@OpenClaw summarize this",
  },
};

describe("now4real context helpers", () => {
  it("builds a page session key", () => {
    expect(buildSessionKey(payload, account)).toBe(
      "agent:main:now4real:example_com:/post/123",
    );
  });

  it("keeps only the tail of visible history", () => {
    const trimmed = trimVisibleHistory(payload, 1);
    expect(trimmed).toHaveLength(1);
    expect(trimmed[0]?.id).toBe("m2");
  });

  it("responds when user replied to the chatbot", () => {
    expect(shouldRespond(payload, account)).toBe(true);
  });

  it("builds a valid now4real response", () => {
    const response = buildNow4realResponse({
      account,
      replies: [{ text: "Hello back", replyToId: "m3" }],
    }) as {
      suggestions?: string[];
      newMessages?: Array<{ content: string; replyMessageId?: string }>;
    };

    expect(response.suggestions).toEqual(["One", "Two", "Three"]);
    expect(response.newMessages?.[0]).toEqual({
      content: "Hello back",
      replyMessageId: "m3",
    });
  });
});
