# ParcelSense PWA deployment and Name.com DNS

## Recommended address and host

- Production PWA address: `https://parcelsense.joalvergs.tech` (custom domain active)
- Cloudflare Pages fallback URL: `https://parcelsense-ai.pages.dev`
- Static host: Cloudflare Pages (selected by the user)
- Pages project: `parcelsense-ai` (created as Direct Upload)

For Cloudflare Pages, use `frontend` as the project root, `npm ci && npm run build` as the build command, and `dist` as the output directory. The project builds a static SPA, install manifest, app-shell service worker, and `_headers` policy. The optional local development API is not deployed as a Pages Function, and production builds do not call it. Check offline behavior using the production preview before deployment.

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

After the first upload, verify the generated `*.pages.dev` URL, response headers, manifest, and production service-worker installation. Visit once online, allow caching to finish, reload, then test offline reload and recovery after reconnecting. Imported files and records are browser-local; the optional loopback API is available only during local development and hosting does not upload records to Cloudflare.

The custom domain is associated with the Pages project. The confirmed CNAME target is `parcelsense-ai.pages.dev`.

## GitHub Actions release automation

`.github/workflows/ci.yml` runs on pull requests to `master`, pushes to `master`, and manual dispatches. The workflow checks the PWA, runs its browser integration and Chromium/Firefox readiness suites, tests the local API and ML pipeline, runs firmware host tests, and compiles the STM32 firmware without requiring a board. The production deployment waits for every check, deploys the exact PWA bundle produced by the passing web job, and verifies the custom domain serves that bundle, install manifest, service worker, and security headers.

The repository is private at <https://github.com/Joal0816/parcelsense-ai>, with `master` as its pushed branch. The `production` Actions environment has been created.

To finish the production release:

1. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as secrets in the repository's `production` environment. Create an account API token with **Cloudflare Pages: Edit** permission, scoped to the account containing `parcelsense-ai`.
2. Re-run the `ParcelSense CI and CD` workflow on `master`. The deploy job publishes the verified bundle and checks the production hostname afterward.
3. Protect `master` with required checks for **Web checks and browser readiness**, **Backend and ML tests**, **Firmware host tests**, and **STM32 firmware compile**.

