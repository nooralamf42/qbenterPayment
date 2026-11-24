# Cloudflare Workers Deploy

This project is configured to build and deploy to Cloudflare Workers via `@opennextjs/cloudflare`.

- `wrangler.jsonc`, `open-next.config.ts`, `worker.ts` (repo root) - Worker config and entry.
- `scripts/cf-post-build.mjs` + `cloudflare/_headers.txt` - Static asset caching and security headers.

## Cloudflare Dashboard (Workers & Pages -> Create -> Import Repo)
- **Build command**: `npm run cf:build`
- **Deploy command**: `npx wrangler deploy`
- **Non-production branch command**: `npx wrangler versions upload`
- **Worker name**: Must match `name` in `wrangler.jsonc` — `qbenterpayment`, after the
  GitHub repo, not this folder. A mismatch doesn't fail the build: `wrangler deploy`
  silently creates a second Worker under the other name, with none of this one's routes,
  custom domain or variables.
- **Build variables** (Settings -> Build -> Variables):
  - `NEXT_PUBLIC_BASE_URL`
  - `NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD`
  - `NEXT_PUBLIC_ENCODED_USER_PASSWORD`
  - *(Optional / when active)*: `NEXT_PUBLIC_EPAY_PUBLIC_KEY`, `NEXT_PUBLIC_EPAY_TER_NO`

Only `NEXT_PUBLIC_*` belongs in **Build** variables — those are inlined into the bundle at
build time. Everything the server reads at runtime goes in **Runtime** variables instead
(Settings -> Variables and Secrets), or it will be `undefined` in the Worker.

### Runtime variables — Shopify gateway
Settings -> Variables and Secrets. Use **Secret** for anything that grants access, and
plain **Text** for the rest, so the non-sensitive values stay readable in the dashboard.

| Variable | Type | Notes |
| --- | --- | --- |
| `SHOPIFY_CLIENT_SECRET` | Secret | Dev Dashboard -> app -> Settings -> Credentials |
| `SHOPIFY_ACCESS_TOKEN` | Secret | `shpat_…`, from running `/api/shopify/install` |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Secret | Subscription cart flow only; may be left unset |
| `SHOPIFY_CLIENT_ID` | Secret | |

The non-sensitive rest — `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_API_VERSION`,
`SHOPIFY_ENTERPRISE_VARIANT_ID`, `SHOPIFY_PRESENTMENT_CURRENCY`, `SHOPIFY_BUYER_COUNTRY` —
live in the `vars` block of `wrangler.jsonc`, not the dashboard, so every deploy carries
them. Don't also set those names in the dashboard; two sources for one name is how they
end up disagreeing.

### Runtime variables — email (Resend)
Same place. Resend is the only sending provider wired up; see `app/lib/emailSender.ts`.

| Variable | Type | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | resend.com -> API Keys. Sending access is enough |
| `RESEND_WEBHOOK_SECRET` | Secret | `whsec_…`, from the webhook you create below |
| `PAYMENT_ALERT_EMAIL` | Text | Where the internal "New Successful Payment" alert goes |
| `INVOICE_LINK_SECRET` | Secret | Optional; signs the receipt's "View invoice" link. Falls back to `MONGODB_URI` as the signing key when unset |

Without `RESEND_API_KEY` every send fails with "RESEND_API_KEY is not configured" and the
failure is recorded on the log row — nothing is sent silently.

`PAYMENT_ALERT_EMAIL` has no default on purpose: the sister project hardcodes its own
business inbox, and inheriting that address would send this project's payment details to the
wrong people. Unset, the alert is skipped and says so in the Worker log.

**Delivery status needs a webhook.** Create one at resend.com/webhooks pointing to
`https://www.quickbooks-solutions.com/api/resend/webhook`, subscribe to the `email.*` events,
and put its signing secret in `RESEND_WEBHOOK_SECRET`. Without it every row stays at
`accepted` — which means "Resend took it", not "the customer got it". Resend cannot reach
localhost, so this only works against the deployed site.

The sending domain must be verified in Resend. Mail goes out as
`notifications@quickbooks-solutions.com`, with replies to `billing@quickbooks-solutions.com`.

**Dashboard variables only apply once a new Worker version is created from them.** Entering
values in Settings -> Variables and secrets and leaving the page is not enough: the form can
show the values while the running Worker has never had them. Check with
`npx wrangler secret list --name qbenterpayment` (secrets) and `npx wrangler tail
qbenterpayment` (a `requireEnv` failure names the missing variable).

`SHOPIFY_PRESENTMENT_CURRENCY` is not optional in practice: the store's base currency is
AUD, so without it draft orders are raised in AUD and a 49.87 order bills A$49.87 rather
than US$49.87.

`wrangler.jsonc` sets `keep_vars: true`, so `wrangler deploy` leaves dashboard-set plain
variables alone. Without it every git-triggered deploy silently wipes them.

CLI alternative: `npx wrangler secret put SHOPIFY_ACCESS_TOKEN`.

*Note: Windows cannot run the OpenNext build locally due to symlink permissions; builds run on Cloudflare Workers Builds (Linux) or WSL.*
