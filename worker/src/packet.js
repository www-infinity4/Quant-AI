// Quant packet (v1) — scaffold of the packet shipped with each quant.
// { version:1, quant_id, items:[{item_key,signal:'shop'|'like'}], receipt?:{receipt_id,item_key,amount} }
const ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const SIGNALS = ['shop', 'like'];

export function validWallet(w) {
  return typeof w === 'string' && ID.test(w);
}

export function parsePacket(p) {
  if (!p || typeof p !== 'object' || p.version !== 1) throw new Error('unsupported_packet');
  if (typeof p.quant_id !== 'string' || !ID.test(p.quant_id)) throw new Error('invalid_quant_id');
  const items = Array.isArray(p.items) ? p.items : [];
  if (items.length > 100) throw new Error('too_many_items');
  const signals = items.map((i) => {
    if (!i || !ID.test(i.item_key || '') || !SIGNALS.includes(i.signal)) throw new Error('invalid_item');
    return { item_key: i.item_key, signal: i.signal };
  });
  let receipt = null;
  if (p.receipt) {
    const r = p.receipt;
    if (!ID.test(r.receipt_id || '') || !ID.test(r.item_key || '') || !Number.isInteger(r.amount) || r.amount <= 0) {
      throw new Error('invalid_receipt');
    }
    receipt = { receipt_id: r.receipt_id, item_key: r.item_key, amount: r.amount };
  }
  return { quant_id: p.quant_id, signals, receipt };
}
