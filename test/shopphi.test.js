import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {normalizeListing,shopPhiOwned,shopPhiPublic} from '../worker/src/shopphi.js';

function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../migrations/002-personal-seller.sql',import.meta.url),'utf8'));
 sql.exec(readFileSync(new URL('../migrations/003-shopphi-listings.sql',import.meta.url),'utf8'));
 const db={prepare:q=>({bind(...args){return{
  first:async()=>sql.prepare(q).get(...args),
  all:async()=>({results:sql.prepare(q).all(...args)}),
  run:async()=>sql.prepare(q).run(...args)
 }}})};
 const objects=new Map();
 const media={put:async(key,value)=>objects.set(key,value),get:async(key)=>objects.has(key)?{body:objects.get(key)}:null,delete:async key=>objects.delete(key)};
 const env={DB:db,SELLER_MEDIA:media};
 const owner={userId:'account-1'},other={userId:'account-2'};
 return {env,owner,other,objects};
}
const root='https://quantaphi.org';
const req=(path,method='GET',body)=>new Request(root+'/quant-ai'+path,{
 method,headers:{'content-type':method==='POST'?'application/json':'text/plain'},
 ...body?{body:JSON.stringify(body)}:{}
});
const item=(id=crypto.randomUUID())=>({
 itemId:id,title:'My own antique radio',description:'I own this vintage radio. Sold as used.',
 priceLabel:'$80.00',category:'Electronics',condition:'Used',shipping:'Shipping offered',
 quantity:1,url:'',imageUrl:'',photoIds:[]
});
test('own goods need no existing eBay or seller product URL and remain private until consent',async()=>{
 const {env,owner,other}=setup(),listing=item();
 const r=await shopPhiOwned(req('/api/shopphi/listings','POST',listing),env,owner,'/api/shopphi/listings',listing);
 assert.equal(r.status,201);
 const saved=await r.json();assert.equal(saved.saved,'private-draft');assert.equal(saved.published,false);
 assert.equal(saved.listing.sourceUrl,'');
 await assert.rejects(shopPhiPublic(req('/api/shopphi/public/'+listing.itemId),env,'/api/shopphi/public/'+listing.itemId),/listing_not_found/);
 await assert.rejects(shopPhiOwned(req('/api/shopphi/listings/'+listing.itemId+'/publish','POST',{}),env,owner,'/api/shopphi/listings/'+listing.itemId+'/publish',{}),/seller_attestation_required/);
 const result=await shopPhiOwned(req('/api/shopphi/listings/'+listing.itemId+'/publish','POST',{ownItem:true,publishConsent:true}),env,owner,'/api/shopphi/listings/'+listing.itemId+'/publish',{ownItem:true,publishConsent:true});
 const published=await result.json();
 assert.equal(published.published,true);assert.equal(published.visibility,'unlisted');assert.equal(published.feedApproved,false);
 const p=await shopPhiPublic(req('/api/shopphi/public/'+listing.itemId),env,'/api/shopphi/public/'+listing.itemId);
 const publicResult=await p.json();assert.equal(publicResult.listing.title,listing.title);
 assert.ok(!JSON.stringify(publicResult).includes(owner.userId));
 const otherRows=await (await shopPhiOwned(req('/api/shopphi/listings'),env,other,'/api/shopphi/listings')).json();
 assert.equal(otherRows.listings.length,0);
 await assert.rejects(shopPhiOwned(req('/api/shopphi/listings/'+listing.itemId+'/remove','POST',{}),env,other,'/api/shopphi/listings/'+listing.itemId+'/remove',{}),/listing_not_found/);
 await shopPhiOwned(req('/api/shopphi/listings/'+listing.itemId+'/remove','POST',{}),env,owner,'/api/shopphi/listings/'+listing.itemId+'/remove',{});
 await assert.rejects(shopPhiPublic(req('/api/shopphi/public/'+listing.itemId),env,'/api/shopphi/public/'+listing.itemId),/listing_not_found/);
});
test('server rejects prohibited goods, email/phone leaks and malformed prices',()=>{
 for(const title of ['Counterfeit Morgan dollar','Shotgun ammunition','Cocaine','Stolen goods'])assert.throws(()=>normalizeListing({...item(),title}),/restricted_item/);
 assert.throws(()=>normalizeListing({...item(),description:'Call me 888-555-1234'}),/contact_details/);
 assert.throws(()=>normalizeListing({...item(),description:'Contact example@example.org'}),/contact_details/);
 assert.throws(()=>normalizeListing({...item(),priceLabel:'ask me'}),/price_required/);
 assert.throws(()=>normalizeListing({...item(),url:'javascript:alert(1)'}),/https_source/);
 assert.throws(()=>normalizeListing({...item(),photoIds:[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()]}),/invalid_photo_ids/);
});
test('owner cannot attach another person’s private photo id or overwrite a published listing',async()=>{
 const {env,owner,other}=setup();
 const id=crypto.randomUUID(),photo=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO shopphi_media(media_id,owner_user_id,object_key,mime_type,image_bytes,content_hash,created_at) VALUES(?,?,?,?,?,?,?)")
 .bind(photo,other.userId,'shopphi/other.webp','image/webp',99,'secret',Date.now()).run();
 await assert.rejects(shopPhiOwned(req('/api/shopphi/listings','POST',{}),env,owner,'/api/shopphi/listings',{...item(id),photoIds:[photo]}),/seller_photo_not_owned/);
 await shopPhiOwned(req('/api/shopphi/listings','POST',{}),env,owner,'/api/shopphi/listings',item(id));
 await shopPhiOwned(req('/api/shopphi/listings/'+id+'/publish','POST',{}),env,owner,'/api/shopphi/listings/'+id+'/publish',{ownItem:true,publishConsent:true});
 await assert.rejects(shopPhiOwned(req('/api/shopphi/listings','POST',{}),env,owner,'/api/shopphi/listings',item(id)),/published_listing_cannot_be_overwritten/);
});
test('unpublished photo cannot leak through public endpoint',async()=>{
 const {env,owner,objects}=setup(),photo=crypto.randomUUID(),id=crypto.randomUUID();
 objects.set('shopphi/photo.webp',new Uint8Array([1,2,3]));
 await env.DB.prepare("INSERT INTO shopphi_media(media_id,owner_user_id,object_key,mime_type,image_bytes,content_hash,created_at) VALUES(?,?,?,?,?,?,?)")
 .bind(photo,owner.userId,'shopphi/photo.webp','image/webp',3,'test',Date.now()).run();
 await assert.rejects(shopPhiPublic(req('/api/shopphi/media/'+photo),env,'/api/shopphi/media/'+photo),/photo_not_public/);
 await shopPhiOwned(req('/api/shopphi/listings','POST',{}),env,owner,'/api/shopphi/listings',{...item(id),photoIds:[photo]});
 await assert.rejects(shopPhiPublic(req('/api/shopphi/media/'+photo),env,'/api/shopphi/media/'+photo),/photo_not_public/);
 await shopPhiOwned(req('/api/shopphi/listings/'+id+'/publish','POST',{}),env,owner,'/api/shopphi/listings/'+id+'/publish',{ownItem:true,publishConsent:true});
 const result=await shopPhiPublic(req('/api/shopphi/media/'+photo),env,'/api/shopphi/media/'+photo);
 assert.equal(result.status,200);assert.equal(result.headers.get('content-type'),'image/webp');
});
