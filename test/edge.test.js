import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

execFileSync(process.execPath,['scripts/build-edge.mjs'],{stdio:'pipe'});
const {default:worker}=await import('../dist/worker.mjs');
const root='https://quantaphi.org';
const input=(path)=>new Request(root+path);

test('standalone Worker serves index and assets with correct MIME and no-store',async()=>{
 for(const [path,type,source] of [
  ['/', 'text/html', 'public/index.html'],
  ['/index.html', 'text/html', 'public/index.html'],
  ['/app.js', 'javascript', 'public/app.js'],
  ['/styles.css','text/css','public/styles.css']
 ]){
  const res=await worker.fetch(input(path),{});
  assert.equal(res.status,200,path);
  assert.match(res.headers.get('content-type'),new RegExp(type));
  assert.equal(res.headers.get('cache-control'),'no-store');
  assert.equal(await res.text(),readFileSync(source,'utf8'));
 }
});
test('standalone Worker does not serve credential contents or guessed assets',async()=>{
 const res=await worker.fetch(input('/wallet-token.json'),{});
 assert.equal(res.status,404);
 const r=await worker.fetch(new Request(root+'/api/folders',{method:'GET'}),{});
 assert.equal(r.status,401);
 assert.deepEqual(await r.json(),{error:'authorization_required'});
});
test('HEAD has same content type and no body',async()=>{
 const res=await worker.fetch(new Request(root+'/styles.css',{method:'HEAD'}),{});
 assert.equal(res.status,200);
 assert.match(res.headers.get('content-type'),/text\/css/);
 assert.equal(await res.text(),'');
});
