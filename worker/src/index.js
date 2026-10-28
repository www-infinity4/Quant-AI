import { personalProfile, assistListing } from './personal.js';
import { shopPhiOwned, shopPhiPublic } from './shopphi.js';
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
 const path=url.pathname.startsWith('/quant-ai/api/')?url.pathname.slice('/quant-ai'.length):url.pathname;
 if(!path.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):json({error:'not_found'},404);
 if(!['POST','GET'].includes(request.method))return json({error:'method_not_allowed'},405);
 try{
  // Unlisted seller page and its attached images: public read is allowed only
  // for listings explicitly published by the authenticated owner.
  if(/^\/api\/shopphi\/(public|media)\//.test(path)&&request.method==='GET')
   return await shopPhiPublic(request,env,path);
  const sellerPhoto=path==='/api/shopphi/media'&&request.method==='POST';
  let body={};if(request.method==='POST'&&!sellerPhoto){try{body=await request.json()}catch{return json({error:'invalid_json'},400)}}
  const identity=await authenticate(env,request);
  if(path.startsWith('/api/shopphi/'))return await shopPhiOwned(request,env,identity,path,body);
  if(path==='/api/personal/profile')return json(await personalProfile(env.DB,identity,body,request.method==='POST'));
  if(path==='/api/seller/assist'&&request.method==='POST')return json(await assistListing(env,identity,body));
  if(path==='/api/chat'&&request.method==='POST')return json(await chat(env,body.message,identity));
  if(path==='/api/packets'&&request.method==='POST')return json(await ingestPacket(env.DB,env.QUANTA_DB,identity,body));
  // Matching is disabled at the public API until authoritative five-Quant settlement is integrated.
  if(path==='/api/search'&&request.method==='POST')return json({error:'authoritative_scan_settlement_not_configured'},409);
  if(path==='/api/quants/owned'&&request.method==='GET')return json(await ownedQuants(env.QUANTA_DB,identity));
  if(path==='/api/folders'&&request.method==='POST')return json(await createFolder(env.DB,identity,body),201);
  if(path==='/api/folders'&&request.method==='GET')return json(await listFolders(env.DB,identity));
  if(path==='/api/folders/add'&&request.method==='POST')return json(await addFolderQuant(env.DB,env.QUANTA_DB,identity,body.folder_id,body.quant_id));
  if(path==='/api/inventory/experiments'&&request.method==='POST')return json(await createInventoryExperiment(env.DB,identity,body),201);
  if(path==='/api/transfer')return json({error:'use_authoritative_quanta_transfer'},409);
  return json({error:'not_found'},404);
 }catch(e){if(e.status)return json({error:e.message},e.status);console.error('Quant-AI request failed',e);return json({error:'internal_error'},500)}
}
async function chat(env,message,identity){
 if(typeof message!=='string'||!message.trim()||message.length>2000)throw fail('invalid_message');
 if(env.ORACLE){
  const profile=await personalProfile(env.DB,identity,{});
  const input=SYSTEM_PROMPT+'\nOnly the following user-approved selling defaults are supplied as private context. No identity, wallet identifier or other user data is supplied: '+JSON.stringify(profile.defaults)+'\nUser message: '+message;
  const r=await env.ORACLE.fetch(new Request('https://infinity-rogers.marvaseater.workers.dev/v1/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://quantaphi.org'},body:JSON.stringify({input,context:{application:'Quant-AI',task:'private-personal-assistant',requireCloudflare:true}}),signal:AbortSignal.timeout(25000)}));
  const d=await r.json();if(!r.ok||d.ok===false)throw fail('personal_ai_unavailable',502);
  return {ok:true,reply:String(d.output_text||d.output||d.response||''),provider:'Oracle through Quant-AI',privacy:{identitySentToModel:false,chatgptHistoryConnected:false}};
 }
 if(!env.QUANTAPHI_AI_URL)return {reply:'AI routing is not configured yet.'};
 const res=await fetch(env.QUANTAPHI_AI_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({system:SYSTEM_PROMPT,message})});
 if(!res.ok)throw fail('ai_unavailable',502);const data=await res.json();return {reply:String(data.reply??data.response??'')};
}
export default {fetch:handle};
async function ownedQuants(quantaDb,identity){
 const {results}=await quantaDb.prepare(`SELECT j.quant_mint_id AS quant_id,j.query_text,j.created_at
 FROM quanta_search_journal j JOIN quant_mints m ON m.mint_id=j.quant_mint_id
 WHERE j.user_id=? AND m.wallet_id=? AND j.status='COMMITTED' AND j.quant_mint_id IS NOT NULL
 ORDER BY j.created_at DESC LIMIT 1000`).bind(identity.userId,identity.walletId).all();
 return {quants:(results||[]).map(x=>({quant_id:x.quant_id,query:String(x.query_text||''),created_at:x.created_at}))};
}
