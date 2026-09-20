# Growth Studio PDP Agent Kit Design

**Date:** 2026-09-20

## Goal

Add a merchant-neutral PDP video capability to the PixVerse API Kit. Agents and CLI users see the public name **PDP**; the implementation maps that capability to Growth Studio's current `POST /openapi/v1/ka/videos` contract with wire type `ecommerce_fashion_pdp`.

The feature must work for products supplied by any seller or merchant. No command, schema, example, validation rule, folder rule, or agent instruction may assume a specific retailer, merchant domain, brand, or customer.

Merchant neutrality does not broaden the current upstream product scope: the documented `ecommerce_fashion_pdp` type is for apparel/fashion products. Public guidance must state that current category boundary without tying the workflow to any particular seller.

## Scope

This change adds:

- a canonical `pixverse-api growth-studio pdp ...` CLI surface;
- a dedicated PDP client adapter and strict request validation;
- durable, single-submit PDP job artifacts and poll-only recovery;
- read-only Growth Studio wallet commands used for preflight and reconciliation;
- merchant-neutral PDP payload examples and agent instructions;
- unit, contract, integration, and end-to-end coverage without paid network access.

This change does not:

- rename or change the existing `growth-studio video ...` commands;
- add a legacy alias for PDP;
- accept or scrape a product detail page URL;
- expose the upstream term "KA video" as a public capability name;
- submit a live billable job as part of tests or release verification;
- add merchant-specific folders, metadata, defaults, or prompt language.

## Considered Approaches

### 1. Dedicated PDP workflow with an internal wire adapter — selected

Expose `growth-studio pdp` and translate a public PDP payload into the upstream `ecommerce_fashion_pdp` request. PDP receives its own validator and durable job entry point while reusing the existing Growth Studio authentication, response parsing, status polling, redaction, and artifact primitives.

This keeps public language stable if the upstream path or internal type changes, prevents PDP rules from weakening the existing video validator, and makes merchant neutrality explicit.

### 2. Auto-detect PDP inside `video create-from-json`

Inspect the payload and route it to `/ka/videos` when a PDP type is present. This reduces commands but makes endpoint selection implicit, exposes the internal type, complicates durable recovery, and risks changing existing `video` behavior.

### 3. General custom-video type registry

Create a generic registry for future custom video types and make PDP its first entry. This may become useful after more types are documented, but it adds abstraction without a second concrete type and exposes terminology the user has explicitly replaced with PDP.

## Public Interface

The canonical commands are:

```text
pixverse-api growth-studio pdp create --payload <pdp.json> --confirm-billable [job options]
pixverse-api growth-studio pdp create --payload <pdp.json> --dry-run
pixverse-api growth-studio pdp get <video_id>
pixverse-api growth-studio pdp poll <video_id> [polling options]
pixverse-api growth-studio pdp resume <job-directory> [polling options]
pixverse-api growth-studio wallet balance
pixverse-api growth-studio wallet ledgers [--offset 0] [--limit 20]
```

`pdp create` is the only public PDP submission command. It is durable by default: it writes a redacted request artifact before the single network submission, records the response and string `video_id`, and then polls unless `--no-poll` is supplied. There is no separate unsafe direct-create command.

`--confirm-billable` is required for a real submission. `--dry-run` validates and prints the normalized wire request without loading credentials, creating a job directory, or making a network call. The two flags are mutually exclusive.

The existing `growth-studio video get` and `video poll` commands continue to work for PDP IDs because Growth Studio uses the shared video-details endpoint. The PDP aliases provide a capability-coherent agent surface.

## Public PDP Payload

The caller supplies a seller-neutral JSON document:

```json
{
  "product": {
    "title": "Linen Summer Shirt",
    "description": "Breathable linen with a relaxed fit.",
    "images": [
      { "url": "https://media.pixverse.ai/example/front.webp" },
      { "url": "https://media.pixverse.ai/example/back.webp" }
    ],
    "brand": "Example Brand",
    "price": {
      "amount": "59.90",
      "currency": "USD"
    }
  },
  "video": {
    "mode": "pro",
    "duration": 10,
    "quality": "high",
    "aspect_ratio": "9:16",
    "additional_prompt": "Soft morning light and clean product-focused styling."
  }
}
```

The public payload does not accept `type`, `source_url`, merchant URLs, folder fields, or arbitrary metadata. The adapter creates a new wire object and injects:

```json
{ "type": "ecommerce_fashion_pdp" }
```

The caller's object is never mutated.

### Validation

Validation mirrors the documented PDP contract and rejects unknown fields before billing:

