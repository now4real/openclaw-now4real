# @lightstreamer/openclaw-now4real

MVP OpenClaw channel plugin for **Now4real pagechats**.

This is a pragmatic first-class channel MVP, not a full production adapter yet.

## What this MVP does

- Registers a native OpenClaw **channel plugin** named `now4real`
- Exposes a webhook endpoint for the **Now4real Chatbot API**
- Maps Now4real pagechat messages into OpenClaw inbound context
- Runs the OpenClaw reply pipeline synchronously and returns replies in the same HTTP response
- Keeps page-level or page+user-level session continuity
- Supports reply threading via `replyMessageId`
- Supports optional quick suggestions
- Supports optional moderation hooks in the response object

## Important limitation

Now4real's documented server-side write path is the **chatbot webhook response**, where the bot returns `newMessages` in the HTTP response to an inbound message. It does **not** currently document a general-purpose server-side API for posting arbitrary bot messages at any later time. Because of that, this MVP is:

- **reactive**: it can answer incoming messages cleanly
- **not proactive**: the shared OpenClaw `message` tool cannot reliably send a fresh Now4real message outside an active webhook request

That limitation comes from the current Now4real public API shape, not from OpenClaw. See Now4real Chatbot API docs and OpenClaw channel-plugin docs for the relevant boundaries.

## Supported architecture

```text
Now4real pagechat
  -> POST /now4real/webhook
  -> this plugin builds OpenClaw inbound context
  -> OpenClaw reply pipeline runs
  -> plugin returns { user, newMessages, suggestions }
  -> Now4real publishes bot reply in the pagechat
```

## Suggested OpenClaw config

```json
{
  "channels": {
    "now4real": {
      "enabled": true,
      "agentId": "main",
      "displayName": "OpenClaw",
      "displayIcon": "https://example.com/openclaw.png",
      "activation": "mention-or-reply",
      "sessionMode": "page",
      "siteAllowlist": ["example.com"],
      "allowedQueryTokens": ["replace-with-random-token"],
      "groupRequireMention": true,
      "suggestions": ["Tell me more", "Summarize this page", "What should I do next?"],
      "maxContextMessages": 40,
      "webhookPath": "/now4real/webhook"
    }
  },
  "plugins": {
    "entries": {
      "now4real": {
        "enabled": true
      }
    }
  }
}
```

Then configure the Now4real chatbot URL as something like:

```text
https://your-gateway-host/now4real/webhook?token=replace-with-random-token
```

## Activation modes

- `always`: respond to every inbound message
- `reply-to-bot`: only respond if the user replied to a previous chatbot message
- `mention-or-reply`: only respond if the message looks like it mentions the bot or replies to a bot message

## Session modes

- `page`: one shared OpenClaw session per site+page
- `page-user`: one session per site+page+user

## Files

- `index.ts` and `setup-entry.ts`: OpenClaw plugin entrypoints
- `src/channel.ts`: channel-plugin registration and setup
- `src/route.ts`: webhook handler and synchronous reply bridge
- `src/context.ts`: maps Now4real payloads into OpenClaw inbound context
- `src/runtime.ts`: runtime store
- `src/types.ts`: payload and config types
- `src/channel.test.ts`: lightweight tests for pure logic

## Notes on SDK uncertainty

This scaffold is intentionally close to the current 2026 OpenClaw SDK shape, using the documented channel-plugin entrypoints and the documented reply-pipeline pattern. The exact runtime helper names under `runtime.channel` are the part most likely to need a small final alignment against the installed OpenClaw version. The plugin is therefore best treated as a **high-confidence MVP scaffold** rather than a drop-in production package.

## Sources

- OpenClaw channel plugin guide: `createChatChannelPlugin`, `defineChannelPluginEntry`, `defineSetupPluginEntry`, and plugin-owned inbound webhook routing.
- OpenClaw SDK overview: public subpaths include `channel-reply-pipeline`, `channel-inbound`, `runtime-store`, and `registerHttpRoute`.
- Now4real Chatbot API: request shape, `newMessages`, `suggestions`, moderation, and 10-second response window.
