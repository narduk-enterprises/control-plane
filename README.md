# control-plane

Nuxt 4 application deployed on Cloudflare Workers.

Local development reads `NUXT_PORT` from the app's Doppler `dev` config and uses
the same port for local `SITE_URL` fallbacks. Fleet provisioning assigns a
unique `NUXT_PORT` automatically; existing apps can be backfilled with
`pnpm run fleet:backfill-nuxt-ports`.
