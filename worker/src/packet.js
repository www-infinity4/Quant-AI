// Quant Packet v2: privacy-minimized, provenance-first commercial signal container.
// Facts are recorded as events. Derived tags must identify their evidence and confidence.
const ID=/^[A-Za-z0-9_.:-]{1,128}$/;
const KINDS=new Set(['search','collect','like','share','view','purchase','receipt','inventory','offer']);
const PURPOSES=new Set(['personal_organize','aggregate_research','inventory_planning','anonymous_matching']);
const clean=(v,n=180)=>typeof v==='string'?v.trim().slice(0,n):'';
const validId=v=>typeof v==='string'&&ID.test(v);

export function validWallet(w){return validId(w)}

export function parsePacket(p){
  if(!p||typeof p!=='object'||p.version!==2)throw new Error('unsupported_packet');
  if(!validId(p.quant_id)||!validId(p.mint_id))throw new Error('invalid_quant_id');
  if(!/^[a-f0-9]{64}$/i.test(p.provenance_hash||''))throw new Error('invalid_provenance');

  const events=Array.isArray(p.events)?p.events:[];
  if(events.length>100)throw new Error('too_many_events');
  const normalizedEvents=events.map(e=>{
    if(!e||!validId(e.event_id)||!KINDS.has(e.kind))throw new Error('invalid_event');
    const subject={type:clean(e.subject?.type,40),key:clean(e.subject?.key,128),label:clean(e.subject?.label,180)};
    if(!subject.type||!validId(subject.key))throw new Error('invalid_subject');
    return {
      event_id:e.event_id,kind:e.kind,subject,
      occurred_at:clean(e.occurred_at,40),
      quantity:Number.isFinite(Number(e.quantity))?Math.max(0,Number(e.quantity)):null,
      amount_minor:Number.isSafeInteger(e.amount_minor)&&e.amount_minor>=0?e.amount_minor:null,
      currency:/^[A-Z]{3}$/.test(e.currency||'')?e.currency:null,
      source:clean(e.source,80)
    };
  });

  const tags=Array.isArray(p.tags)?p.tags:[];
  if(tags.length>50)throw new Error('too_many_tags');
  const normalizedTags=tags.map(t=>{
    if(!t||!validId(t.key))throw new Error('invalid_tag');
    const evidence=Array.isArray(t.evidence_event_ids)?t.evidence_event_ids.filter(validId).slice(0,20):[];
    const confidence=Number(t.confidence);
    if(!evidence.length||!Number.isFinite(confidence)||confidence<0||confidence>1)throw new Error('invalid_tag');
    return {key:t.key,label:clean(t.label,100),confidence,evidence_event_ids:evidence};
  });

  const permissions=p.permissions&&typeof p.permissions==='object'?p.permissions:{};
  const purposes=Array.isArray(permissions.purposes)?permissions.purposes.filter(x=>PURPOSES.has(x)):[];
  const expiresAt=clean(permissions.expires_at,40);

  return {
    version:2,quant_id:p.quant_id,mint_id:p.mint_id,provenance_hash:p.provenance_hash.toLowerCase(),
    events:normalizedEvents,tags:normalizedTags,
    permissions:{purposes:[...new Set(purposes)],expires_at:expiresAt,merchant_alias_allowed:Boolean(permissions.merchant_alias_allowed)},
    privacy:{contains_direct_identity:false,contains_sensitive_profile:false},
    created_at:clean(p.created_at,40)
  };
}
