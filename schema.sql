-- Quant-AI companion schema.
-- QuantaPhi remains authoritative for wallet identity, Quant minting, balances and transfers.
-- This database stores only packet-derived signals, receipts and one-use AI search entitlements.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS quant_packets(
  quant_id TEXT PRIMARY KEY,
  source_mint_id TEXT NOT NULL UNIQUE,
  provenance_hash TEXT NOT NULL UNIQUE,
  ingested_by_wallet TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quant_search_uses(
  quant_id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(quant_id) REFERENCES quant_packets(quant_id)
);

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
  FOREIGN KEY(quant_id) REFERENCES quant_packets(quant_id)
);

CREATE TRIGGER IF NOT EXISTS quant_packets_no_update BEFORE UPDATE ON quant_packets
BEGIN SELECT RAISE(ABORT,'immutable_quant_packet'); END;
CREATE TRIGGER IF NOT EXISTS quant_packets_no_delete BEFORE DELETE ON quant_packets
BEGIN SELECT RAISE(ABORT,'immutable_quant_packet'); END;
CREATE TRIGGER IF NOT EXISTS quant_search_uses_no_update BEFORE UPDATE ON quant_search_uses
BEGIN SELECT RAISE(ABORT,'immutable_quant_search_use'); END;
CREATE TRIGGER IF NOT EXISTS quant_search_uses_no_delete BEFORE DELETE ON quant_search_uses
BEGIN SELECT RAISE(ABORT,'immutable_quant_search_use'); END;
