import test from 'node:test';
import assert from 'node:assert/strict';
import { PHI_CAPABILITY_CONTRACT, publicCapabilityContract } from '../worker/src/capabilities.js';

test('capability contract identifies QuantaPhi as ledger authority',()=>{
 assert.equal(PHI_CAPABILITY_CONTRACT.schema,'phi.capability-provider');
 assert.equal(PHI_CAPABILITY_CONTRACT.version,1);
 assert.match(PHI_CAPABILITY_CONTRACT.authority.ledger,/QuantaPhi/);
});

test('capability discovery never advertises a transfer implementation',()=>{
 const contract=publicCapabilityContract();
 assert.equal(contract.capabilities.some(x=>x.id==='quant-transfer'),false);
 assert.equal(contract.denied.find(x=>x.id==='quant-transfer')?.reason,'use_authoritative_quanta_transfer');
 assert.equal(contract.capabilities.every(x=>x.mutatesLedger===false),true);
});

test('public contract is a defensive copy',()=>{
 const contract=publicCapabilityContract();
 contract.capabilities[0].id='changed';
 assert.equal(PHI_CAPABILITY_CONTRACT.capabilities[0].id,'quant-owned');
});
