# Quant-AI

Quant usefulness assistant for QuantaPhi buyers and sellers. Work is on PR #1;
main does not yet contain the Worker.

## Implemented on the PR branch
- Packet v2 parser: observed events, provenance, derived tags with evidence IDs and confidence, and purpose permissions.
- Protected data routes authenticate a Bearer sq_ device token against IDENTITY_DB and resolve an active wallet in QUANTA_DB. The old x-wallet-address assumption is removed.
- Authoritative mint lookup, packet ingest, single-use matching records, and scoped daily aliases.
- Owned search-Quant lookup, folders, and saved inventory experiments; frontend controls exist for folders and inventory.
- Chat forwarding exists but does not load wallet evidence.
- Transfers return use_authoritative_quanta_transfer; this Worker does not move balances.

## Repository wiring
wrangler.toml now declares IDENTITY_DB (starquest-ledger) and QUANTA_DB
(infinity-ledger), using resource IDs from QuantaPhi/workers/quanta-phi-ledger/wrangler.toml.
These identifiers are not secrets and do not verify live account access.

Deployment still requires the actual Quant-AI DB ID, schema application, a verified
QUANTAPHI_AI_URL with a compatible request/response contract, and authenticated
deployment access. Do not guess values or put credentials in this repository.

The UI reads device tokens from same-origin localStorage. A separate origin cannot
inherit QuantaPhi's token. Wallet access needs an explicit same-origin mount and API
routing (current frontend requests use root /api paths), or a verified secure session bridge.
Owned-Quant rendering exists but is not called at startup; adding a Quant to a folder
also requires an ingested packet. Packet ingest and matching have no frontend controls.

## Remaining ledger and evidence work
This is not a deployed accountant or a five-Quant spend implementation.
Matching checks a positive balance and records a unique search use; it does not
debit the authoritative ledger or settle a receipt. Mint existence is not proof of
current unit ownership. Packet ingest must validate source ownership and event/tag
evidence; candidate matching must enforce recipient permissions, alias consent and expiry.
Fungible transfers do not establish packet lineage.

The requested next capabilities are an idempotent authoritative spend/receipt
adapter for a selected five-Quant scan, evidence-backed recommendations, opt-in
aggregate inventory analysis across customers, and authorized merchant-page jobs.
A Pink Floyd purchase alone does not prove Steve Miller, Grand Funk or Janis Joplin
purchases; recommendations must distinguish observed interests from suggestions.

QuantaPhi's current Robot Brain writer excludes wallet/backend changes. A dedicated
implementation and acceptance adapter is required before it can execute these jobs.
Music/ambience remains unbuilt.

## Validation (2026-10-10)
- TOML parsing and required binding checks: passed.
- Three focused authentication/binding route checks with mock D1: passed.
- Existing npm test: 0 passed, 2 failed. Tests still send x-wallet-address and Packet
  v1; they fail at authentication and must be migrated to the current contracts.
- No live wallet, AI call, deployment, debit, deposit or customer scan was verified.
