# Cloudflare Workers Deploy

This project is configured to build and deploy to Cloudflare Workers via `@opennextjs/cloudflare`.

- `wrangler.jsonc`, `open-next.config.ts`, `worker.ts` (repo root) - Worker config and entry.
- `scripts/cf-post-build.mjs` + `cloudflare/_headers.txt` - Static asset caching and security headers.

## Cloudflare Dashboard (Workers & Pages -> Create -> Import Repo)
- **Build command**: `npm run cf:build`
- **Deploy command**: `npx wrangler deploy`
- **Non-production branch command**: `npx wrangler versions upload`
- **Worker name**: Must match `name` in `wrangler.jsonc` (default: `quickbooks-solution`).
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
| `SHOPIFY_CLIENT_ID` | Text | |
| `SHOPIFY_SHOP_DOMAIN` | Text | e.g. `pd86wh-3f.myshopify.com` |
| `SHOPIFY_API_VERSION` | Text | e.g. `2025-07` |
| `SHOPIFY_ENTERPRISE_VARIANT_ID` | Text | Variant the Enterprise line item attaches to |
| `SHOPIFY_PRESENTMENT_CURRENCY` | Text | `USD`. Needs a matching active Shopify market |
| `SHOPIFY_BUYER_COUNTRY` | Text | `US`. Picks the market the subscription cart prices in |

`SHOPIFY_PRESENTMENT_CURRENCY` is not optional in practice: the store's base currency is
AUD, so without it draft orders are raised in AUD and a 49.87 order bills A$49.87 rather
than US$49.87.

`wrangler.jsonc` sets `keep_vars: true`, so `wrangler deploy` leaves dashboard-set plain
variables alone. Without it every git-triggered deploy silently wipes them.

CLI alternative: `npx wrangler secret put SHOPIFY_ACCESS_TOKEN`.

*Note: Windows cannot run the OpenNext build locally due to symlink permissions; builds run on Cloudflare Workers Builds (Linux) or WSL.*
