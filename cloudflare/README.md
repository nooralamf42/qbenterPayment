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
  - `NEXT_PUBLIC_EPAY_PUBLIC_KEY`
  - `NEXT_PUBLIC_EPAY_TER_NO`
  - `NEXT_PUBLIC_RESEND_API_KEY`
- **Runtime secrets** (Worker -> Settings -> Variables and secrets):
  - `TRUSTAP_API_KEY` (Secret)
  - `TRUSTAP_SELLER_ID` (Secret)

*Note: Windows cannot run the OpenNext build locally due to symlink permissions; builds run on Cloudflare Workers Builds (Linux) or WSL.*