- root fields: exactly `product` and `video`;
- `product.title`: required non-empty string, at most 255 characters;
- `product.description`: optional string, at most 5,120 characters;
- `product.images`: required array containing 1–8 entries;
- each image: exactly one `url` field using HTTPS with hostname `media.pixverse.ai`;
- `product.brand`: optional string, at most 255 characters;
- `product.price`: optional object containing string `amount` and uppercase three-letter `currency`;
- `video.mode`: required, `standard` or `pro`;
- `video.duration`: optional integer from 5 through 10;
- `video.quality`: optional, `normal` or `high`;
- `video.aspect_ratio`: optional, one of `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, or `21:9`;
- `video.additional_prompt`: optional string, at most 2,000 characters.

Brand and price remain optional upstream record fields; agent instructions must not claim they influence generation. Seller identity is not inferred from URLs or added to the wire payload.

## Components

### PDP contract module

A focused Growth Studio PDP module owns the public schema, immutable normalization, the internal wire type, and validation. Existing general video validation remains unchanged.

### Growth Studio client

The client adds a PDP submission method that posts the normalized request once to `/openapi/v1/ka/videos`. It continues to use bearer authentication, optional `Ai-Trace-Id`, the shared response parser, and the shared `GET /openapi/v1/videos/{video_id}` status path.

The client also exposes read-only wallet balance and ledger methods. Ledger pagination validates integer `offset >= 0` and integer `limit` from 1 through 100.

### Durable PDP jobs

The existing Growth Studio job machinery is generalized without changing the behavior of `growth-studio run-job`. A PDP job records `workflow: "pdp"`, the exact normalized and redacted wire payload, the endpoint identity, create response, `video_id`, `ledger_source_id`, polling snapshots, and final state.

PDP resume is poll-only. If no `video_id` was durably recorded, it returns `reconciliation_required` and never submits again. The saved `ledger_source_id` is preserved as a string for matching wallet entries where `source_type` is `video`.

No folder resolution runs for PDP because the documented endpoint rejects undefined top-level fields and does not document `folder_id`.

### Agent skill

The Growth Studio skill presents PDP as a generic product capability for any seller or merchant. Its standard flow is:

1. gather title, optional description, and 1–8 product images;
2. upload local images through the existing Growth Studio upload command;
3. construct and dry-run a PDP payload;
4. check the Growth Studio wallet balance when relevant;
5. obtain explicit approval immediately before the billable command;
6. submit exactly once with `--confirm-billable`;
7. preserve the returned job directory and string identifiers;
8. resume or reconcile instead of resubmitting after ambiguity.

Examples use neutral product data and do not name a real seller.

## Data Flow

```text
merchant-neutral PDP JSON
        |
        v
strict PDP validation ----> fail locally before credentials or billing
        |
        v
immutable wire adapter adds ecommerce_fashion_pdp
        |
        v
durable redacted request artifact
        |
        v
single POST /openapi/v1/ka/videos
        |
        +---- ambiguous/no saved ID ----> reconciliation_required
        |
        v
save video_id + ledger_source_id as strings
        |
        v
GET /openapi/v1/videos/{video_id} until terminal state
```

## Errors and Recovery

The existing `GrowthStudioApiError` remains the public error type. Code branches on `error.code`, not message text. PDP preserves `request_id` and `Retry-After` metadata.

Create is never retried automatically. Read-only balance, ledger, details, and polling calls may be retried only according to their existing bounded polling/retry behavior and `Retry-After` guidance. A `202` create response is treated as charged and queued, not complete.

For reconciliation, the agent matches the saved PDP `video_id` or `ledger_source_id` to ledger entries with `source_type: "video"`. A missing ledger entry can mean a free generation or a short visibility delay and is not proof that submission failed.

## Compatibility

- Existing Growth Studio command names, legacy aliases, payloads, folders, and artifacts keep their current behavior.
- Existing Platform API code and credentials are untouched.
- PDP uses only `PIXVERSE_GROWTH_API_KEY` and the existing Growth Studio base URL controls.
- No public command or skill requires callers to know the `/ka/videos` path or `ecommerce_fashion_pdp` type.
- IDs and monetary amounts remain strings and are never converted through unsafe numeric representations.

## Testing and Release Gates

Development follows red-green-refactor. Tests cover:

- strict PDP field, type, enum, range, URL-host, and unknown-field validation;
- immutable wire normalization and internal type injection;
- bearer-only request headers and exact `/openapi/v1/ka/videos` path;
- durable single submission, artifacts, polling, resume, and ambiguous-result behavior;
- `--dry-run` and missing-confirmation paths making zero network calls;
- wallet balance and ledger query validation;
- merchant-neutral CLI help, documentation, payload fixtures, and skill language;
- unchanged existing Growth Studio and Platform behavior.

All automated tests run behind the no-paid-network guard. Completion requires:

```text
npm run test:coverage
npm test
npm run check
npm run security:scan
npm audit --audit-level=high
git diff --check
```

No live PDP generation is part of verification.
