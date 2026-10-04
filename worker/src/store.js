import { parsePacket, validWallet } from './packet.js';

const fail = (code, status = 400) => Object.assign(new Error(code), { status });

async function authoritativeMint(quantaDb, identity, quantId) {
  const mint=await quantaDb.prepare(
    'SELECT m.mint_id,m.wallet_id,m.provenance_hash FROM quant_mints m WHERE m.mint_id=?'
  ).bind(quantId).first();
  if(!mint) throw fail('quant_not_found',404);
  return mint;
}

export async function ingestPacket(db, quantaDb, identity, packet) {
  if (!validWallet(identity.walletId)) throw fail('invalid_wallet');
  let p; try { p=parsePacket(packet); } catch(e){ throw fail(e.message); }
  const mint=await authoritativeMint(quantaDb,identity,p.quant_id);
  const stmts=[db.prepare(
    'INSERT INTO quant_packets(quant_id,source_mint_id,provenance_hash,ingested_by_wallet) VALUES(?,?,?,?)'
  ).bind(p.quant_id,mint.mint_id,mint.provenance_hash,identity.walletId)];
  for(const s of p.signals) stmts.push(db.prepare(
    'INSERT OR IGNORE INTO wallet_signals(wallet,item_key,signal) VALUES(?,?,?)'
  ).bind(identity.walletId,s.item_key,s.signal));
  if(p.receipt) stmts.push(db.prepare(
    'INSERT INTO receipts(receipt_id,quant_id,wallet,item_key,amount) VALUES(?,?,?,?,?)'
  ).bind(p.receipt.receipt_id,p.quant_id,identity.walletId,p.receipt.item_key,p.receipt.amount));
  try{await db.batch(stmts)}catch(e){
    if(/UNIQUE|constraint/i.test(String(e.message))) throw fail('quant_already_ingested',409);
    throw e;
  }
  return {quant_id:p.quant_id,search_available:true};
}

export async function searchWithQuant(db, quantaDb, identity, quantId, itemKey) {
  if(!validWallet(identity.walletId)||!validWallet(itemKey)) throw fail('invalid_request');
  const mint=await authoritativeMint(quantaDb,identity,quantId);
  // The real QuantaPhi ledger determines current spendability. Quant-AI never mutates balances.
  const balance=await quantaDb.prepare('SELECT balance FROM quant_wallet_balances WHERE wallet_id=?').bind(identity.walletId).first();
  if(Number(balance?.balance||0)<1) throw fail('quant_unavailable',403);
  const packet=await db.prepare('SELECT quant_id FROM quant_packets WHERE quant_id=?').bind(mint.mint_id).first();
  if(!packet) throw fail('packet_not_ingested',409);
  try{
    await db.prepare('INSERT INTO quant_search_uses(quant_id,wallet_id,item_key) VALUES(?,?,?)')
      .bind(quantId,identity.walletId,itemKey).run();
  }catch(e){
    if(/UNIQUE|constraint/i.test(String(e.message))) throw fail('quant_search_already_used',409);
    throw e;
  }
  const {results}=await db.prepare(
    'SELECT wallet,signal FROM wallet_signals WHERE item_key=? AND wallet<>? ORDER BY wallet LIMIT 50'
  ).bind(itemKey,identity.walletId).all();
  const byWallet={};
  for(const r of results)(byWallet[r.wallet]||=[]).push(r.signal);
  return {item_key:itemKey,wallets:Object.entries(byWallet).map(([wallet,signals])=>({wallet,signals}))};
}
