import { parsePacket, validWallet } from './packet.js';
const fail=(code,status=400)=>Object.assign(new Error(code),{status});

async function authoritativeMint(quantaDb,quantId){
 const mint=await quantaDb.prepare('SELECT mint_id,wallet_id,provenance_hash FROM quant_mints WHERE mint_id=?').bind(quantId).first();
 if(!mint)throw fail('quant_not_found',404);
 return mint;
}

export async function ingestPacket(db,quantaDb,identity,packet){
 if(!validWallet(identity.walletId))throw fail('invalid_wallet');
 let p;try{p=parsePacket(packet)}catch(e){throw fail(e.message)}
 const mint=await authoritativeMint(quantaDb,p.mint_id);
 if(mint.mint_id!==p.quant_id||mint.provenance_hash.toLowerCase()!==p.provenance_hash)throw fail('provenance_mismatch',409);
 const stmts=[db.prepare(
  'INSERT INTO quant_packets(quant_id,source_mint_id,provenance_hash,ingested_by_wallet,packet_version,permissions_json) VALUES(?,?,?,?,2,?)'
 ).bind(p.quant_id,p.mint_id,p.provenance_hash,identity.walletId,JSON.stringify(p.permissions))];
 for(const e of p.events)stmts.push(db.prepare(
  'INSERT INTO quant_events(event_id,quant_id,kind,subject_type,subject_key,subject_label,occurred_at,quantity,amount_minor,currency,source) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
 ).bind(e.event_id,p.quant_id,e.kind,e.subject.type,e.subject.key,e.subject.label,e.occurred_at,e.quantity,e.amount_minor,e.currency,e.source));
 for(const t of p.tags)stmts.push(db.prepare(
  'INSERT INTO quant_tags(quant_id,tag_key,label,confidence,evidence_json) VALUES(?,?,?,?,?)'
 ).bind(p.quant_id,t.key,t.label,t.confidence,JSON.stringify(t.evidence_event_ids)));
 try{await db.batch(stmts)}catch(e){if(/UNIQUE|constraint/i.test(String(e.message)))throw fail('quant_already_ingested',409);throw e}
 return {quant_id:p.quant_id,events:p.events.length,tags:p.tags.length,permissions:p.permissions,search_available:p.permissions.purposes.includes('anonymous_matching')};
}

export async function searchWithQuant(db,quantaDb,identity,quantId,itemKey){
 if(!validWallet(identity.walletId)||!validWallet(itemKey))throw fail('invalid_request');
 await authoritativeMint(quantaDb,quantId);
 const packet=await db.prepare('SELECT permissions_json FROM quant_packets WHERE quant_id=?').bind(quantId).first();
 if(!packet)throw fail('packet_not_ingested',409);
 let permissions={};try{permissions=JSON.parse(packet.permissions_json||'{}')}catch{}
 if(!Array.isArray(permissions.purposes)||!permissions.purposes.includes('anonymous_matching'))throw fail('search_not_permitted',403);
 const balance=await quantaDb.prepare('SELECT balance FROM quant_wallet_balances WHERE wallet_id=?').bind(identity.walletId).first();
 if(Number(balance?.balance||0)<1)throw fail('quant_unavailable',403);
 try{await db.prepare('INSERT INTO quant_search_uses(quant_id,wallet_id,item_key) VALUES(?,?,?)').bind(quantId,identity.walletId,itemKey).run()}
 catch(e){if(/UNIQUE|constraint/i.test(String(e.message)))throw fail('quant_search_already_used',409);throw e}
 const {results}=await db.prepare(
  "SELECT p.quant_id,t.tag_key,t.confidence FROM quant_tags t JOIN quant_packets p ON p.quant_id=t.quant_id WHERE t.tag_key=? AND p.quant_id<>? ORDER BY t.confidence DESC LIMIT 50"
 ).bind(itemKey,quantId).all();
 return {item_key:itemKey,matches:(results||[]).map(r=>({quant_id:r.quant_id,signal:r.tag_key,confidence:Number(r.confidence)}))};
}
