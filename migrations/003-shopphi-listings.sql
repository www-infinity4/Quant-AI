-- Seller-owned ShopPhi product listings. Owner ID never sent to public views.
-- Public status means shareable unlisted page, NOT approval for recommendation carousel.
CREATE TABLE IF NOT EXISTS shopphi_listings (
 listing_id TEXT PRIMARY KEY,
 owner_user_id TEXT NOT NULL,
 public_alias TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'Other',
 item_condition TEXT NOT NULL DEFAULT 'Used',
 shipping TEXT NOT NULL DEFAULT 'Discuss with buyer',
 quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 9999),
 price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 0 AND 999999999),
 source_url TEXT NOT NULL DEFAULT '',
 image_url TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','removed')),
 review_state TEXT NOT NULL DEFAULT 'unreviewed',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shopphi_owner ON shopphi_listings(owner_user_id,updated_at);
CREATE INDEX IF NOT EXISTS idx_shopphi_public ON shopphi_listings(state,updated_at);
CREATE TABLE IF NOT EXISTS shopphi_media (
 media_id TEXT PRIMARY KEY,
 owner_user_id TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 listing_id TEXT,
 mime_type TEXT NOT NULL DEFAULT 'image/webp',
 image_bytes INTEGER NOT NULL,
 content_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(listing_id) REFERENCES shopphi_listings(listing_id)
);
CREATE INDEX IF NOT EXISTS idx_shopphi_media_listing ON shopphi_media(listing_id,created_at);
