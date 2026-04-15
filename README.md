# OpenClaw Now4real Channel

Open-source Now4real channel plugin for OpenClaw. It connects Now4real pagechats to OpenClaw through inbound webhooks and outbound chatbot APIs, with mention-aware replies and markdown-safe message chunking.

## Install

From ClawHub:

```bash
clawhub install openclaw-now4real
```

Or from GitHub:

```bash
npm install -g git+https://github.com/now4real/openclaw-now4real.git
openclaw plugins install openclaw-now4real
```

## Configure

Add this to your OpenClaw config:

```jsonc
{
  "channels": {
    "now4real": {
      "enabled": true,
      "webhookAuthorization": "your-webhook-secret",
      "openClawDisplayName": "OpenClaw",
      "openClawDisplayIcon": "https://raw.githubusercontent.com/openclaw/openclaw/refs/heads/main/assets/chrome-extension/icons/icon48.png",
      "requireMention": false
    }
  }
}
```

Required fields:
- `enabled`
- `webhookAuthorization`

Optional fields:
- `openClawDisplayName` (default: OpenClaw)
- `openClawDisplayIcon` (default: not set)
- `requireMention` (default: false)

`openClawDisplayIcon` is the HTTPS URL for chat. If `openClawDisplayIcon` is not provided, Now4real chat shows the bot initials based on openClawDisplayName.

When `requireMention` is true, the plugin replies only if:
- the incoming message contains a mention of the bot display name (for example: Hello @OpenClaw), or
- the incoming message is a reply to a previous chatbot message.

When an outbound reply is longer than 1000 characters, the plugin automatically splits it into multiple messages using OpenClaw native markdown-aware chunking.

## Now4real Dashboard Setup

Configure the chatbot for your site in the Now4real Dashboard: https://dashboard.now4real.com

1. Log in to your Now4real Dashboard.
2. If your site is not already added/configured in Now4real, add it.
3. Open Site Settings -> Chatbots.
4. Enable the chatbot activation toggle.
5. Set Webhook endpoint to:
  `https://your-openclaw-server.com/now4real/webhook`
6. Enter the same webhook authorization secret configured in OpenClaw (channels.now4real.webhookAuthorization).
7. Click Test to verify that Now4real can reach your webhook.
8. If the test succeeds, click Publish.

After publishing, your chatbot is live and incoming messages are forwarded to the OpenClaw webhook.

## Features

- Webhook-based inbound delivery to /now4real/webhook
- Outbound replies through Now4real chatbot message API
- Typing indicator lifecycle management during agent response generation
- Context and user included in both message and typing API payloads
- Mention-gated replies with requireMention
- Reply-to-chatbot exception to avoid blocking threaded follow-ups
- Markdown-aware chunking for long outbound replies (1000 chars max per chunk)

## Runtime Flow

1. A visitor sends a message in Now4real pagechat.
2. Now4real sends webhook event data to /now4real/webhook.
3. The plugin validates the Authorization header against webhookAuthorization.
4. The event is dispatched to OpenClaw.
5. On reply start, the plugin calls typing API with context and bot user.
6. On reply completion, the plugin turns typing off.
7. The final agent response is sent through Now4real message API with context, user, and newMessages.

## Requirements

- OpenClaw 2026.4.11+
- OpenClaw must expose a public HTTPS URL and respond on /now4real/webhook
- A configured Now4real site with chatbot/webhook access
