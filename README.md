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
      "now4realApiKey": "Bearer your-now4real-api-key",
      "openClawDisplayName": "Support Bot",
      "openClawDisplayIcon": "https://example.com/bot-icon.png"
    }
  }
}
```

Required fields:
- webhookAuthorization
- now4realApiKey

Optional fields:
- enabled
- openClawDisplayName
- openClawDisplayIcon

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
