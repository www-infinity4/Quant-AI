# Quant-AI

Quant usefulness assistant for QuantaPhi buyers and sellers. Work is on PR #1;
main does not yet contain the Worker.

## Implemented on the PR branch
- Packet v2 parser: observed events, provenance, derived tags with evidence IDs and confidence, and purpose permissions.
- Protected data routes authenticate a Bearer sq_ device token against IDENTITY_DB and resolve an active wallet in QUANTA_DB. The old x-wallet-address assumption is removed.
- Authoritative mint lookup, packet ingest, single-use matching records, and scoped daily aliases.
- Owned search-Quant lookup, folders, and saved inventory experiments; frontend controls exist for folders, inventory and Packet v2 JSON upload/paste.
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
routing (frontend supports /quant-ai/api paths, but the hosting Worker is not yet connected),
or a verified secure session bridge. The client now reads QuantaPhi's actual
starquest_ledger_device_v1:<account> credential family, rejects ambiguous accounts,
and loads owned Quants on startup. Folder assignment requires an ingested Packet v2.
Matching still has no frontend control and no authoritative spend.

## Remaining ledger and evidence work
This is not a deployed accountant or a five-Quant spend implementation.
Matching checks a positive balance and records a unique search use; it does not
debit the authoritative ledger or settle a receipt. Mint existence is not proof of
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
