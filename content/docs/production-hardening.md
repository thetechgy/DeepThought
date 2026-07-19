+++
title = "Production hardening"
description = "Deploy DeepThought with a strict content security policy and safe Cloudflare settings."
date = 2026-07-18
+++

DeepThought can run without inline executable code, remote fonts, or remote icon styles. Keep
optional third-party components disabled unless the site needs them, then add only their exact
origins to the policy.

## Baseline response headers

For a site using only Cloudflare Web Analytics and privacy-enhanced YouTube/Vimeo embeds, start
with these Cloudflare Pages headers:

```text
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-site
  Permissions-Policy: camera=(), geolocation=(), microphone=()
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
```

Test comments, maps, charts, math, diagrams, and galleries separately before enabling them. Some
integrations require additional script, style, image, connection, worker, or frame origins.

## Cloudflare dashboard checklist

- Disable Rocket Loader so it does not rewrite first-party scripts.
- Disable Bot Fight Mode for a static, unauthenticated site. Keep DDoS protection, Browser
  Integrity Check, and the managed WAF ruleset.
- Disable automatic Web Analytics injection and set `extra.analytics.cloudflare_token` for the
  manual beacon.
- Do not set `Cache-Control: no-transform` globally. It prevents
  Cloudflare from applying Brotli or gzip compression to HTML, CSS, and JavaScript.
- Do not create broad cache rules for mutable filenames. Use Pages defaults and immutable caching
  only for files under `processed_images`, whose names are content hashes.
- Create a proxied apex record and redirect the apex plus the production `pages.dev` hostname to
  the canonical `www` hostname while preserving paths and queries.
- Verify apex HTTPS before setting zone HSTS to one year with `includeSubDomains` and `preload`.
- Verify production responses do not contain Rocket Loader, JavaScript Detection, duplicate
  analytics beacons, CSP console errors, or unexpected cookies.
- Verify compressible production responses include `Content-Encoding: br` or
  `Content-Encoding: gzip`.

Dashboard and DNS settings are external state. Record their final values with the website
repository and re-audit them on a schedule.

## Preview and production SEO audits

Cloudflare Pages preview deployments can send `X-Robots-Tag: noindex`. That is the correct
behavior for a temporary preview, but Lighthouse reports it as a crawlability failure and lowers
the SEO category score. Do not weaken preview indexing protection to make that score green.

Run the theme's Lighthouse checks against the local generated site, where every scored SEO audit
must pass. After promoting a release, audit the canonical production hostname separately and
verify that it:

- does not send `X-Robots-Tag: noindex`;
- emits the production canonical URL, a non-empty meta description, and image alt text;
- serves `robots.txt` and the configured sitemap; and
- scores 100 in Lighthouse SEO.
