/* Authenticated StarQuest activity reader for Quant AI. No mints, wallet mutation,
 * creator-income assumptions, other-user lookup or private token disclosure. */
const src=s=>typeof s==='string'?s.slice(0,200):'';
const typeLabel=(kind,content)=>{
 const text=(content||'').toLowerCase();
 if(text.includes('fred')||kind.startsWith('spaces_episode_'))return "Fred's Spaces";
 if(kind==='BOT_WORK'||text.startsWith('botwork_'))return 'Bubbles completed work';
 if(kind==='shoplc_click_reward'||text.includes('shoplc'))return 'ShopLC click incentive';
 if(text.startsWith('infinite-book:'))return 'Infinite Book';
 if(text.startsWith('quick-card|'))return 'Quick Card';
 if(text.includes('news-phi'))return 'News Phi';
 if(text.includes('bitcoin-crusher'))return 'Bitcoin Crusher';
 if(kind==='legacy_balance_recovery')return 'Legacy balance recovery';
 return 'QuantaPhi action';
};
export function presentStarCoinReceipt(row){
 const kind=src(row?.event_type),delta=Number(row?.amount)||0,content=src(row?.content_id);
 const creditMeaning=kind==='share_reward'?'fraction_conversion'
  :kind==='spaces_episode_owner_preview'?'no_reward'
  :kind.endsWith('_credit')?'fractional_progress'
  :delta>0?'whole_coin_reward'
  :delta<0?'spent':'no_reward';
 const millis=Number(row?.created_at);
 return {
  eventId:src(row?.id),eventType:kind,sourceLabel:typeLabel(kind,content),
  contentKey:content,referenceId:src(row?.reference_id),
  deltaCoins:delta,progressTenths:Number(row?.progress_to_next_coin)||0,
  wholeBalanceAfter:Number(row?.balance)||0,creditMeaning,
  attributionStatus:src(row?.attribution_status)||'unknown',
  payoutStatus:src(row?.payout_status)||'unverified',
  createdAt:Number.isFinite(millis)&&millis>0?new Date(millis).toISOString():null
 };
}
export async function starCoinActivity(identityDb,userId,source='all'){
 if(source!=='all'&&source!=='fred')throw Object.assign(new Error('invalid_activity_filter'),{status:400});
 const account=await identityDb.prepare(
  'SELECT username,star_coins,pending_share_credits,share_count FROM accounts WHERE id=?'
 ).bind(userId).first();
 if(!account)throw Object.assign(new Error('wallet_not_found'),{status:404});
 const owner=await identityDb.prepare(
  "SELECT 1 AS is_owner FROM media_star_owner_config WHERE card_key='media-star' AND owner_account_id=? LIMIT 1"
 ).bind(userId).first();
 const condition=source==='fred'?
  " AND (lower(COALESCE(content_id,'')) LIKE '%fred%' OR event_type LIKE 'spaces_episode_%')":'';
 const {results=[]}=await identityDb.prepare(
  'SELECT id,event_type,amount,balance,progress_to_next_coin,reference_id,content_id,attribution_status,payout_status,created_at FROM ledger_events WHERE account_id=?'+condition+' ORDER BY created_at DESC,id DESC LIMIT 201'
 ).bind(userId).all();
 const whole=Math.max(0,Number(account.star_coins)||0);
 const pending=Math.max(0,Math.min(9,Number(account.pending_share_credits)||0));
 return {
  ok:true,source:'starquest-ledger',filter:source,visibility:'authenticated-wallet-only',
  wallet:{username:src(account.username),wholeStarCoins:whole,pendingTenths:pending,totalStarCoins:Math.round((whole+pending/10)*10)/10,
   shareCount:Math.max(0,Number(account.share_count)||0),isMediaStarOwner:!!owner},
  events:results.slice(0,200).map(presentStarCoinReceipt),hasMore:results.length>200,
  disclaimer:'This is a receipt history, not proof an external X replay played, a third-party user listened, or a separate creator wallet was paid.'
 };
}
