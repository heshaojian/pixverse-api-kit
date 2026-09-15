# Brand Pitch Pages

Customer-specific pitch pages live in one folder per pitch:

```text
deploy/brand-pitches/<brand-or-campaign-name>/
```

Each pitch folder should be self-contained for static hosting:

- `index.html` for the customer-facing page
- `_headers` when the page needs Cloudflare Pages headers
- `assets/` for local logos, posters, or public-safe media

Use public-safe assets only. Keep internal research, generation payloads, job IDs, and private notes outside this deploy surface.
