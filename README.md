# Quant-AI

Quant usefulness assistant for QuantaPhi buyers and sellers. Work is on PR #1;
main does not yet contain the Worker.

## Implemented on the PR branch
- Packet v2 parser: observed events, provenance, derived tags with evidence IDs and confidence, and purpose permissions.
- Protected data routes authenticate a Bearer sq_ device token against IDENTITY_DB and resolve an active wallet in QUANTA_DB. The old x-wallet-address assumption is removed.
- Authoritative mint lookup, packet ingest, single-use matching records, and scoped daily aliases.
- Owned search-Quant lookup, folders, and saved inventory experiments; frontend controls exist for folders, inventory and Packet v2 JSON upload/paste.
- Chat forwarding requires an authenticated wallet; it does not yet load wallet evidence and the QUANTAPHI_AI_URL integration is unverified.
- Transfers return use_authoritative_quanta_transfer; this Worker does not move balances.

## Repository wiring
wrangler.toml now declares IDENTITY_DB (starquest-ledger) and QUANTA_DB
(infinity-ledger), using resource IDs from QuantaPhi/workers/quanta-phi-ledger/wrangler.toml.
These identifiers are not secrets and do not verify live account access.

The Cloudflare Quant-AI D1 database is now provisioned with verified ID
`4bb698ec-ee8c-42ec-ab4b-329f5df6ef95` and `schema.sql` has been applied.
The two existing authoritative D1 databases were inspected read-only and their
required table columns confirmed. Deployment still needs the Quant-AI Worker
itself, service binding from the site Worker, and verification of the live origin.
`QUANTAPHI_AI_URL` must be verified independently before enabling AI chat.
Do not guess values or put credentials in the repository.

The UI reads device tokens from same-origin localStorage. A separate origin cannot
inherit QuantaPhi's token. Wallet access needs an explicit same-origin mount and API
routing (frontend supports /quant-ai/api paths, but the hosting Worker is not yet connected),
or a verified secure session bridge. The client now reads QuantaPhi's actual
starquest_ledger_device_v1:<account> credential family, rejects ambiguous accounts,
and loads owned Quants on startup. Folder assignment requires an ingested Packet v2.
Matching still has no frontend control and no authoritative spend.

## Remaining ledger and evidence work
This is not a deployed accountant or a five-Quant spend implementation.
The public `POST /api/search` is intentionally **disabled (409)** until the
authoritative five-Quant settlement and receipt bridge is built. The internal
matching helper is covered by unit tests but must not be used as a paid
transaction, because checking a balance and recording a use is not a debit. Mint existence is not proof of
current unit ownership after a fungible transfer. Packet ingest verifies mint provenance
and that the mint's wallet matches the authenticated wallet, and rejects duplicate or
dangling evidence. Folder assignment also checks that wallet and personal_organize
consent. Inventory evidence honors inventory_planning consent; matching candidate
aliases honor anonymous_matching, alias consent and expiry. Further recipient-specific
permission checks are still needed. Fungible transfers do not establish packet lineage.

The requested next capabilities are an idempotent authoritative spend/receipt
adapter for a selected five-Quant scan, evidence-backed recommendations, opt-in
aggregate inventory analysis across customers, and authorized merchant-page jobs.
A Pink Floyd purchase alone does not prove Steve Miller, Grand Funk or Janis Joplin
purchases; recommendations must distinguish observed interests from suggestions.

QuantaPhi's current Robot Brain writer excludes wallet/backend changes. A dedicated
implementation and acceptance adapter is required before it can execute these jobs.
Music/ambience remains unbuilt.

## Validation (2026-10-11)
- GitHub Actions `Quant-AI checks` passed for the latest Packet v2 branch changes:
  Node 22 syntax checks for client and Worker files, and `npm test`.
- Eight authenticated contract tests now cover Packet v2 import, duplicate events,
  duplicate folder additions, cross-wallet mint rejection, provenance and tags,
  folder purpose checks, inventory consent, and matching consent/expiry.
- No live wallet, AI call, Cloudflare deployment, authoritative debit, paid scan,
  or customer purchase claim was verified.

## Self-contained edge build
`npm run build:edge` generates `dist/worker.mjs`, a standalone Cloudflare
module with the current HTML/CSS/client JS embedded for same-origin delivery.
It uses the regular `DB`, `IDENTITY_DB`, and `QUANTA_DB` D1 bindings and needs no
public GitHub proxy or static asset service. Run `npm test` and
`node --check dist/worker.mjs` before deployment.

QuantaPhi PR #87 added a private `/quant-ai/` service-binding adapter and was
merged to QuantaPhi's main branch. That repository change alone does not mean
the production edge Worker has been deployed. Configure `QUANT_AI` as a
Cloudflare Worker service binding to `quant-ai` only after the Worker is live.
