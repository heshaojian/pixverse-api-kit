# Brand Pitch Pages

Customer-specific pitch pages live under one folder per brand, then one folder per pitch:

```text
deploy/brand-pitches/<brand>/<pitch-name>/
```

Each pitch folder should be self-contained for static hosting:

- `index.html` for the customer-facing page
- `_headers` when the page needs Cloudflare Pages headers
- `assets/` for local logos, posters, or public-safe media

Use public-safe assets only. Keep internal research, generation payloads, job IDs, and private notes outside this deploy surface.

Current brand pitch pages:

- `plaud/plaud-pixverse-0914/`
- `revolve/growth-studio-10sku/`
- `revolve/v2/`
- `revolve/v3/`
- `revolve/v4/`
