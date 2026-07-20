# vcskill-web

The public edge + landing page for [**vcskill**](https://vcskill.vchun.dev) — a
single Cloudflare Worker bound to `vcskill.vchun.dev`.

The vcskill source repo is private. This Worker is its **only public face**: it
serves the landing page and proxies the private repo's GitHub Releases with a
server-side token, so anyone can `curl … | bash` without touching GitHub.

```
GET /                 → landing page (landing.html)
GET /install          → install.sh          (proxied from private repo)
GET /install.ps1      → install.ps1
GET /version          → latest release tag
GET /download/<asset> → release binary       (token-proxied)
```

## Files

| File | What |
|---|---|
| `worker.js` | The Worker: routing + GitHub token-proxy |
| `landing.html` | Self-contained landing page, imported as a Text module, served at `/` |
| `wrangler.toml` | Worker name `vcskill`, custom domain `vcskill.vchun.dev`, HTML text-module rule |

## Deploy

Requires the Cloudflare account that owns the `vchun.dev` zone.

```bash
npx wrangler login          # once
npx wrangler deploy         # ships worker.js + landing.html to vcskill.vchun.dev
```

The Worker needs one secret — a fine-grained GitHub PAT with **Contents: read**
on the private `bavanchun/vcskill` repo (read releases + install scripts):

```bash
npx wrangler secret put GH_TOKEN
```

The secret lives on the deployed Worker in Cloudflare, not in this repo or in
source control. Rotating it: run `wrangler secret put GH_TOKEN` again with a new
PAT, then `wrangler deploy`.

## Editing the landing page

`landing.html` is fully self-contained (inline CSS/JS, Google Fonts via `<link>`).
Edit it, then `wrangler deploy`. It is served at `/` with a 5-minute edge cache,
so a change may take up to 5 minutes to appear on the bare path.

## Notes

- The Worker owns the whole `vcskill.vchun.dev` host. If the landing site grows
  into a multi-page/build-tooled site, migrate to Cloudflare Pages + a Pages
  Function for the install proxy (bigger change; not needed for a single page).
- Release automation is unaffected: CI in the private repo publishes binaries to
  its own GitHub Releases; this Worker just reads them.
