# Go-live: WhatsApp (Meta Cloud API)

The WhatsApp conversation engine is a module inside the API, not a separate service, so
every flow calls the same application commands as the app (PRD §40, BP-09). Official
WhatsApp Business Platform only.

> Switched on by configuration, not code. Locally a WhatsApp simulator stands in for the
> Meta Cloud API. A real number is enabled by one environment variable plus credentials
> entered in the admin.

Business number at launch: **+234 906 500 9370** (`wa.me/2349065009370`).

## 1. Meta account setup

The API calls the WhatsApp **Cloud API** (`graph.facebook.com/v21.0/{phone-number-id}/messages`).
The WhatsApp Business *phone app* cannot be used.

1. **Meta Business portfolio** at business.facebook.com, owned by the company (not a personal
   account). Complete **business verification** with the company's legal documents; unverified
   portfolios are held to low messaging limits. Verification can take several days.
2. **Meta developer app** at developers.facebook.com, app type **Business**, with the
   **WhatsApp** product added. This creates the WhatsApp Business Account (WABA).
3. **Register the business number** on the WABA. The number must not be active on the WhatsApp
   or WhatsApp Business phone app; delete it from the app first.
4. **System User** (Business Settings → Users → System users) with admin access to the app and
   the WABA. Generate a **permanent** token with `whatsapp_business_messaging` and
   `whatsapp_business_management`. Do not use the 24-hour temporary token from the dashboard.
5. **Payment method** on the WABA for conversation charges.

## 2. Turn the real adapter on (environment)

On the API host:

| Variable | Value |
| --- | --- |
| `WHATSAPP_ADAPTER` | `meta` |

That is the only WhatsApp environment variable. Credentials are **not** read from the environment.

## 3. Enter the credentials (admin)

Sign in to the admin and open **Integrations & keys** (`/admin/ai`). The values are stored in
the database (`setting` key `whatsapp.credentials`) and only ever shown masked.

| Field | Where it comes from |
| --- | --- |
| Phone number ID | Meta app → WhatsApp → API Setup |
| Business account ID | Meta app → WhatsApp → API Setup (WABA ID) |
| Access token | The System User's permanent token (step 1.4) |
| App secret | Meta app → App Settings → Basic. Used to verify webhook signatures |
| Verify token | Any random string you choose. Enter the same value in Meta's webhook config |

## 4. Webhook

In the Meta app → WhatsApp → Configuration:

- **Callback URL:** `{API_BASE_URL}/v1/whatsapp/webhook` (must be public HTTPS)
- **Verify token:** the value entered in the admin
- **Subscribe** to the `messages` field

Meta calls `GET` once for the handshake. The API only echoes the challenge when the verify
token matches, then delivers messages by `POST`, which is checked against `X-Hub-Signature-256`
using the app secret.

## Template submission

Message templates live in `packages/templates` and are submitted to Meta for approval
(started in Phase 0, P0-14). The admin shows each template's Meta status. Templates are
required to message a user outside the 24-hour customer-service window. Arrears notices
stay off WhatsApp until the channel-policy assessment clears them (BP-09, FD-01).

Proactive messages (notifications, the tenant's confirmation request) go out as the template
of the same name when it is marked **Approved** in `/admin/whatsapp`; until then they are sent
as free text, which Meta only delivers within 24 hours of the person's last message. So create
each template in Meta Business Manager with exactly the same name and wording, wait for Meta's
approval, then mark it Approved in `/admin/whatsapp`.

### tenancy_confirm_request (required before tenants can confirm)

Sent to a tenant when a landlord records an existing tenancy. Category **Utility**, language
**English (en)**. Body, exactly:

```
Hello {{1}}, your landlord has recorded your tenancy on Kiataker (rent ₦{{2}} {{3}}). Please check the details and confirm, or tell us what is wrong: {{4}} The link expires in 7 days.
```

`{{1}}` tenant name, `{{2}}` rent (e.g. 1,200,000), `{{3}}` period (e.g. "a year"), `{{4}}`
the secure link. Meta may ask for sample values when you submit it.

### Sign-in codes

One-time codes by email go through Resend (`RESEND_API_KEY`, `EMAIL_FROM`). Codes over
WhatsApp need a Meta **Authentication** template, which is not built yet.
