# OpenClaw Now4real Channel

Channel plugin per collegare OpenClaw a Now4real pagechat.

## Struttura

```
├── package.json              # openclaw.channel metadata
├── openclaw.plugin.json      # Manifest con config schema
├── index.ts                  # Entry point principale
├── setup-entry.ts            # Entry per onboarding
├── tsconfig.json
└── src/
    ├── channel.ts            # Plugin via createChatChannelPlugin
    ├── channel.test.ts       # Test
    ├── client.ts             # Now4real API client
    └── inbound.ts            # Webhook handler
```

## Configurazione

Aggiungi al tuo `openclaw.yaml`:

```yaml
channels:
  now4real:
    apiKey: "your-now4real-api-key"
    siteKey: "your-site-key"
    webhookSecret: "optional-webhook-secret"
    dmSecurity: "allowlist"
    allowFrom:
      - "user-id-1"
      - "user-id-2"
```

## Setup Now4real

1. Vai su Now4real Dashboard → Webhooks
2. Aggiungi webhook URL: `https://your-openclaw-server.com/now4real/webhook`
3. Copia il webhook secret nella configurazione

## Flusso

1. Utente invia messaggio nella pagechat Now4real
2. Now4real invia webhook POST a `/now4real/webhook`
3. Il plugin verifica la firma e inoltra a OpenClaw
4. OpenClaw elabora e risponde via `outbound.sendText`
5. La risposta appare nella pagechat

## Test

```bash
pnpm test
```
