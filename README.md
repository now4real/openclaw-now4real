# OpenClaw Now4real Channel

Channel plugin to connect OpenClaw to Now4real pagechat.

## Structure

```
├── package.json              # openclaw.channel metadata
├── openclaw.plugin.json      # Manifest with config schema
├── index.ts                  # Main entry point
├── setup-entry.ts            # Onboarding entry
├── tsconfig.json
└── src/
    ├── channel.ts            # Plugin via createChatChannelPlugin
    ├── channel.test.ts       # Tests
    ├── client.ts             # Now4real API client
    └── inbound.ts            # Webhook handler
```

## Configuration

Add to your `openclaw.json`:

```json
{
  "channels": {
    "now4real": {
      "webhookAuthorization": "your-webhook-authorization-secret"
    }
  }
}
```

## Now4real Setup

1. Go to Now4real Dashboard → Webhooks
2. Add webhook URL: `https://your-openclaw-server.com/now4real/webhook`
3. Set the webhook authorization secret in your configuration

## Flow

1. User sends a message in the Now4real pagechat
2. Now4real sends a webhook POST to `/now4real/webhook`
3. The plugin verifies the authorization header and forwards the event to OpenClaw
4. OpenClaw processes and replies via `outbound.sendText`
5. The reply appears in the pagechat

## Test

```bash
pnpm test
```
