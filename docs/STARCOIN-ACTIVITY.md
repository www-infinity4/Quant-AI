# Quant AI — StarCoin earning receipts (QuantaPhi issue #317)

## Purpose
Authenticated, read-only account receipts at GET /api/starcoins/activity with optional ?source=fred. The account is derived from an authorized device token; neither a wallet ID nor a username selector is accepted.

## Interpreting receipts
- Accounts.star_coins is the whole-coin balance and accounts.pending_share_credits is fractional progress 0–9 tenths. Do not confuse event count with whole-coin earnings.
- Share/collect/star/etc credit rows usually record +0.1 fractional progress; share_reward is the conversion of ten such credits to one whole coin and should not be double-counted.
- Owner previews cost zero; episode unlocks can be -1; BOT_WORK and ShopLC incentive rewards are separate origins.
- A Fred link or share event does NOT verify external X audio playback or a creator royalty.
- The isMediaStarOwner flag reports whether this authenticated account matches the configured recipient, without revealing another account's identity.

## Data contract and privacy
Private Quant AI UI -> existing signed device-token authentication -> owner-scoped StarQuest accounts, ledger_events and media_star_owner_config reads. Source filter is a fixed allowlisted query. UI renders returned text using textContent; not arbitrary HTML. Events capped at 200 with hasMore indicator.

## Release and limitations
No database mutations, minting, refunds, paid API, alternate wallet lookup or direct external X listening proof. Exact-head CI, independent review, owner-identity reconciliation, signed-in Android browser test and deployed Worker readback are separate gates. Related QuantaPhi issue #317 and TV-Database issue #110.
