/* Authenticated owner inventory and unlisted public ShopPhi item cards.
 * Distinct from approved carousel ads. No paid checkout or implied verification.
 * All write actions rely on Quant-AI's existing verified wallet-device identity.
 */
const fail=(error,status=400)=>Object.assign(Error(error),{status});
const ok=(x,status=200)=>Response.json({ok:true,...x},{status,headers:{'cache-control':'no-store','X-Content-Type-Options':'nosniff'}});
const id=x=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x||'');
const categories=new Set(['Coins & paper money','Collectibles','Clothing & shoes','Electronics','Home & garden','Music & media','Other']);
const conditions=new Set(['New','Open box','Used','For parts / not working']);
const shippingOptions=new Set(['Shipping offered','Local pickup','Digital delivery','Discuss with buyer']);
const banned=/\b(?:firearms?|rifles?|shotguns?|handguns?|ammunition|explosives?|grenades?|tasers?|switchblades?|cocaine|heroin|methamphetamine|fentanyl|lsd|counterfeit|fake designer|stolen goods?|forged certificates?|prescription drugs?|tobacco|cigarettes?|vapes?|nicotine|sex dolls?|pornography|social security numbers?|passports?)\b/i;
const contact=/(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)|(?:\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b)/i;
const cap=(x,n)=>typeof x==='string'?x.trim().slice(0,n):'';
function safeUrl(raw){
 if(!raw)return '';
 try{const u=new URL(String(raw));const h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.href.length>1500||!h.includes('.')||h.endsWith('.local')||
   /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(h))return '';
  return u.href;
 }catch{return ''}
}
export function normalizeListing(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw fail('invalid_listing');
 const title=cap(body.title,130),description=cap(body.description,650);
 if(title.length<3)throw fail('item_title_required');
 if(typeof body.title!=='string'||body.title.length>130||typeof body.description!=='string'||body.description.length>650)throw fail('listing_text_too_long');
 if(banned.test(title+' '+description))throw fail('restricted_item_not_supported',403);
 if(contact.test(title+' '+description))throw fail('contact_details_not_permitted_in_public_listing');
 const category=cap(body.category,80)||'Other',condition=cap(body.condition,80)||'Used',
  shipping=cap(body.shipping,80)||'Discuss with buyer';
 if(!categories.has(category)||!conditions.has(condition)||!shippingOptions.has(shipping))throw fail('invalid_item_specifics');
 const qty=Number(body.quantity??1);if(!Number.isInteger(qty)||qty<1||qty>9999)throw fail('invalid_quantity');
 const price=String(body.priceLabel||'').trim();
 if(!/^\$?(?:\d{1,7})(?:\.\d{1,2})?$/.test(price))throw fail('price_required_in_usd');
 const priceCents=Math.round(Number(price.replace('$',''))*100);
 if(!Number.isSafeInteger(priceCents)||priceCents<0||priceCents>999999999)throw fail('invalid_price');
 const sourceUrl=body.url?safeUrl(body.url):'',imageUrl=body.imageUrl?safeUrl(body.imageUrl):'';
 if((body.url&&!sourceUrl)||(body.imageUrl&&!imageUrl))throw fail('https_source_required');
 const photoIds=Array.isArray(body.photoIds)?body.photoIds:[];
 if(photoIds.length>8||photoIds.some(x=>!id(x))||new Set(photoIds).size!==photoIds.length)throw fail('invalid_photo_ids');
 const listingId=body.itemId||crypto.randomUUID();
 if(!id(listingId))throw fail('invalid_item_id');
 return {listingId,title,description,category,condition,shipping,quantity:qty,priceCents,sourceUrl,imageUrl,photoIds};
}
const publicURL=listingId=>'https://quantaphi.org/shopphi-item.html?id='+encodeURIComponent(listingId);
function toPublic(row,media=[]){
 return {listingId:row.listing_id,title:row.title,description:row.description,category:row.category,
  condition:row.item_condition,shipping:row.shipping,quantity:row.quantity,
  priceLabel:'$'+(row.price_cents/100).toFixed(2),merchant:row.public_alias,
  sourceUrl:row.source_url,imageUrl:media.length?'/quant-ai/api/shopphi/media/'+media[0].media_id:row.image_url,
  photoUrls:media.map(x=>'/quant-ai/api/shopphi/media/'+x.media_id),
  status:row.state,verification:'seller-attested-unverified',
  listedAt:row.created_at,link:publicURL(row.listing_id),sponsored:false,
  disclosure:'Independent seller listing. Not an approved paid ad, certified coin, verified merchant, payment processor, or guaranteed checkout.'};
}
async function readOwned(db,owner,listingId){
 const row=await db.prepare('SELECT * FROM shopphi_listings WHERE listing_id=? AND owner_user_id=?')
  .bind(listingId,owner).first();
 if(!row)throw fail('listing_not_found',404);return row;
}
async function mediaFor(db,listingId){
 const r=await db.prepare('SELECT media_id,mime_type FROM shopphi_media WHERE listing_id=? ORDER BY created_at LIMIT 8').bind(listingId).all();
 return r.results||[];
}
export async function shopPhiOwned(request,env,identity,path,body={}){
 const db=env.DB;if(!db)throw fail('seller_database_unavailable',503);
 const own=identity.userId;
 if(path==='/api/shopphi/listings'&&request.method==='GET'){
  const rows=await db.prepare('SELECT * FROM shopphi_listings WHERE owner_user_id=? AND state!=? ORDER BY updated_at DESC LIMIT 100')
   .bind(own,'removed').all();
  return ok({listings:await Promise.all((rows.results||[]).map(async r=>toPublic(r,await mediaFor(db,r.listing_id))))});
 }
 if(path==='/api/shopphi/listings'&&request.method==='POST'){
  const x=normalizeListing(body),now=Date.now();
  const existing=await db.prepare('SELECT owner_user_id,state FROM shopphi_listings WHERE listing_id=?').bind(x.listingId).first();
  if(existing&&existing.owner_user_id!==own)throw fail('item_id_not_available',409);
  if(existing&&existing.state==='published')throw fail('published_listing_cannot_be_overwritten',409);
  const profile=await db.prepare("SELECT alias FROM personal_seller_aliases WHERE user_id=? AND scope='shop-phi' ORDER BY day DESC LIMIT 1").bind(own).first();
  const alias=profile?.alias||('Seller-'+crypto.randomUUID().slice(0,8));
  // Media receipts must already belong to this authenticated owner.
  for(const photoId of x.photoIds){const m=await db.prepare('SELECT listing_id FROM shopphi_media WHERE media_id=? AND owner_user_id=?').bind(photoId,own).first();
   if(!m||(m.listing_id&&m.listing_id!==x.listingId))throw fail('seller_photo_not_owned',403);}
  await db.prepare(\`INSERT INTO shopphi_listings(listing_id,owner_user_id,public_alias,title,description,category,item_condition,shipping,quantity,price_cents,source_url,image_url,created_at,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(listing_id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,
  item_condition=excluded.item_condition,shipping=excluded.shipping,quantity=excluded.quantity,price_cents=excluded.price_cents,
  source_url=excluded.source_url,image_url=excluded.image_url,updated_at=excluded.updated_at\`)
   .bind(x.listingId,own,alias,x.title,x.description,x.category,x.condition,x.shipping,x.quantity,x.priceCents,x.sourceUrl,x.imageUrl,now,now).run();
  for(const mediaId of x.photoIds)await db.prepare('UPDATE shopphi_media SET listing_id=? WHERE media_id=? AND owner_user_id=? AND (listing_id IS NULL OR listing_id=?)')
   .bind(x.listingId,mediaId,own,x.listingId).run();
  const row=await readOwned(db,own,x.listingId);
  return ok({listing:toPublic(row,await mediaFor(db,x.listingId)),saved:'private-draft',published:false},201);
 }
 const publish=path.match(/^\/api\/shopphi\/listings\/([0-9a-f-]{36})\/publish$/i);
 if(publish&&request.method==='POST'){
  if(body.ownItem!==true||body.publishConsent!==true)throw fail('seller_attestation_required',403);
  const row=await readOwned(db,own,publish[1]);
  if(row.state==='removed')throw fail('listing_removed',409);
  if(row.state==='published')return ok({listing:toPublic(row,await mediaFor(db,row.listing_id)),published:true,visibility:'unlisted'});
  if(!row.title||!row.price_cents&&row.price_cents!==0)throw fail('incomplete_listing',409);
  await db.prepare("UPDATE shopphi_listings SET state='published',updated_at=? WHERE listing_id=? AND owner_user_id=?")
   .bind(Date.now(),row.listing_id,own).run();
  const current=await readOwned(db,own,row.listing_id);
  return ok({listing:toPublic(current,await mediaFor(db,row.listing_id)),published:true,visibility:'unlisted',feedApproved:false});
 }
 const remove=path.match(/^\/api\/shopphi\/listings\/([0-9a-f-]{36})\/remove$/i);
 if(remove&&request.method==='POST'){
  await readOwned(db,own,remove[1]);
  await db.prepare("UPDATE shopphi_listings SET state='removed',updated_at=? WHERE listing_id=? AND owner_user_id=?").bind(Date.now(),remove[1],own).run();
  return ok({removed:true,listingId:remove[1]});
 }
 if(path==='/api/shopphi/media'&&request.method==='POST'){
  if(!env.SELLER_MEDIA)throw fail('seller_media_storage_unavailable',503);
  const mime=request.headers.get('content-type')||'';
  if(mime!=='image/webp')throw fail('reencoded_webp_photo_required',415);
  const size=Number(request.headers.get('content-length')||0);
  if(size>4500000)throw fail('photo_too_large',413);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(bytes.length<64||bytes.length>4500000)throw fail('photo_size_invalid',413);
  const magic=new TextDecoder().decode(bytes.slice(0,4)),webp=new TextDecoder().decode(bytes.slice(8,12));
  if(magic!=='RIFF'||webp!=='WEBP')throw fail('invalid_webp_file',415);
  // Canvas-generated WebP has EXIF/GPS metadata stripped. Reject metadata
  // chunks in hand-crafted WebP uploads, including EXIF/XMP.
  const mark=new TextDecoder('latin1').decode(bytes.slice(12,Math.min(bytes.length,4096)));
  if(/EXIF|XMP /i.test(mark))throw fail('image_metadata_not_permitted',415);
  const digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const mediaId=crypto.randomUUID(),key='shopphi/'+mediaId+'.webp';
  await env.SELLER_MEDIA.put(key,bytes,{httpMetadata:{contentType:'image/webp'},customMetadata:{sha256:hash}});
  try{await db.prepare('INSERT INTO shopphi_media(media_id,owner_user_id,object_key,mime_type,image_bytes,content_hash,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(mediaId,own,key,'image/webp',bytes.length,hash,Date.now()).run();}
  catch(e){await env.SELLER_MEDIA.delete(key);throw e}
  return ok({mediaId,size:bytes.length,private:true},201);
 }
 throw fail('unknown_seller_endpoint',404);
}
export async function shopPhiPublic(request,env,path){
 if(request.method!=='GET')throw fail('method_not_allowed',405);
 if(!env.DB)throw fail('seller_database_unavailable',503);
 const listing=path.match(/^\/api\/shopphi\/public\/([0-9a-f-]{36})$/i);
 if(listing){
  const row=await env.DB.prepare("SELECT * FROM shopphi_listings WHERE listing_id=? AND state='published'").bind(listing[1]).first();
  if(!row)throw fail('listing_not_found',404);
  return ok({listing:toPublic(row,await mediaFor(env.DB,row.listing_id)),visibility:'unlisted',feedApproved:false});
 }
 const photo=path.match(/^\/api\/shopphi\/media\/([0-9a-f-]{36})$/i);
 if(photo){
  const row=await env.DB.prepare("SELECT m.object_key FROM shopphi_media m JOIN shopphi_listings l ON l.listing_id=m.listing_id WHERE m.media_id=? AND l.state='published'").bind(photo[1]).first();
  if(!row)throw fail('photo_not_public',404);
  if(!env.SELLER_MEDIA)throw fail('seller_media_storage_unavailable',503);
  const object=await env.SELLER_MEDIA.get(row.object_key);
  if(!object)throw fail('photo_missing',404);
  return new Response(object.body,{headers:{'content-type':'image/webp','cache-control':'public,max-age=300','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"}});
 }
 throw fail('not_found',404);
}
