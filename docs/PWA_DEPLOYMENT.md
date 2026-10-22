# ParcelSense PWA deployment and Name.com DNS

## Recommended address and host

- Intended PWA address: `https://parcelsense.joalvergs.tech` (custom-domain DNS is pending)
- Current production URL: `https://parcelsense-ai.pages.dev`
- Static host: Cloudflare Pages (selected by the user)
- Pages project: `parcelsense-ai` (created as Direct Upload)

For Cloudflare Pages, use `frontend` as the project root, `npm ci && npm run build` as the build command, and `dist` as the output directory. The project builds a static SPA, install manifest, app-shell service worker, and `_headers` policy; it does not require Pages Functions or a backend. Check offline behavior using the production preview before deployment.

## Deployment path

This checkout has no Git remote configured, so the Pages project was created as Cloudflare Direct Upload with Wrangler. Direct Upload projects cannot later be converted to Git integration. The project is named `parcelsense-ai`; a Git remote was not added.

From the repository root, run:

```sh
cd frontend
npm ci
npm test
npm run build
wrangler login
wrangler pages deploy dist --project-name parcelsense-ai --branch preview
wrangler pages deploy dist --project-name parcelsense-ai
```

The first command uploads a preview branch; omit `--branch` to deploy to the configured production branch (`master`). The project already exists, so do not run the project-creation command again. Wrangler and Vite must be available in the shell; Wrangler authentication is per developer account.

After the first upload, verify the generated `*.pages.dev` URL, response headers, manifest, and production service-worker installation. Visit once online, allow caching to finish, reload, then test offline reload and recovery after reconnecting. Imported files and records are browser-local; hosting does not upload those records to Cloudflare.

The custom domain is associated with the Pages project. The confirmed CNAME target is `parcelsense-ai.pages.dev`.

## Name.com DNS record

The Pages project already has `parcelsense.joalvergs.tech` associated as a custom domain. Cloudflare requires associating the subdomain with the project before manually adding a CNAME at an external DNS provider. Since Name.com nameservers are authoritative, add this record in Name.com **Manage DNS Records**:

| Type | Host | Answer / target | TTL |
|---|---|---|---|
| CNAME | `parcelsense` | `parcelsense-ai.pages.dev` | `300` (or Name.com's default) |

Do not enter `https://` or a path in the CNAME target. Do not add an A/AAAA record for the same `parcelsense` hostname alongside this CNAME. This setup affects only the proposed PWA subdomain; it does not require changing the apex `joalvergs.tech` records or adding a wildcard.

Name.com only serves these DNS records when the domain is using Name.com's nameservers. If its nameservers point elsewhere, add the CNAME at the active authoritative DNS provider instead. Do not switch nameservers without first checking and preserving all existing website and email records.

DNS pointing does not itself establish HTTPS. After the record resolves, wait for Cloudflare Pages to show the custom domain and TLS certificate as active, then verify the site loads over HTTPS. The PWA must be served from HTTPS when hosted; localhost is appropriate for local development.

## Name.com steps

1. Sign in to Name.com and open **My Domains**.
2. Select `joalvergs.tech`, then **Manage DNS Records**.
3. Confirm Name.com is authoritative for the domain. If not, edit the records at the provider named by the current nameservers.
4. Add the CNAME row above, using `parcelsense-ai.pages.dev` as **Answer** and `parcelsense` as **Host**.
5. Save the record and wait for DNS and Pages TLS activation. Verify `https://parcelsense.joalvergs.tech` before relying on installation/offline behavior.

References: [Name.com: Adding a CNAME Record](https://www.name.com/support/articles/115004895548-adding-a-cname-record) explains the Host/Answer fields and Name.com nameserver requirement. [Cloudflare Pages: Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/) says to add the custom domain in the Pages project first and, for an external DNS provider, point a CNAME at `<YOUR_SITE>.pages.dev`.

## Current release readiness

- `npm test`: 9 tests pass.
- `npm run build`: passes; emits the static bundle, `sw.js`, manifest, and `_headers`.
- Contrast pass: muted text colors on light surfaces were darkened and checked against the light palette; dark-hero text and semantic state colors were preserved. Compact micro-label sizing remains visually dense.
- Local production-preview check: **PASS** in Chromium 153. The service worker controlled the page, cached all 8 app-shell files, and an offline navigation rendered the app. Desktop and 390 px mobile views were inspected with no horizontal overflow.
- Hosted preview and production checks: **PASS** at `https://preview.parcelsense-ai.pages.dev` and `https://parcelsense-ai.pages.dev`; HTTPS, security headers, manifest, worker, 8 cached assets, offline navigation, and zero external app resource requests were verified.
- Pages production deployment: **LIVE** at `https://parcelsense-ai.pages.dev` (deployment `89636394-48fd-4f49-9b12-da6fa59d7447`).
- Custom-domain association: created in Pages, but validation is **PENDING** with `CNAME record not set`.
- DNS: Name.com authoritative nameservers are confirmed. No CNAME/A/AAAA record currently exists for `parcelsense.joalvergs.tech`; Name.com account/API access is not connected, so the record has not been changed. After adding `CNAME parcelsense -> parcelsense-ai.pages.dev` (TTL 300), verify Cloudflare TLS activation and repeat the hosted check on the custom hostname.
