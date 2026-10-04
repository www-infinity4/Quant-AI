# Quant-AI

AI chat bot & knowledge center about your quants, for buyers and sellers. It is an AI routing assistant /
plug-in for [QuantaPhi](https://github.com/www-infinity4/QuantaPhi): it lets any AI handle receipts and the
quant data packet shipped with each quant.

## Rules the scaffold enforces
- **One search per quant** (`quants.search_used`); more quants brought in means more searches.
- Search returns **unified wallet addresses + shop/like signals for an item only** — never a user's history.
- Quants are **transferable** between wallets; the current holder may use the search, regardless of who created it.
- Packet ingest is idempotent per `quant_id` (a quant can be ingested once).

## Layout
- `schema.sql` – D1 database (`quants`, `quant_transfers`, `wallet_signals`, `receipts`).
- `worker/src` – Cloudflare Worker: `POST /api/packets`, `/api/transfer`, `/api/search`, `/api/chat`
  (forwards to the existing QuantaPhi GPT-routed worker via `QUANTAPHI_AI_URL`).
- `public/` – static UI using QuantaPhi's light theme (`#f7f4fb`, `system-ui`, purple `#5f259f`, 20px cards).

## Assumptions / TODO
- The packet format (`version:1`, `quant_id`, `items[{item_key,signal}]`, optional `receipt`) is a placeholder; align with the real QuantaPhi packet.
- Wallet identity comes from the `x-wallet-address` header as a placeholder; wire to QuantaPhi wallet auth before production.
- Music/ambience is not built yet.

## Develop
`npm test` (Node 22+). Deploy: `wrangler d1 execute quant-ai --file schema.sql` then `wrangler deploy`.
