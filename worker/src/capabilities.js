export const PHI_CAPABILITY_CONTRACT=Object.freeze({
 schema:'phi.capability-provider',
 version:1,
 provider:'Quant-AI',
 authority:{
  identity:'QuantaPhi authenticated identity',
  ledger:'QuantaPhi Quant ledger',
  transfers:'QuantaPhi authoritative transfer service'
 },
 capabilities:[
  {id:'quant-owned',method:'GET',path:'/api/quants/owned',scope:'owner',mutatesLedger:false},
  {id:'quant-packet-ingest',method:'POST',path:'/api/packets',scope:'owner',mutatesLedger:false},
  {id:'quant-search-signal',method:'POST',path:'/api/search',scope:'owner',mutatesLedger:false},
  {id:'quant-folders',method:'GET|POST',path:'/api/folders',scope:'owner',mutatesLedger:false},
  {id:'inventory-experiment',method:'POST',path:'/api/inventory/experiments',scope:'owner',mutatesLedger:false}
 ],
 denied:[
  {id:'quant-transfer',reason:'use_authoritative_quanta_transfer'}
 ]
});

export function publicCapabilityContract(){
 return {
  ...PHI_CAPABILITY_CONTRACT,
  authority:{...PHI_CAPABILITY_CONTRACT.authority},
  capabilities:PHI_CAPABILITY_CONTRACT.capabilities.map(x=>({...x})),
  denied:PHI_CAPABILITY_CONTRACT.denied.map(x=>({...x}))
 };
}
