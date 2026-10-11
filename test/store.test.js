import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { handle } from '../worker/src/index.js';
import { searchWithQuant } from '../worker/src/store.js';

const TOKEN_A='sq_'+'a'.repeat(40), TOKEN_B='sq_'+'b'.repeat(40);
const digest=s=>createHash('sha256').update(s).digest('hex');
const HASH_A='a'.repeat(64), HASH_B='b'.repeat(64), HASH_C='c'.repeat(64);

function makeD1(ddl){
 const sql=new DatabaseSync(':memory:');
 sql.exec(ddl);
 return {sql,prepare(q){return {
  args:[],bind(...args){this.args=args;return this},
  async run(){const r=sql.prepare(q).run(...this.args);return {meta:{changes:Number(r.changes)}}},
  async all(){return {results:sql.prepare(q).all(...this.args)}},
  async first(){return sql.prepare(q).get(...this.args)||null}
 }},async batch(statements){
  sql.exec('BEGIN');
  try{for(const s of statements)await s.run();sql.exec('COMMIT')}
  catch(e){sql.exec('ROLLBACK');throw e}
 }};
}
function fixture(){
 const DB=makeD1(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const IDENTITY_DB=makeD1('CREATE TABLE accounts(id TEXT PRIMARY KEY); CREATE TABLE account_devices(account_id TEXT,token_hash TEXT)');
 const QUANTA_DB=makeD1('CREATE TABLE quant_wallets(user_id TEXT,wallet_id TEXT,status TEXT);CREATE TABLE quant_mints(mint_id TEXT PRIMARY KEY,wallet_id TEXT,provenance_hash TEXT);CREATE TABLE quant_wallet_balances(wallet_id TEXT,balance INTEGER);CREATE TABLE quanta_search_journal(user_id TEXT,status TEXT,quant_mint_id TEXT,query_text TEXT,created_at TEXT)');
 for(const [user,wallet,token] of [['user_a','wallet_a',TOKEN_A],['user_b','wallet_b',TOKEN_B]]){
  IDENTITY_DB.sql.prepare('INSERT INTO accounts VALUES(?)').run(user);
  IDENTITY_DB.sql.prepare('INSERT INTO account_devices VALUES(?,?)').run(user,digest(token));
  QUANTA_DB.sql.prepare('INSERT INTO quant_wallets VALUES(?,?,?)').run(user,wallet,'active');
  QUANTA_DB.sql.prepare('INSERT INTO quant_wallet_balances VALUES(?,?)').run(wallet,10);
 }
 function mint(id,wallet,hash,user='user_a'){
  QUANTA_DB.sql.prepare('INSERT INTO quant_mints VALUES(?,?,?)').run(id,wallet,hash);
  QUANTA_DB.sql.prepare('INSERT INTO quanta_search_journal VALUES(?,?,?,?,?)').run(user,'COMMITTED',id,'Pink Floyd',new Date().toISOString());
 }
 mint('q1','wallet_a',HASH_A);
 mint('q2','wallet_b',HASH_B,'user_b');
 mint('q3','wallet_a',HASH_C);
 return {DB,IDENTITY_DB,QUANTA_DB};
}
const send=(env,path,body,token=TOKEN_A,method='POST')=>handle(new Request('https://quantaphi.org'+path,{
 method,headers:{authorization:'Bearer '+token,...(method==='POST'?{'content-type':'application/json'}:{})},
 ...(method==='POST'?{body:JSON.stringify(body)}:{})
}),env);
const packet=(id,hash,overrides={})=>({
 version:2,quant_id:id,mint_id:id,provenance_hash:hash,
 events:[{event_id:'ev_'+id,kind:'search',subject:{type:'music',key:'pink_floyd',label:'Pink Floyd'},source:'search'}],
 tags:[{key:'pink_floyd',label:'Pink Floyd',confidence:0.95,evidence_event_ids:['ev_'+id]}],
 permissions:{purposes:['personal_organize','anonymous_matching'],merchant_alias_allowed:true,expires_at:'2099-01-01T00:00:00Z'},
 ...overrides
});
async function body(res){return res.json()}

test('authenticated Packet v2 import, folder assignment and duplicate-add idempotency',async()=>{
 const env=fixture();
 assert.equal((await send(env,'/quant-ai/api/packets',packet('q1',HASH_A))).status,200);
 assert.equal((await send(env,'/api/packets',packet('q1',HASH_A))).status,409);
 const result=await body(await send(env,'/api/folders',{name:'Rock Music',description:'Albums'}));
 const add={folder_id:result.folder_id,quant_id:'q1'};
 assert.equal((await send(env,'/api/folders/add',add)).status,200);
 assert.equal((await send(env,'/api/folders/add',add)).status,200);
 const listed=await body(await send(env,'/api/folders',null,TOKEN_A,'GET'));
 assert.equal(listed.folders[0].quant_count,1);
 const owned=await body(await send(env,'/api/quants/owned',null,TOKEN_A,'GET'));
 assert.ok(owned.quants.some(x=>x.quant_id==='q1'));
 assert.ok(owned.quants.every(x=>x.quant_id!=='q2'));
});

test('never ingest, use or folder-add another wallet mint',async()=>{
 const env=fixture();
 let res=await send(env,'/api/packets',packet('q1',HASH_A),TOKEN_B);
 assert.equal(res.status,403);assert.equal((await body(res)).error,'quant_not_owned');
 assert.equal((await send(env,'/api/packets',packet('q1',HASH_A))).status,200);
 const ownFolder=await body(await send(env,'/api/folders',{name:'Mine'},TOKEN_B));
 res=await send(env,'/api/folders/add',{folder_id:ownFolder.folder_id,quant_id:'q1'},TOKEN_B);
 assert.equal(res.status,403);
 res=await send(env,'/api/search',{quant_id:'q1',item_key:'pink_floyd'},TOKEN_B);
 assert.equal(res.status,409); // Public scans are disabled until ledger settlement exists.
 await assert.rejects(searchWithQuant(env.DB,env.QUANTA_DB,{walletId:'wallet_b',userId:'user_b'},'q1','pink_floyd'),{message:'quant_not_owned'});
});

test('rejects mismatched mint, missing/duplicate evidence and forged provenance',async()=>{
 const env=fixture();
 const examples=[
  packet('q1',HASH_A,{mint_id:'q3'}),
  packet('q1',HASH_A,{events:[],tags:[{key:'pink_floyd',confidence:0.8,evidence_event_ids:['never_happened']}]}),
  packet('q1',HASH_A,{events:[{event_id:'same',kind:'search',subject:{type:'music',key:'pink_floyd'}},{event_id:'same',kind:'share',subject:{type:'music',key:'pink_floyd'}}]}),
  packet('q1',HASH_A,{tags:[{key:'a',confidence:0.5,evidence_event_ids:['ev_q1']},{key:'a',confidence:0.5,evidence_event_ids:['ev_q1']}]})
 ];
 for(const p of examples){const r=await send(env,'/api/packets',p);assert.equal(r.status,400,JSON.stringify(await r.json()))}
 const forged=await send(env,'/api/packets',packet('q1',HASH_B));
 assert.equal(forged.status,409);
});

test('matches only consented, unexpired evidence, never exposing wallet IDs',async()=>{
 const env=fixture();
 const sealed=packet('q3',HASH_C,{permissions:{purposes:['personal_organize'],merchant_alias_allowed:false}});
 assert.equal((await send(env,'/api/packets',sealed)).status,200);
 assert.equal((await send(env,'/api/packets',packet('q1',HASH_A))).status,200);
 let res=await send(env,'/api/search',{quant_id:'q1',item_key:'pink_floyd'});
 assert.equal(res.status,409);
 assert.equal((await body(res)).error,'authoritative_scan_settlement_not_configured');
 let data=await searchWithQuant(env.DB,env.QUANTA_DB,{walletId:'wallet_a',userId:'user_a'},'q1','pink_floyd');
 assert.deepEqual(data.matches,[]);
 assert.equal(JSON.stringify(data).includes('wallet_a'),false);
 await assert.rejects(searchWithQuant(env.DB,env.QUANTA_DB,{walletId:'wallet_a',userId:'user_a'},'q1','pink_floyd'),{message:'quant_search_already_used'});
});
test('rejects expired matching consent and rejects legacy wallet headers',async()=>{
 const env=fixture();
 const expired=packet('q1',HASH_A,{permissions:{purposes:['anonymous_matching'],merchant_alias_allowed:true,expires_at:'2020-01-01T00:00:00Z'}});
 assert.equal((await send(env,'/api/packets',expired)).status,200);
 await assert.rejects(searchWithQuant(env.DB,env.QUANTA_DB,{walletId:'wallet_a',userId:'user_a'},'q1','pink_floyd'),{message:'search_not_permitted'});
 const legacy=await handle(new Request('https://quantaphi.org/api/folders',{method:'POST',headers:{'x-wallet-address':'wallet_a','content-type':'application/json'},body:'{"name":"No"}'}),env);
 assert.equal(legacy.status,401);
});
test('chat validates input with an authenticated device token',async()=>{
 const env=fixture();
 assert.equal((await send(env,'/api/chat',{message:''})).status,400);
 assert.equal((await send(env,'/api/chat',{message:'Hi'})).status,200);
});

test('inventory evidence includes only consented Packet signals',async()=>{
 const env=fixture();
 const planning=packet('q3',HASH_C,{permissions:{purposes:['personal_organize','inventory_planning'],merchant_alias_allowed:false}});
 assert.equal((await send(env,'/api/packets',packet('q1',HASH_A))).status,200);
 assert.equal((await send(env,'/api/packets',planning)).status,200);
 const folder=await body(await send(env,'/api/folders',{name:'Music inventory'}));
 for(const id of ['q1','q3'])assert.equal((await send(env,'/api/folders/add',{folder_id:folder.folder_id,quant_id:id})).status,200);
 const experiment=await send(env,'/api/inventory/experiments',{folder_id:folder.folder_id,name:'Six albums',item_label:'Album',test_quantity:6,unit_cost_minor:800,target_price_minor:1200,currency:'USD'});
 assert.equal(experiment.status,201);
 const result=await body(experiment);
 assert.equal(result.gross_margin_minor,2400);
 assert.equal(result.evidence.length,1);
 assert.equal(result.evidence[0].quant_id,'q3');
});
test('folder assignment rejects Packet not authorized for personal organization',async()=>{
 const env=fixture();
 const restricted=packet('q1',HASH_A,{permissions:{purposes:['aggregate_research'],merchant_alias_allowed:false}});
 assert.equal((await send(env,'/api/packets',restricted)).status,200);
 const folder=await body(await send(env,'/api/folders',{name:'Not allowed'}));
 const result=await send(env,'/api/folders/add',{folder_id:folder.folder_id,quant_id:'q1'});
 assert.equal(result.status,403);
 assert.equal((await body(result)).error,'organize_not_permitted');
});

test('chat rejects anonymous requests even before AI is configured',async()=>{
 const env=fixture();
 const r=await handle(new Request('https://quantaphi.org/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:'{"message":"Hi"}'}),env);
 assert.equal(r.status,401);
});
