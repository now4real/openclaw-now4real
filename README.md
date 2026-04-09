# OpenClaw Now4real Channel

Channel plugin to connect OpenClaw to Now4real pagechat via webhook + outbound API.

## Structure

```
├── package.json              # plugin metadata
├── openclaw.plugin.json      # plugin manifest and config schema
├── index.ts                  # plugin entry point and webhook route
├── setup-entry.ts            # onboarding entry
├── tsconfig.json
└── src/
    ├── channel.ts            # createChatChannelPlugin and outbound handlers
    ├── client.ts             # Now4real REST client
    ├── inbound.ts            # webhook payload parsing and inbound dispatch
    └── utils.ts              # timing-safe string compare helper
```

## Configuration

Add this to your OpenClaw config.

```json
{
  "channels": {
    "now4real": {
      "enabled": true,
      "webhookAuthorization": "Bearer your-webhook-secret",
      "openClawDisplayName": "Support Bot",
      "openClawDisplayIcon": "https://example.com/bot-icon.png",
      "requireMention": false,
      "klipyApiAuthorization": "your-klipy-app-key"
    }
  }
}
```

Required fields:
- webhookAuthorization

Optional fields:
- enabled
- openClawDisplayName
- openClawDisplayIcon
- requireMention (default: false)
- klipyApiAuthorization (Klipy app key, optional)

GIF metadata resolution is enabled only when `klipyApiAuthorization` is configured.
If `klipyApiAuthorization` is empty or missing, Klipy GIF URLs are forwarded as-is and no metadata API call is performed.

When an inbound message is a Klipy GIF URL in format `https://klipy.com/gifs/{id}#...`, the plugin extracts the GIF ID, calls `https://api.klipy.com/v2/posts?key={app_key}&id={id}`, reads `results[0].content_description`, and appends a structured GIF context to the message body forwarded to OpenClaw:

```text
[KLIPY_GIF_CONTEXT]
gif_id=2525964843568523
gif_description=...
```

If metadata cannot be fetched, `gif_description=description_not_available` is sent so the agent still knows it is a specific GIF.

When `requireMention` is `true`, the plugin replies only if the incoming message contains a mention to the configured bot display name, for example `@Support Bot ciao`.

When an outbound reply is longer than 1000 characters, the plugin automatically splits it into multiple `newMessages` entries, using OpenClaw native markdown-aware chunking.

## Webhook Setup

1. Open Now4real dashboard -> Webhooks.
2. Set webhook URL to `https://your-openclaw-server.com/now4real/webhook`.
3. Configure the same authorization value in both Now4real webhook settings and `webhookAuthorization`.

## Outbound API Payloads

The plugin now sends `context` and `user` for both message and typing APIs.

sendMessage payload:

```json
{
  "context": {
    "site": "now4real.test",
    "page": "/chatbot"
  },
  "user": {
    "displayName": "Support Bot",
    "displayIcon": "https://example.com/bot-icon.png"
  },
  "newMessages": [
    {
      "content": "Hello from OpenClaw",
      "replyMessageId": "optional-message-id"
    }
  ]
}
```

setTyping payload:

```json
{
  "context": {
    "site": "now4real.test",
    "page": "/chatbot"
  },
  "user": {
    "displayName": "Support Bot",
    "displayIcon": "https://example.com/bot-icon.png"
  },
  "typing": true,
  "timeout": 2
}
```

`timeout` is optional and used only when `typing` is `true`.

## Runtime Flow

1. A visitor sends a message in Now4real pagechat.
2. Now4real sends webhook event data to `/now4real/webhook`.
3. The plugin validates the `Authorization` header against `webhookAuthorization`.
4. The event is dispatched to OpenClaw.
5. On reply start, plugin calls typing API with `context` + bot `user`.
6. On reply completion, plugin turns typing off.
7. Final agent response is sent via Now4real message API with `context`, `user`, and `newMessages`.
