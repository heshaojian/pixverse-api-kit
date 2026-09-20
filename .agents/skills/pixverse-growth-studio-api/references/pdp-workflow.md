# PDP Workflow

Use this workflow for a PDP video made from uploaded fashion or apparel product images. It works for products from any seller or merchant; seller identity does not change the payload or commands. The current PDP capability is not documented for unrelated product categories.

## Prepare and Validate

1. Gather a title and 1–8 clear product images. Description, brand, and price are optional. Brand and price are record fields, not generation controls.
2. Upload every local image and keep the returned PixVerse URL:

   ```bash
   npm run cli -- growth-studio upload image /absolute/path/front.webp
   ```

   `product.images[].url` accepts only uploaded `https://media.pixverse.ai/...` URLs. Do not use merchant-hosted image URLs or a product-page URL.
3. Copy [the public PDP payload](pdp-payload.json) to a job-specific path and replace its example values. Do not add `type`, `source_url`, `folder_id`, seller fields, or metadata.
4. Validate and inspect the exact normalized request locally:

   ```bash
   npm run cli -- growth-studio pdp create --payload /absolute/path/pdp.json --dry-run
   ```

   Dry run is non-billable: it does not load credentials, call the network, or create a job directory.
5. When useful, read the current wallet snapshot:

   ```bash
   npm run cli -- growth-studio wallet balance
   ```

   Wallet balance is a read-only preflight snapshot. It is not a price quote, reservation, entitlement check, or guarantee that the submission will succeed. A balance read is optional and does not replace approval.

## Approve and Submit Once

After the dry run and any wallet check, obtain explicit approval immediately before the live command. The approval must cover this PDP submission; do not reuse approval from an earlier job.

Run exactly one confirmed create:

```bash
npm run cli -- growth-studio pdp create --payload /absolute/path/pdp.json --confirm-billable
```

The command creates durable evidence before its one network submission. A `202 Accepted` response means the job is charged and queued, not finished. Never retry or resubmit create automatically, including after a timeout, connection loss, malformed response, or interrupted poll.

Keep the returned `job_dir`, `video_id`, and optional `ledger_source_id`. Preserve every identifier and monetary amount as a string.

## Inspect, Poll, or Resume

Use the capability-coherent commands for a known ID:

```bash
npm run cli -- growth-studio pdp get <video_id>
npm run cli -- growth-studio pdp poll <video_id>
```

Resume an existing durable job after an interrupted poll:

```bash
npm run cli -- growth-studio pdp resume /absolute/path/jobs/<job-dir>
```

Resume is poll-only. It never calls create. A saved `failed` or `canceled` state is terminal and should be reported with its resource error and `request_id`.

## Artifacts and Reconciliation

A PDP job directory can contain:

- `request.json`: redacted normalized request, workflow, endpoint identity, and trace;
- `create-response.json`: redacted response from the single create attempt;
- `video-id.json`: string `video_id`;
- `ledger-source-id.json`: string `ledger_source_id`, when returned;
- `polling.jsonl`: status snapshots;
- `final.json`: latest terminal or no-poll result;
- `error.json`: safe failure details.

If `video-id.json` exists, run `pdp resume`; do not create again. If no `video_id` was durably saved, resume returns `reconciliation_required` and does not submit.

For reconciliation, inspect the saved artifacts and then read wallet entries if useful:

```bash
npm run cli -- growth-studio wallet ledgers --offset 0 --limit 20
```

Match an entry whose `source_type` is `video` and whose string `source_id` equals the saved string `ledger_source_id` or `video_id`. A missing ledger entry is not proof that create failed: it may be a free generation, or ledger visibility may be delayed. Keep the original evidence and stop for operator review rather than guessing or resubmitting.

## Access and Transport Errors

- A `403` from PDP or wallet endpoints usually means the account or key lacks entitlement. Treat it as an access issue and request or verify entitlement; do not retry the billable create.
- A `429` may be retried only for safe read-only operations and only according to `Retry-After`. An ambiguous create remains a reconciliation case.
- Branch on the structured error code or status, not message text, and preserve the returned `request_id` when present.
