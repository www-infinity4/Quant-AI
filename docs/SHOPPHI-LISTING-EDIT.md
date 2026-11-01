# ShopPhi authenticated listing editing

Source: `worker/src/shopphi.js`. UI integration: `www-infinity4/QuantaPhi` PR #1336. Owner ticket: `www-infinity4/QuantaPhi#1335`.

## Authentication and authorization

All seller writes use the existing Quant-AI `authenticate(env, request)` wallet-device identity in `worker/src/index.js`; the owner is resolved server-side, never from client-provided user ID. A GPT/Quant AI assistant may suggest text and policy warnings at `POST /api/seller/assist`, but **it is not the authority for seller access** and cannot approve the user's publication. The user's existing Unified Wallet credential, seller ownership, server-side content rules and explicit consent authorize actions.

## Routes (under `/quant-ai/api/shopphi`)

- `GET /listings` — list private/published listings of the authenticated owner, excluding removed.
- `POST /listings` — create/update a **private draft**. Published items intentionally cannot be overwritten by this route.
- `POST /listings/:id/edit` — update the identified owner's saved or published listing. Body contains `itemId` matching `:id`, normalized item fields, and optional owner-held `photoIds`. A published edit additionally requires `confirmPublishedEdit: true`. Response `{edited:true, published, visibility, listing}` preserves original listing ID, state and share URL. Removed listings cannot be resurrected. Existing photos stay linked; only authenticated receipts can be newly attached.
- `POST /listings/:id/publish` — owner-attested unlisted publication requiring `ownItem:true` and `publishConsent:true`.
- `GET /public/:id` — unauthenticated public read **only** after publication.
- `POST /media` — authenticated private WebP upload to SELLER_MEDIA.

UI must require explicit reconfirmation before updating published item details, and verify public GET reflects the changed title and price before claiming the update is complete. Do not call an unlisted share page approved for Public/For You; moderation remains separate.

## Release sequence and verification

1. `node --test test/*.test.js` and `npm run build:edge` as defined in `package.json`; verify exact-head CI and reviewed diff.
2. Merge and deploy the Quant-AI Worker bundle from reviewed source with **all existing** DB, IDENTITY_DB, QUANTA_DB, SELLER_MEDIA and ORACLE bindings preserved. Verify deployment ID/version and read-only health.
3. Only once the new edit route is live, merge/deploy QuantaPhi frontend PR #1336 (script URLs cache-busted).
4. Sign in with an authorized seller wallet, create a private draft, edit it, publish with consent, edit the published title/price/real photos, and verify the original public URL from an independent anonymous client. Verify a different wallet cannot edit or read drafts; a guest cannot access owner routes; unsupported products remain blocked; wallet balances/receipts unchanged.

**No merge, Cloudflare deploy, owner-device run or live edit is asserted solely by this document.**
