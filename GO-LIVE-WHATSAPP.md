# Go-live: WhatsApp (Meta Cloud API)

The WhatsApp conversation engine is a module inside the API, not a separate service, so
every flow calls the same application commands as the app (PRD §40, BP-09). Official
WhatsApp Business Platform only.

> Switched on by configuration, not code. Locally a WhatsApp simulator stands in for the
> Meta Cloud API; a real number is enabled by environment variables only.

## Values to set (production)

| Variable | Where it comes from |
| --- | --- |
| `WHATSAPP_ADAPTER` | set to `meta` to use the real Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Business account |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta WhatsApp Business account |
| `WHATSAPP_ACCESS_TOKEN` | Meta system user token (long-lived) |
| `WHATSAPP_VERIFY_TOKEN` | chosen value, used for the webhook handshake |
| `WHATSAPP_APP_SECRET` | Meta app, used to verify webhook signatures |

Business number at launch: **+234 906 500 9370** (`wa.me/2349065009370`).

## Template submission

Message templates live in `packages/templates` and are submitted to Meta for approval
(started in Phase 0, P0-14). The admin shows each template's Meta status. Arrears notices
stay off WhatsApp until the channel-policy assessment clears them (BP-09, FD-01).

Full template list and cut-over steps land with Phase 2 and Phase 5.
