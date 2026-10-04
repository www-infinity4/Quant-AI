import { ingestPacket, transferQuant, searchWithQuant } from './store.js';

export const SYSTEM_PROMPT = `You are the Quant-AI assistant, a routing plug-in for QuantaPhi.
Explain how to use quants, read the packet shipped with each quant, and handle receipts.
Rules: each quant allows exactly one search; search results contain unified wallet addresses and
their shop/like signals only, never a user's history; quants can be spent between users, so a holder
may own quants they did not create. Never reveal or infer personal history.`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function handle(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : json({ error: 'not_found' }, 404);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  // Placeholder auth: wire this to the QuantaPhi wallet session before production.
  const wallet = request.headers.get('x-wallet-address');
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  try {
    switch (url.pathname) {
      case '/api/packets': return json(await ingestPacket(env.DB, wallet, body));
      case '/api/transfer': return json(await transferQuant(env.DB, wallet, body.to, body.quant_id));
      case '/api/search': return json(await searchWithQuant(env.DB, wallet, body.quant_id, body.item_key));
      case '/api/chat': return json(await chat(env, body.message));
      default: return json({ error: 'not_found' }, 404);
    }
  } catch (e) {
    if (e.status) return json({ error: e.message }, e.status);
    return json({ error: 'internal_error' }, 500);
  }
}

async function chat(env, message) {
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
    throw Object.assign(new Error('invalid_message'), { status: 400 });
  }
  if (!env.QUANTAPHI_AI_URL) return { reply: 'AI routing is not configured yet. Set QUANTAPHI_AI_URL.' };
  const res = await fetch(env.QUANTAPHI_AI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system: SYSTEM_PROMPT, message }),
  });
  if (!res.ok) throw Object.assign(new Error('ai_unavailable'), { status: 502 });
  const data = await res.json();
  return { reply: String(data.reply ?? data.response ?? '') };
}

export default { fetch: handle };
