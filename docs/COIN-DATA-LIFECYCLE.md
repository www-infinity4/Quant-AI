# Coin information attachment, removal and consent — proposed contract

**Status:** design proposal, not an implemented database migration, deployed API, exchange rate or authorization to amend balances.  
**Scope:** existing QuantaPhi/StarQuest StarCoin receipts, Infinity/Quant minting, Quant-AI Packet v2, NEC checkout and Media Star creator payments. Continue [QuantaPhi accounting issue #317](https://github.com/www-infinity4/QuantaPhi/issues/317) and Quant-AI PR #5. Preserve all existing coins and receipts.

## First principle: coins and their attached information are different things

An asset balance is not automatically an advertising profile, a research packet, a person's history or a royalty claim.

1. **Reward-only StarCoin** (`REWARD_ONLY`): ordinary share, collect, verified work, engagement or creator reward. Record **only a receipt**: action, issuer, amount or tenths, recipient's verified wallet, source card, time, idempotency key, and settlement state. `quant_packet_id = NULL`. A reference to Fred's episode proves the referenced action was recorded, **not that an X replay was heard** or Fred was paid.
2. **Plain Quant** (`QUANT_PLAIN`): uniquely minted Quant if its authorized mint/serial model supports it, with proof and owner but **no optional interest/research packet**.
3. **Enriched Quant** (`QUANT_ENRICHED`): existing Quant with an **optional linked, versioned Packet v2** containing validated events, evidence-backed tags and purpose-specific permissions. The packet is not a whole new coin and never implies a second mint.
4. **Special-purpose Music/Creator/Offer assets**: maintain their independent asset codes and ledgers. Optional permissioned metadata is **not automatically spendable StarCoins** or a creator payout.

For fractional/fungible StarCoins, attach an immutable source label to the **earning event**, not to an imagined physical individual coin. Attaching data to a specific Quant requires a unique asset identifier and ownership verification. Never pretend a fungible balance proves which particular unit retained a history.

### Layer separation

| Layer | Always required? | Owner and visibility | Mutability |
| --- | --- | --- | --- |
| Accounting receipt: asset, amount, source, verified recipient, timestamp, state, idempotency | Yes, for any credited/debited event | Authenticated involved wallet and compliance/audit roles | Append-only correction/reversal |
| Minimal provenance: mint/issue ID, source system, issuer, hash of verifiable evidence | Yes, for any mint with provenance claims | Owner; limited public proof if appropriate | Signed/immutable source, appended correction |
| Optional private evidence: search, collected content, research notes, consented events, images, AI descriptions | No | User/rights owner; encrypted and separated from transfer records | Versioned, redactable/deletable according to rights/retention |
| Derived tags/aggregates: categories, rankings, matching signals, confidence and evidence IDs | No | Permissioned roles only, no permanent commercial identifier | Recompute, supersede, retract or expire |
| Published/permitted metadata snapshot: limited catalog description, rights-approved media, selected claims | No | Only viewers explicitly covered by license/consent | Versioned; access revocable and cached views expire |

## Everything the owner can GIVE to a coin (opt-in only)

- **Nothing**: leave a reward coin or ordinary Quant empty apart from its accounting receipt.
- **Source label**: card/episode/store/project/title, URL and event ID; no claim of playback or other user's identity.
- **Provenance**: verified mint, source repository/commit, issue, invoice, attribution, signed issuing system or receipt hash.
- **Private notes**: owner-written description, collections/folders, work order, draft, topic, priority, task outcome or reason for earning.
- **Permitted research**: sourced searches, dated citations, clips with licensed rights, fact checks, observed interactions.
- **AI-derived descriptions**: proposed categories, meaning or similarities with model/version, source evidence IDs, confidence and an explicit 'derived, not observed' label.
- **Market-use tags**: opt-in anonymous matching, inventory planning, merchant category, demand signals and offers with audience/scope/expiry.
- **Creative attachments**: image/audio metadata or license and creator credit, not an unauthorized copied recording or someone else's private content.
- **Access and rights**: public/private/unlisted scope, allowed purposes, recipient categories, expiry, revocable consent and copyright terms.
- **Links to other coins**: parent/child, project set, purchase bundle, work milestone, payment/royalty reference; link does not merge ownership.
- **Time-limited claims**: offer validity, event time, observed position or research date; timestamped claims do not demonstrate future knowledge.
- **Reader-friendly presentation**: nickname, icon, visual theme, explanation of the earning action, source card preview; presentation is not a mint.

## Everything the owner can TAKE OFF, STOP or CORRECT

- **Never attach** optional information in the first place. User may switch a coin to reward-only view before enrichment.
- **Detach** one or all packet links from the coin without burning, reducing or changing the coin balance.
- **Hide from public**: unpublish a selected label, photo, annotation, category or manifest link without changing the private receipt.
- **Revoke** consent for merchant matching, analytics, social display, AI processing, notifications, or sharing with a selected recipient.
- **Expire** links automatically at their time limit; stop serving cached derived snapshots beyond their expiry.
- **Edit** user-authored text or fix wrong tags through a new version with a supersession pointer, without rewriting a signed issuance receipt.
- **Challenge** inaccurate AI classification or source evidence: mark 'disputed', suppress it from matching and queue evidence review.
- **Redact/remove** personal evidence or user-uploaded content from data stores where permitted or legally required. Keep only the smallest audit evidence required, not a permanent personal profile disguised as a checksum.
- **Recompute** insights when permission, data quality, or source validity changes; derived audiences must never persist using revoked observations.
- **Quarantine** unsafe, illegally copied or counterfeit metadata while preserving the asset ledger and an appropriately minimal dispute receipt.
- **Unlink** a bad association to an unrelated person, card, post, event, wallet or other asset; create an auditable correction.
- **Stop collection** on future clicks. Revoking collection is different from reversing old payments.
- **Transfer stripped**: the default for Quant transfer is the serial and minimal ownership/provenance proof only. The recipient does not receive the creator's search/purchase/identity history.
- **Transfer selected snapshot**: only explicitly consented, appropriately licensed, version-pinned metadata; consent does not automatically transfer forward to later owners.
- **Burn/freeze/refund** assets ONLY through separate signed policy and balanced accounting entries, not as a side effect of hiding metadata.
- **Erase a private draft** that never became a receipt; do not present erasure of an immutable financial audit row as a deletion that occurred when it didn't.

## Canonical attach/detach API concept — NOT LIVE

A new **metadata link** references the existing minted asset, so an enrichment never mints again:

`coin_metadata_links(link_id, asset_code, asset_serial_or_event_id, packet_id, packet_version, manifest_hash, status, allowed_purposes, consent_receipt_id, creator_rights_id, created_at, expires_at, superseded_by, version)`

`coin_metadata_decisions(decision_id, link_id, authenticated_actor, action, reason_code, prior_version, resulting_version, created_at, evidence_hash)`

`status`: `NONE | PRIVATE | SCOPED | PUBLIC | REVOKED | EXPIRED | DISPUTED | REMOVED`. No raw personal identifiers in the public link record.

Candidate commands (owner-scoped and audited):

- `GET /v1/wallet/coin-receipts` — own verified earning/debit records and explanations; read-only.
- `POST /v1/quants/:serial/metadata/attach` — verified ownership + consent + evidence/license checks; creates link version.
- `POST /v1/quants/:serial/metadata/revise` — versioned correction/replacement; never overwrite mint receipt.
- `POST /v1/quants/:serial/metadata/revoke` — immediately deny future use and invalidate matching/cache tokens.
- `POST /v1/quants/:serial/metadata/detach` — remove optional link while keeping owner, balance and minimal receipt.
- `POST /v1/quants/:serial/metadata/share-preview` — preview allowed public snapshot before authorization.
- `GET /v1/quants/:serial/manifest` — only a rights-filtered public proof, never unredacted activity.

Every write must validate authenticated ownership, source provenance, origin/rights, purpose consent, expected version and idempotency; the ledger and packet storage need separate authorization. The **owner of a coin**, **owner of the data**, **original creator**, **issuer**, and **reward beneficiary** may all differ. Coin ownership does **not** confer data-access rights.

## Example: ten Apple posts / Fred Space

**Apple posts**: Red collects candidate URLs; Yellow verifies authors/date/rights; Orange's four-lens Delta review selects 1 or several with explicit reasons; Blue imports only approved source records; Green builds. The resulting research packet is attached to the chosen Quant only after owner consent. The unused posts stay out; retracted tags are marked inactive.

**Fred's Spaces**: Sharing a verified Fred card may generate a `+0.1` reward receipt in the viewer's account. It is a plain reward with `quant_packet_id=NULL`. Ten tenths converting into one whole coin is not an extra independent earning. The record can say 'shared Fred link', but cannot say 'listened', 'viewer paid Fred', or 'creator royalty' without separate verified playback/payment evidence. A creator royalty needs a recipient-verified, paired debit/credit receipt.

## Invariants to test before merge or deployment

1. Mint reward-only: amount and receipt exist, `packet_id=NULL`, no automatic profile.
2. Attach private research to a **different** authorized Quant: no new mint, no balance change.
3. Attach to another wallet's coin: denied. Attach data owned by another creator without rights: denied.
4. Duplicate attach, duplicate share, network retry, race: exactly one version/event and no duplicate coins.
5. Revoke: existing coin remains, matching returns nothing and cached permission expires; no new collection.
6. Transfer: buyer receives no creator identity/history; specific approved snapshot only with separate consent.
7. Revision: old signed receipt remains; new version/tombstone corrects visible metadata.
8. Expired, disputed or unlicensed tags cannot be advertised; no stale profile generated.
9. Source card click vs real paid event vs audio actually played remain distinct evidentiary types.
10. Fraction to whole conversion counted **once**; reward receipt cannot mutate Quant amount or invent a second coin.
11. Owner can inspect and export a plain reward receipt independent of Quant packet services.
12. Purge/rights-withdrawal test deletes allowed private payloads and prevents rehydration from caches/backups, retaining only required minimal audit.
13. Wallet transfer, burn or refund is independently gated and double-entry, never triggered by 'Detach info'.

## Migration path (preserve existing ledgers)

1. Inventory current StarQuest `ledger_events`, Infinity `quant_mints`, Quant-AI `quant_packets`/`quant_events`/`quant_tags`, and NEC proposed `quants(serial)` mapping without assuming all old fungible credits have distinct serials.
2. Add a read-only **attachment manifest and completeness audit** that classifies `REWARD_ONLY`, `QUANT_PLAIN`, and `QUANT_ENRICHED` from authoritative existing records.
3. Add versioned link/consent records alongside immutable Packet v2, backed by migrations; do not disable existing immutable triggers or rewrite provenance hashes.
4. Add owner UI: **Info: None / Private / Shared**, **Add**, **Edit**, **Detach**, **Revoke**, **Why did I earn this?**, **View original receipt**, **What will transfer?**
5. Apply tests on real but isolated fixture data, exact-head CI, independent privacy review, guarded merge, actual Worker deploy and signed-in Android readback. No automatic backfill of private data, transfers, purchases or paid third-party AI.

**Policy decision:** optional data is opt-in by asset and purpose; reward-only is the default. No identity or cross-site history rides along with a coin by accident.
