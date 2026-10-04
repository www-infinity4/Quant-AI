import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle } from '../worker/src/index.js';

function makeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const prep = (q) => ({
    q, args: [],
    bind(...a) { this.args = a; return this; },
    async run() { const r = sql.prepare(q).run(...this.args); return { meta: { changes: Number(r.changes) } }; },
    async all() { return { results: sql.prepare(q).all(...this.args) }; },
  });
  return { prepare: prep, async batch(s) { sql.exec('BEGIN'); try { for (const x of s) await x.run(); sql.exec('COMMIT'); } catch (e) { sql.exec('ROLLBACK'); throw e; } } };
}

const call = (env, path, wallet, body) => handle(new Request('http://x' + path, {
  method: 'POST', headers: { 'x-wallet-address': wallet }, body: JSON.stringify(body) }), env);
const packet = (id, items) => ({ version: 1, quant_id: id, items });

test('one search per quant, wallet-only results, transferable', async () => {
  const env = { DB: makeD1() };
  assert.equal((await call(env, '/api/packets', 'w_a', packet('q1', [{ item_key: 'lamp', signal: 'like' }]))).status, 200);
  assert.equal((await call(env, '/api/packets', 'w_a', packet('q1', []))).status, 409);
  await call(env, '/api/packets', 'w_b', packet('q2', []));
  const r = await call(env, '/api/search', 'w_b', { quant_id: 'q2', item_key: 'lamp' });
  assert.deepEqual(await r.json(), { item_key: 'lamp', wallets: [{ wallet: 'w_a', signals: ['like'] }] });
  assert.equal((await call(env, '/api/search', 'w_b', { quant_id: 'q2', item_key: 'lamp' })).status, 403);
  assert.equal((await call(env, '/api/search', 'w_b', { quant_id: 'q1', item_key: 'lamp' })).status, 403);
  assert.equal((await call(env, '/api/transfer', 'w_a', { quant_id: 'q1', to: 'w_b' })).status, 200);
  assert.equal((await call(env, '/api/search', 'w_b', { quant_id: 'q1', item_key: 'lamp' })).status, 200);
});

test('rejects invalid packets and chat input', async () => {
  const env = { DB: makeD1() };
  assert.equal((await call(env, '/api/packets', 'w_a', { version: 2 })).status, 400);
  assert.equal((await call(env, '/api/chat', 'w_a', { message: '' })).status, 400);
  assert.equal((await call(env, '/api/chat', 'w_a', { message: 'hi' })).status, 200);
});
