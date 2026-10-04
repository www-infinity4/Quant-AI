import { ingestPacket, searchWithQuant, createFolder, listFolders, addFolderQuant, createInventoryExperiment } from './store.js';

export const SYSTEM_PROMPT=`You are Quant-AI, the usefulness assistant for QuantaPhi Quant owners.
Help a common user turn their own permitted Quant signals into organization, research, inventory experiments and anonymous market matching.
Always separate observed facts from derived tags. Explain the evidence behind a recommendation and uncertainty.
Never infer or expose a person's name, exact identity, sensitive traits, private history, or stable private wallet ID.
Merchant-facing identity must be a scoped rotating alias, not the private unified-wallet identifier.
A Quant signal is evidence for a decision, never a guarantee that a person will buy.
QuantaPhi's authenticated ledger is authoritative for identity, minting, balances, provenance and transfers.
Ordinary Quant transfers are currently fungible; never claim a specific packet moved with a transfer unless authoritative unit lineage proves it.
Useful examples include organizing related music signals into a Rock Music folder, testing a small dealer inventory, comparing demand themes, and explaining receipts/provenance.`;

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const fail=(code,status=400)=>Object.assign(new Error(code),{status});
async function authenticate(env,request){
 const authorization=request.headers.get('Authorization')||'',match=/^Bearer\s+(sq_[A-Za-z0-9_-]{32,})$/.exec(authorization);
 if(!match)throw fail('authorization_required',401);
 if(!env.IDENTITY_DB)throw fail('identity_not_configured',503);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(match[1]));
 const tokenHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const identity=await env.IDENTITY_DB.prepare('SELECT a.id AS user_id FROM accounts a JOIN account_devices d ON d.account_id=a.id WHERE d.token_hash=?').bind(tokenHash).first();
 if(!identity)throw fail('invalid_device_token',401);
 if(!env.QUANTA_DB)throw fail('quanta_ledger_not_configured',503);
 const wallet=await env.QUANTA_DB.prepare("SELECT wallet_id,status FROM quant_wallets WHERE user_id=?").bind(identity.user_id).first();
 if(!wallet)throw fail('quant_wallet_not_found',404); if(wallet.status!=='active')throw fail('wallet_disabled',403);
 return {userId:identity.user_id,walletId:wallet.wallet_id};
}
export async function handle(request,env){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):json({error:'not_found'},404);
 if(!['POST','GET'].includes(request.method))return json({error:'method_not_allowed'},405);
 let body={};if(request.method==='POST'){try{body=await request.json()}catch{return json({error:'invalid_json'},400)}}
 try{
  if(url.pathname==='/api/chat'&&request.method==='POST')return json(await chat(env,body.message));
  const identity=await authenticate(env,request);
  if(url.pathname==='/api/packets')return json(await ingestPacket(env.DB,env.QUANTA_DB,identity,body));
  if(url.pathname==='/api/search')return json(await searchWithQuant(env.DB,env.QUANTA_DB,identity,body.quant_id,body.item_key));
  if(url.pathname==='/api/folders'&&request.method==='POST')return json(await createFolder(env.DB,identity,body),201);
  if(url.pathname==='/api/folders'&&request.method==='GET')return json(await listFolders(env.DB,identity));
  if(url.pathname==='/api/folders/add'&&request.method==='POST')return json(await addFolderQuant(env.DB,env.QUANTA_DB,identity,body.folder_id,body.quant_id));
  if(url.pathname==='/api/inventory/experiments'&&request.method==='POST')return json(await createInventoryExperiment(env.DB,identity,body),201);
  if(url.pathname==='/api/transfer')return json({error:'use_authoritative_quanta_transfer'},409);
  return json({error:'not_found'},404);
 }catch(e){if(e.status)return json({error:e.message},e.status);console.error('Quant-AI request failed',e);return json({error:'internal_error'},500)}
}
async function chat(env,message){
 if(typeof message!=='string'||!message.trim()||message.length>2000)throw fail('invalid_message');
 if(!env.QUANTAPHI_AI_URL)return {reply:'AI routing is not configured yet.'};
 const res=await fetch(env.QUANTAPHI_AI_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({system:SYSTEM_PROMPT,message})});
 if(!res.ok)throw fail('ai_unavailable',502);const data=await res.json();return {reply:String(data.reply??data.response??'')};
}
export default {fetch:handle};