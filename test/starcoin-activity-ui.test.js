import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Quant AI offers a readable authenticated wallet and Fred activity viewer',()=>{
 const page=source('public/index.html'),css=source('public/styles.css'),app=source('public/app.js');
 for(const id of ['starCoinActivity','starCoinRefresh','starCoinFred','starCoinStatus','starCoinWallet','starCoinEvents'])
  assert.ok(page.includes('id="'+id+'"'),id);
 assert.match(app,/api\('\/api\/starcoins\/activity'\+filter\)/);
 assert.match(css,/min-height:48px/);
 assert.match(page,/Opening an external X replay does not establish a verified listen/);
});
test('StarCoin receipt details are always text, not executable HTML',()=>{
 const app=source('public/app.js').split('/* Owner-scoped StarCoin receipts')[1];
 assert.ok(app);
 assert.match(app,/elem\.textContent/);
 assert.match(app,/replaceChildren\(\)/);
 assert.doesNotMatch(app,/innerHTML|eval\(|new Function|wallet\.id|account_id/);
});
test('backend relies on authenticated owner IDs and never a caller-selected recipient',()=>{
 const worker=source('worker/src/index.js'),activity=source('worker/src/starcoin-activity.js');
 assert.match(worker,/identity\.userId,url\.searchParams/);
 assert.match(activity,/WHERE id=\?/);
 assert.match(activity,/WHERE account_id=\?/);
 assert.doesNotMatch(activity,/UPDATE accounts|INSERT INTO ledger_events|DELETE FROM/);
});
