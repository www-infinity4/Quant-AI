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
 if(mint.wallet_id!==identity.walletId)throw fail('quant_not_owned',403);
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
 const mint=await authoritativeMint(quantaDb,quantId);
 if(mint.wallet_id!==identity.walletId)throw fail('quant_not_owned',403);
 const packet=await db.prepare('SELECT permissions_json,ingested_by_wallet FROM quant_packets WHERE quant_id=?').bind(quantId).first();
 if(!packet)throw fail('packet_not_ingested',409);
 if(packet.ingested_by_wallet!==identity.walletId)throw fail('packet_wallet_mismatch',403);
 let permissions={};try{permissions=JSON.parse(packet.permissions_json||'{}')}catch{}
 if(!Array.isArray(permissions.purposes)||!permissions.purposes.includes('anonymous_matching')||!permissions.merchant_alias_allowed|| (permissions.expires_at&&Date.parse(permissions.expires_at)<=Date.now()))throw fail('search_not_permitted',403);
 const balance=await quantaDb.prepare('SELECT balance FROM quant_wallet_balances WHERE wallet_id=?').bind(identity.walletId).first();
 if(Number(balance?.balance||0)<1)throw fail('quant_unavailable',403);
 try{await db.prepare('INSERT INTO quant_search_uses(quant_id,wallet_id,item_key) VALUES(?,?,?)').bind(quantId,identity.walletId,itemKey).run()}
 catch(e){if(/UNIQUE|constraint/i.test(String(e.message)))throw fail('quant_search_already_used',409);throw e}
 const {results}=await db.prepare(
  "SELECT p.quant_id,p.permissions_json,t.tag_key,t.confidence FROM quant_tags t JOIN quant_packets p ON p.quant_id=t.quant_id WHERE t.tag_key=? AND p.quant_id<>? ORDER BY t.confidence DESC LIMIT 100"
 ).bind(itemKey,quantId).all();
 const scope='match:'+identity.walletId+':'+itemKey+':'+new Date().toISOString().slice(0,10);
 const matches=[];for(const r of results||[]){
  let allowed={};try{allowed=JSON.parse(r.permissions_json||'{}')}catch{}
  if(!allowed.merchant_alias_allowed||!Array.isArray(allowed.purposes)||!allowed.purposes.includes('anonymous_matching')||(allowed.expires_at&&Date.parse(allowed.expires_at)<=Date.now()))continue;
  matches.push({alias:await rotatingAlias(scope,r.quant_id),signal:r.tag_key,confidence:Number(r.confidence)});
  if(matches.length===50)break;
 }
 return {item_key:itemKey,matches,privacy:{identity:'scoped_rotating_alias',rotation:'daily',stable_wallet_exposed:false}};
}

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const uid=p=>p+'_'+crypto.randomUUID();
export async function createFolder(db,identity,input={}){
 const name=clean(input.name);if(!name)throw fail('folder_name_required');
 const folder={folder_id:uid('qf'),wallet_id:identity.walletId,name,description:clean(input.description)};
 await db.prepare('INSERT INTO quant_folders(folder_id,wallet_id,name,description) VALUES(?,?,?,?)').bind(folder.folder_id,folder.wallet_id,folder.name,folder.description).run();
 return folder;
}
export async function listFolders(db,identity){
 const {results}=await db.prepare(`SELECT f.folder_id,f.name,f.description,f.created_at,f.updated_at,COUNT(i.quant_id) AS quant_count
 FROM quant_folders f LEFT JOIN quant_folder_items i ON i.folder_id=f.folder_id WHERE f.wallet_id=?
 GROUP BY f.folder_id ORDER BY f.updated_at DESC`).bind(identity.walletId).all();
 return {folders:results||[]};
}
export async function addFolderQuant(db,quantaDb,identity,folderId,quantId){
 const mint=await authoritativeMint(quantaDb,quantId);
 if(mint.wallet_id!==identity.walletId)throw fail('quant_not_owned',403);
 const folder=await db.prepare('SELECT folder_id FROM quant_folders WHERE folder_id=? AND wallet_id=?').bind(folderId,identity.walletId).first();
 if(!folder)throw fail('folder_not_found',404);
 const packet=await db.prepare('SELECT quant_id,ingested_by_wallet,permissions_json FROM quant_packets WHERE quant_id=?').bind(quantId).first();if(!packet)throw fail('packet_not_ingested',409);
 if(packet.ingested_by_wallet!==identity.walletId)throw fail('packet_wallet_mismatch',403);
 let permission={};try{permission=JSON.parse(packet.permissions_json||'{}')}catch{}
 if(!Array.isArray(permission.purposes)||!permission.purposes.includes('personal_organize')||(permission.expires_at&&Date.parse(permission.expires_at)<=Date.now()))throw fail('organize_not_permitted',403);
 try{await db.prepare('INSERT INTO quant_folder_items(folder_id,quant_id) VALUES(?,?)').bind(folderId,quantId).run()}catch(e){if(!/UNIQUE|constraint/i.test(String(e.message)))throw e}
 return {folder_id:folderId,quant_id:quantId};
}
export async function createInventoryExperiment(db,identity,input={}){
 const name=clean(input.name),item=clean(input.item_label),qty=Number(input.test_quantity),cost=Number(input.unit_cost_minor),price=Number(input.target_price_minor);
 if(!name||!item||!Number.isInteger(qty)||qty<1||qty>1000||!Number.isInteger(cost)||cost<0||!Number.isInteger(price)||price<0)throw fail('invalid_inventory_experiment');
 let evidence=[];
 if(input.folder_id){
  const folder=await db.prepare('SELECT folder_id FROM quant_folders WHERE folder_id=? AND wallet_id=?').bind(input.folder_id,identity.walletId).first();if(!folder)throw fail('folder_not_found',404);
  const {results}=await db.prepare(`SELECT i.quant_id,t.tag_key,t.label,t.confidence,p.permissions_json FROM quant_folder_items i
   JOIN quant_packets p ON p.quant_id=i.quant_id
   LEFT JOIN quant_tags t ON t.quant_id=i.quant_id
   WHERE i.folder_id=? AND p.ingested_by_wallet=? ORDER BY t.confidence DESC LIMIT 100`).bind(input.folder_id,identity.walletId).all();
  evidence=(results||[]).filter(x=>{
   if(!x.tag_key)return false;
   let permission={};try{permission=JSON.parse(x.permissions_json||'{}')}catch{}
   return Array.isArray(permission.purposes)&&permission.purposes.includes('inventory_planning')&&(!permission.expires_at||Date.parse(permission.expires_at)>Date.now());
  }).slice(0,50).map(x=>({quant_id:x.quant_id,tag:x.tag_key,label:x.label,confidence:Number(x.confidence||0)}));
 }
 const experiment_id=uid('inv');
 await db.prepare(`INSERT INTO inventory_experiments(experiment_id,wallet_id,folder_id,name,item_label,unit_cost_minor,target_price_minor,test_quantity,currency,evidence_json)
 VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(experiment_id,identity.walletId,input.folder_id||null,name,item,cost,price,qty,clean(input.currency)||'USD',JSON.stringify(evidence)).run();
 return {experiment_id,name,item_label:item,test_quantity:qty,unit_cost_minor:cost,target_price_minor:price,currency:clean(input.currency)||'USD',gross_margin_minor:(price-cost)*qty,evidence};
}

async function rotatingAlias(scope,subject){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope+'|'+subject));
 const token=Array.from(new Uint8Array(bytes).slice(0,9),b=>b.toString(16).padStart(2,'0')).join('');
 return 'qa_'+token;
}
