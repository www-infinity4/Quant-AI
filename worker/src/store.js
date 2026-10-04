import { parsePacket, validWallet } from './packet.js';

const fail = (code, status = 400) => Object.assign(new Error(code), { status });

export async function ingestPacket(db, wallet, packet) {
  if (!validWallet(wallet)) throw fail('invalid_wallet');
  let p;
  try { p = parsePacket(packet); } catch (e) { throw fail(e.message); }
  const stmts = [db.prepare('INSERT INTO quants(quant_id,holder_wallet) VALUES(?,?)').bind(p.quant_id, wallet)];
  for (const s of p.signals) {
    stmts.push(db.prepare('INSERT OR IGNORE INTO wallet_signals(wallet,item_key,signal) VALUES(?,?,?)').bind(wallet, s.item_key, s.signal));
  }
  if (p.receipt) {
    stmts.push(db.prepare('INSERT INTO receipts(receipt_id,quant_id,wallet,item_key,amount) VALUES(?,?,?,?,?)')
      .bind(p.receipt.receipt_id, p.quant_id, wallet, p.receipt.item_key, p.receipt.amount));
  }
  try { await db.batch(stmts); } catch (e) {
    if (/UNIQUE|constraint/i.test(String(e.message))) throw fail('quant_already_ingested', 409);
    throw e;
  }
  return { quant_id: p.quant_id, search_available: true };
}

export async function transferQuant(db, from, to, quantId) {
  if (!validWallet(from) || !validWallet(to) || from === to) throw fail('invalid_wallet');
  const r = await db.prepare('UPDATE quants SET holder_wallet=? WHERE quant_id=? AND holder_wallet=?').bind(to, quantId, from).run();
  if (!r.meta.changes) throw fail('quant_not_held', 403);
  await db.prepare('INSERT INTO quant_transfers(quant_id,from_wallet,to_wallet) VALUES(?,?,?)').bind(quantId, from, to).run();
  return { quant_id: quantId, holder: to };
}

// One search per quant. Returns wallet addresses only — never a user's history.
export async function searchWithQuant(db, wallet, quantId, itemKey) {
  if (!validWallet(wallet) || !validWallet(itemKey)) throw fail('invalid_request');
  const spent = await db.prepare('UPDATE quants SET search_used=1 WHERE quant_id=? AND holder_wallet=? AND search_used=0').bind(quantId, wallet).run();
  if (!spent.meta.changes) throw fail('quant_unavailable', 403);
  const { results } = await db.prepare(
    'SELECT wallet,signal FROM wallet_signals WHERE item_key=? AND wallet<>? ORDER BY wallet LIMIT 50'
  ).bind(itemKey, wallet).all();
  const byWallet = {};
  for (const r of results) (byWallet[r.wallet] ||= []).push(r.signal);
  return { item_key: itemKey, wallets: Object.entries(byWallet).map(([w, signals]) => ({ wallet: w, signals })) };
}
