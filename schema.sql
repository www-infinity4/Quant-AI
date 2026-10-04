-- Quant-AI companion data: provenance, minimized events, derived tags and permissions.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS quant_packets(
 quant_id TEXT PRIMARY KEY,source_mint_id TEXT NOT NULL UNIQUE,provenance_hash TEXT NOT NULL UNIQUE,
 ingested_by_wallet TEXT NOT NULL,packet_version INTEGER NOT NULL DEFAULT 2,permissions_json TEXT NOT NULL DEFAULT '{}',
 ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS quant_events(
 event_id TEXT PRIMARY KEY,quant_id TEXT NOT NULL,kind TEXT NOT NULL,subject_type TEXT NOT NULL,subject_key TEXT NOT NULL,
 subject_label TEXT,occurred_at TEXT,quantity REAL,amount_minor INTEGER,currency TEXT,source TEXT,
 FOREIGN KEY(quant_id) REFERENCES quant_packets(quant_id));
CREATE INDEX IF NOT EXISTS idx_quant_events_subject ON quant_events(subject_type,subject_key,kind);
CREATE TABLE IF NOT EXISTS quant_tags(
 quant_id TEXT NOT NULL,tag_key TEXT NOT NULL,label TEXT,confidence REAL NOT NULL,evidence_json TEXT NOT NULL,
 PRIMARY KEY(quant_id,tag_key),FOREIGN KEY(quant_id) REFERENCES quant_packets(quant_id));
CREATE INDEX IF NOT EXISTS idx_quant_tags_key ON quant_tags(tag_key);
CREATE TABLE IF NOT EXISTS quant_search_uses(
 quant_id TEXT PRIMARY KEY,wallet_id TEXT NOT NULL,item_key TEXT NOT NULL,used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(quant_id) REFERENCES quant_packets(quant_id));
CREATE TABLE IF NOT EXISTS receipts(
 receipt_id TEXT PRIMARY KEY,quant_id TEXT NOT NULL,wallet TEXT NOT NULL,item_key TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(quant_id) REFERENCES quant_packets(quant_id));
CREATE TRIGGER IF NOT EXISTS quant_packets_no_update BEFORE UPDATE ON quant_packets BEGIN SELECT RAISE(ABORT,'immutable_quant_packet'); END;
CREATE TRIGGER IF NOT EXISTS quant_packets_no_delete BEFORE DELETE ON quant_packets BEGIN SELECT RAISE(ABORT,'immutable_quant_packet'); END;
CREATE TRIGGER IF NOT EXISTS quant_events_no_update BEFORE UPDATE ON quant_events BEGIN SELECT RAISE(ABORT,'immutable_quant_event'); END;
CREATE TRIGGER IF NOT EXISTS quant_events_no_delete BEFORE DELETE ON quant_events BEGIN SELECT RAISE(ABORT,'immutable_quant_event'); END;
CREATE TRIGGER IF NOT EXISTS quant_search_uses_no_update BEFORE UPDATE ON quant_search_uses BEGIN SELECT RAISE(ABORT,'immutable_quant_search_use'); END;
CREATE TRIGGER IF NOT EXISTS quant_search_uses_no_delete BEFORE DELETE ON quant_search_uses BEGIN SELECT RAISE(ABORT,'immutable_quant_search_use'); END;

CREATE TABLE IF NOT EXISTS quant_folders(
 folder_id TEXT PRIMARY KEY,wallet_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_quant_folders_wallet ON quant_folders(wallet_id,updated_at);
CREATE TABLE IF NOT EXISTS quant_folder_items(
 folder_id TEXT NOT NULL,quant_id TEXT NOT NULL,added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(folder_id,quant_id),FOREIGN KEY(folder_id) REFERENCES quant_folders(folder_id),FOREIGN KEY(quant_id) REFERENCES quant_packets(quant_id));
CREATE TABLE IF NOT EXISTS inventory_experiments(
 experiment_id TEXT PRIMARY KEY,wallet_id TEXT NOT NULL,folder_id TEXT,name TEXT NOT NULL,item_label TEXT NOT NULL,
 unit_cost_minor INTEGER NOT NULL CHECK(unit_cost_minor>=0),target_price_minor INTEGER NOT NULL CHECK(target_price_minor>=0),
 test_quantity INTEGER NOT NULL CHECK(test_quantity>0 AND test_quantity<=1000),currency TEXT NOT NULL DEFAULT 'USD',
 evidence_json TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT 'planned',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(folder_id) REFERENCES quant_folders(folder_id));
