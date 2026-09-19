# PixVerse API Command Reference

Use `pixverse-api` for API work. The general `pixverse` web CLI remains separate.

## Providers

- `pixverse-api platform ...`
- `pixverse-api growth-studio ...`

## Platform

```bash
npm run cli -- platform account balance
npm run cli -- platform upload image ./reference.png
npm run cli -- platform video text --payload ./text-video.json --dry-run
npm run cli -- platform run-job --operation video.image --payload ./image-video.json --poll
npm run cli -- platform resume ./pixverse-api-jobs/platform/<job-dir>
```

## Growth Studio

```bash
npm run cli -- growth-studio avatars list
npm run cli -- growth-studio folders list
npm run cli -- growth-studio folders ensure "REVOLVE"
npm run cli -- growth-studio upload image /absolute/path/product.webp
npm run cli -- growth-studio video create-from-url "https://shop.example.com/products/item"
npm run cli -- growth-studio run-job --payload ./payload.json --folder-name "REVOLVE"
```

Legacy Growth Studio aliases such as `get`, `poll`, `run-job`, and `create-from-url` still work in `0.x` and emit one deprecation warning.
