import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {handle} from '../worker/src/index.js';
const TOKEN_A='sq_'+'a'.repeat(40), TOKEN_B='sq_'+'b'.repeat(40);
const digest=t=>createHash('sha256').update(t).digest('hex');
const now=1795010000000;
function wrap(sql){
 return {prepare(q){return {bind(...args){return {
  first:async()=>sql.prepare(q).get(...args)||null,
  all:async()=>({results:sql.prepare(q).all(...args)}),
  run:async()=>sql.prepare(q).run(...args)
 };}}}};
}
function fixture(){
 const idb=new DatabaseSync(':memory:'),qdb=new DatabaseSync(':memory:');
 idb.exec("CREATE TABLE accounts(id TEXT PRIMARY KEY,username TEXT,star_coins INTEGER,pending_share_credits INTEGER,share_count INTEGER);"+
 "CREATE TABLE account_devices(account_id TEXT,token_hash TEXT);"+
 "CREATE TABLE media_star_owner_config(card_key TEXT PRIMARY KEY,owner_account_id TEXT);"+
 "CREATE TABLE ledger_events(id TEXT PRIMARY KEY,account_id TEXT,event_type TEXT,amount INTEGER,balance INTEGER,progress_to_next_coin INTEGER,shares_per_coin INTEGER,reference_id TEXT,content_id TEXT,company_id TEXT,attribution_status TEXT,payout_status TEXT,created_at INTEGER);");
 qdb.exec("CREATE TABLE quant_wallets(user_id TEXT,wallet_id TEXT,status TEXT);");
 for(const [id,username,wallet,tok,stars,pending] of [['a','alice','wallet_a',TOKEN_A,11,3],['b','bob','wallet_b',TOKEN_B,19,0]]){
  idb.prepare('INSERT INTO accounts VALUES(?,?,?,?,?)').run(id,username,stars,pending,12);
  idb.prepare('INSERT INTO account_devices VALUES(?,?)').run(id,digest(tok));
  qdb.prepare('INSERT INTO quant_wallets VALUES(?,?,?)').run(id,wallet,'active');
 }
 idb.prepare("INSERT INTO media_star_owner_config VALUES('media-star','a')").run();
 const rows=[
 ['e1','a','share_credit',0,10,9,'fred-space:fred-0700','credited'],
 ['e2','a','share_reward',1,11,0,'fred-space:fred-0700','credited'],
 ['e3','a','BOT_WORK',1,12,0,'botwork_task_22','paid'],
 ['e4','b','share_credit',0,19,1,'fred-space:fred-0111','credited'],
 ['e5','a','spaces_episode_owner_preview',0,11,3,'fred-0700',null],
 ['e6','a','spaces_episode_unlock',-1,10,3,'fred-0112','paid']
 ];
 for(const [i,user,type,amount,balance,progress,content,status] of rows)idb.prepare('INSERT INTO ledger_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .run(i,user,type,amount,balance,progress,10,'ref_'+i,content,'quanta-phi','source_observed',status,now+rows.findIndex(x=>x[0]===i));
 return {IDENTITY_DB:wrap(idb),QUANTA_DB:wrap(qdb),idb,qdb};
}
const request=(tok=TOKEN_A,query='')=>new Request('https://quantaphi.org/quant-ai/api/starcoins/activity'+query,{headers:tok?{authorization:'Bearer '+tok}:{}});
test('verified wallet shows balance and origin for each immutable event, not a guessed payout',async()=>{
 const env=fixture(),res=await handle(request(),env);
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.ok,true);assert.equal(data.wallet.wholeStarCoins,11);
 assert.equal(data.wallet.pendingTenths,3);assert.equal(data.wallet.totalStarCoins,11.3);
 assert.equal(data.wallet.isMediaStarOwner,true);
 assert.equal(data.events.length,5);
 assert.equal(data.events.find(e=>e.eventType==='spaces_episode_owner_preview').deltaCoins,0);
 assert.ok(data.events.some(e=>e.contentKey==='fred-space:fred-0700'));
 assert.ok(data.events.every(e=>!JSON.stringify(e).includes('wallet_a')));
 assert.ok(!JSON.stringify(data).includes('account_id'));
});
test('Fred filter shows related activity only without cross-account leakage',async()=>{
 const res=await handle(request(TOKEN_A,'?source=fred'),fixture()),data=await res.json();
 assert.equal(res.status,200);
 assert.equal(data.filter,'fred');assert.equal(data.events.length,4);
 assert.ok(data.events.every(e=>e.contentKey.startsWith('fred-')));
 assert.ok(!JSON.stringify(data).includes('fred-0111'));
});
test('a different authenticated account cannot enumerate owner or private wallet',async()=>{
 const res=await handle(request(TOKEN_B),fixture()),data=await res.json();
 assert.equal(res.status,200);assert.equal(data.wallet.wholeStarCoins,19);assert.equal(data.wallet.isMediaStarOwner,false);
 assert.equal(data.events.length,1);assert.equal(data.events[0].eventId,'e4');
 assert.ok(!JSON.stringify(data).includes('botwork_task_22'));
});
test('unauthenticated activity is rejected without querying other customer data',async()=>{
 const res=await handle(request(''),fixture());
 assert.equal(res.status,401);assert.equal((await res.json()).error,'authorization_required');
});
test('activity endpoint is read-only and preserves source attribution/status',async()=>{
 const env=fixture(),before=env.idb.prepare('SELECT COUNT(*) AS n FROM ledger_events').get().n;
 const res=await handle(request(TOKEN_A,'?source=fred'),env),data=await res.json();
 assert.equal(res.status,200);assert.equal(env.idb.prepare('SELECT COUNT(*) AS n FROM ledger_events').get().n,before);
 assert.equal(data.events.find(e=>e.eventType==='share_credit').creditMeaning,'fractional_progress');
 assert.equal(data.events.find(e=>e.eventType==='share_reward').creditMeaning,'fraction_conversion');
 assert.equal(data.events.find(e=>e.eventType==='spaces_episode_unlock').deltaCoins,-1);
 assert.equal(data.events.find(e=>e.eventType==='spaces_episode_owner_preview').creditMeaning,'no_reward');
 assert.ok(data.events.every(e=>e.createdAt.endsWith('Z')));
});
