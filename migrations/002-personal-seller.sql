CREATE TABLE IF NOT EXISTS personal_seller_profiles (
 user_id TEXT PRIMARY KEY,
 defaults_json TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS personal_seller_aliases (
 user_id TEXT NOT NULL,
 scope TEXT NOT NULL,
 day TEXT NOT NULL,
 alias TEXT NOT NULL,
 PRIMARY KEY(user_id,scope,day)
);