The first Actions run (#40572216575) passed all four CI jobs and stopped at the Cloudflare-secret preflight. The production environment exists but contains neither required secret yet. Do not put either Cloudflare value in the repository or commit it to source control.

## Name.com DNS record

The Pages project has `parcelsense.joalvergs.tech` associated as a custom domain. Cloudflare requires associating the subdomain with the project before adding a CNAME at an external DNS provider. The verified Name.com record is:

| Type | Host | Answer / target | TTL |
|---|---|---|---|
| CNAME | `parcelsense` | `parcelsense-ai.pages.dev` | `300` |

Do not enter `https://` or a path in the CNAME target. Do not add an A/AAAA record for the same `parcelsense` hostname alongside this CNAME. This setup affects only the proposed PWA subdomain; it does not require changing the apex `joalvergs.tech` records or adding a wildcard.

Name.com only serves these DNS records when the domain is using Name.com's nameservers. If its nameservers point elsewhere, add the CNAME at the active authoritative DNS provider instead. Do not switch nameservers without first checking and preserving all existing website and email records.

Cloudflare Pages now reports the custom domain, DNS verification, and HTTP validation as active. Public resolvers return the expected CNAME, and HTTPS responds with HTTP 200. The PWA must be served from HTTPS when hosted; localhost is appropriate for local development.

If a device still reports `ERR_NAME_NOT_RESOLVED` after DNS is active, it may have cached the previous NXDOMAIN response. On Linux systems using systemd-resolved, clear the system DNS cache with `sudo resolvectl flush-caches`; in Chromium, clear the host cache at `chrome://net-internals/#dns` or fully restart the browser.

## Name.com steps

1. Sign in to Name.com and open **My Domains**.
2. Select `joalvergs.tech`, then **Manage DNS Records**.
3. Confirm Name.com is authoritative for the domain. If not, edit the records at the provider named by the current nameservers.
4. Add the CNAME row above, using `parcelsense-ai.pages.dev` as **Answer** and `parcelsense` as **Host**.
5. Save the record and wait for DNS and Pages TLS activation. Verify `https://parcelsense.joalvergs.tech` before relying on installation/offline behavior.

References: [Name.com: Adding a CNAME Record](https://www.name.com/support/articles/115004895548-adding-a-cname-record) explains the Host/Answer fields and Name.com nameserver requirement. [Cloudflare Pages: Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/) says to add the custom domain in the Pages project first and, for an external DNS provider, point a CNAME at `<YOUR_SITE>.pages.dev`.

## Current release readiness

- `npm test`: 11 tests pass.
- `npm run build`: passes; emits the static bundle, `sw.js`, manifest, and `_headers`.
- Keyboard and responsive updates: skip navigation, route/session focus, live status semantics, progress announcement, reduced-motion handling, and 44 px touch targets are implemented. The mobile nav shows all five destinations at 320 px. The impeccable detector reports no remaining findings in `App.tsx` and `styles.css`.
- Local production-preview check: **PASS** in Chromium. A temporary synthetic fixture completed import, review, IndexedDB persistence across reload, exact export, and deletion. The service worker controlled the page, cached all 8 app-shell files, and an offline reload rendered the app. 1440, 768, 390, and 320 px viewports had no horizontal page overflow.
- Repeatable Chromium and Firefox checks now cover landmarks/control names, responsive layout at 1440/768/390/320 px, and offline shell reload/navigation. Keyboard interaction is automated in Chromium. Mobile screen-reader use, actual quota pressure, browser eviction, Safari/iOS, and real-device validation remain pending.
- Hosted preview and production checks: **PASS** at `https://preview.parcelsense-ai.pages.dev` and `https://parcelsense-ai.pages.dev`; HTTPS, security headers, manifest, worker, 8 cached assets, and offline navigation were verified.
- Latest Pages production deployment: **LIVE** at `https://parcelsense-ai.pages.dev` and `https://parcelsense.joalvergs.tech` (deployment `f9cddb6d-22d9-40d9-8108-195c14240d1a`, production branch `master`, source commit `8f4a0ee5e782ce8674bd8d77c71109ba0ef84138`). The previous production release is superseded.
- The corresponding preview release is live at `https://preview.parcelsense-ai.pages.dev` (deployment URL `https://3a7db280.parcelsense-ai.pages.dev`). Both production hosts and the immutable deployment URL returned HTTP 200 and served the new JavaScript/CSS bundle. The manifest, service worker, `_headers`, and new bundle assets all returned HTTP 200.
- Current checkout comparison (2026-10-28): the custom domain still returns HTTP 200 and the expected security headers, but serves `index-DIDl3Fh1.js` and `index-DfcPmeKM.css`; the current tested build references `index-Y6spORdI.js` and `index-7YNUYjZC.css`. `npm run verify:production` correctly fails against the existing release because it is not the current checkout's bundle. Publishing the updated bundle is pending Cloudflare deployment credentials and a successful hosted deploy run.
- Post-deploy Chromium verification on the custom domain confirmed the service worker controlled the app, cached all 8 app-shell files, and served the app after a network-disabled reload. This verifies the browser shell only; embedded inference remains independent and hardware testing is still pending.
- Custom-domain association: **ACTIVE** in Cloudflare Pages; DNS verification and HTTP certificate validation are active.
- Name.com authoritative DNS and public resolvers return `parcelsense.joalvergs.tech CNAME parcelsense-ai.pages.dev` with TTL 300. HTTPS responds with HTTP 200, and a Chromium test confirmed service-worker installation and offline shell navigation on the custom hostname. The test environment had cached the earlier NXDOMAIN, so Chromium used a host override to the Cloudflare Pages IP while public DNS propagated.
