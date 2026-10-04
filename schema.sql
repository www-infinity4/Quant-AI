-- Quant-AI D1 schema. Stores packet-derived signals keyed by unified wallet
-- address only; no per-user history is ever exposed through the API.
CREATE TABLE IF NOT EXISTS quants(
  quant_id TEXT PRIMARY KEY,
  holder_wallet TEXT NOT NULL,
  search_used INTEGER NOT NULL DEFAULT 0 CHECK(search_used IN (0,1)),
  ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quant_transfers(
  transfer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  quant_id TEXT NOT NULL,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(quant_id) REFERENCES quants(quant_id)
);

-- Wallet-level signals: "this wallet shops / likes this item".
CREATE TABLE IF NOT EXISTS wallet_signals(
  wallet TEXT NOT NULL,
  item_key TEXT NOT NULL,
  signal TEXT NOT NULL CHECK(signal IN ('shop','like')),
  PRIMARY KEY(wallet,item_key,signal)
);
CREATE INDEX IF NOT EXISTS idx_wallet_signals_item ON wallet_signals(item_key,signal);

CREATE TABLE IF NOT EXISTS receipts(
  receipt_id TEXT PRIMARY KEY,
  quant_id TEXT NOT NULL,
  wallet TEXT NOT NULL,
  item_key TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(quant_id) REFERENCES quants(quant_id)
);
