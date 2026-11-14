import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {CASE_CATALOG,BUSINESS_UPGRADES,type ClientCase} from '@netcity/shared';
import type {ProgressStore} from './progress/store.js';import {ClientCaseService,refreshCases} from './progress/clientCases.js';import {BusinessService,initBusiness} from './progress/business.js';import {CableService} from './progress/cable.js';
export async function releaseGameplayContract(store:ProgressStore){
 for(const t of CASE_CATALOG.slice(1)){
  const guest=await store.register();let p={...t.client};const sessionId='engineer';
  await store.transaction(guest.profileId,null,tx=>{refreshCases(tx.data,Date.now());tx.data.service!.cases[0].templateId=t.id;tx.data.business!.upgrades=BUSINESS_UPGRADES.map(u=>u.id);return {ok:true,message:''};});
  const id=(await store.read(guest.profileId)).service!.cases[0].id,service=new ClientCaseService(store),act=(action:string,extra={})=>service.command(guest.profileId,{action,caseId:id,requestId:randomUUID(),...extra},()=>({...p,sessionId}));
  assert.equal((await act('accept')).result.ok,true,t.id);assert.equal((await act('signoff')).result.ok,false);
  await act('talk',{choice:'changed'});p={...t.hardware};assert.equal((await act('diagnose',{choice:t.diagnosis})).result.ok,false);p={...t.client};await act('talk',{choice:'scope'});p={...t.hardware};
  assert.equal((await act('diagnose',{choice:'restart'})).result.ok,false);assert.equal((await act('diagnose',{choice:t.diagnosis})).result.ok,true,t.id);
  assert.equal((await act('verify')).result.ok,false);
  const step=async(choice:string)=>{const r=await act('repairStep',{choice});assert.equal(r.result.ok,true,t.id+':'+choice);};
  if(t.part){p={...t.shop};assert.equal((await act('buyPart')).result.ok,true,t.id);p={...t.hardware};}
  if(t.kind==='wifi'){assert.equal((await act('repairStep',{choice:'wifiPing'})).result.ok,false);await step('survey');await step('channel:11');assert.equal((await act('repairStep',{choice:'wifiPing'})).result.ok,false);await step('channel:6');await step('wifiPing');}
  if(t.kind==='power'||t.kind==='printer'||t.kind==='server'){
   await act('take');assert.equal((await act('install',{port:t.port})).result.ok,false);await step(t.kind==='power'?'isolate':t.kind==='printer'?'clearJam':'shutdown');
   assert.equal((await act('install',{port:t.port===1?2:1})).result.ok,false);assert.equal((await act('install',{port:t.port})).result.ok,true,t.id);assert.equal((await act('verify')).result.ok,false);await step(t.kind==='power'?'powerTest':t.kind==='printer'?'testPage':'restartServer');
  }
  if(t.kind==='backup'){assert.equal((await act('repairStep',{choice:'restore:contracts.db:snapshot'})).result.ok,false);await step('checksumScan');assert.equal((await act('repairStep',{choice:'restore:clients.csv:current'})).result.ok,false);await step('restore:contracts.db:snapshot');await step('verifyHashes');}
  if(t.kind==='camera'){
   const cable=new CableService(store),wire=(action:string)=>cable.command(guest.profileId,{action,requestId:randomUUID()},()=>({...p,sessionId,entryOpen:true}));
   p={...t.shop};assert.equal((await wire('mission')).result.ok,true);p={x:-6,z:12};assert.equal((await wire('anchor')).result.ok,true);p={x:-6,z:20};assert.equal((await wire('terminate')).result.ok,true);assert.equal((await wire('test')).result.ok,true);
   assert.equal((await act('take')).result.ok,true);assert.equal((await act('install',{port:2})).result.ok,true);
  }
  if(t.kind==='voip'){assert.equal((await act('repairStep',{choice:'voiceVlan:1'})).result.ok,false);await step('voiceVlan:20');assert.equal((await act('repairStep',{choice:'testCall'})).result.ok,false);await step('sip:pbx.netcity.local');await step('testCall');}
  assert.equal((await act('verify')).result.ok,true,t.id);p={...t.client};
  const results=await Promise.all(Array.from({length:4},()=>act('signoff')));assert.equal(results.filter(r=>r.result.ok).length,1,t.id);
  const data=await store.read(guest.profileId);assert.equal(data.credits,Math.round(t.payment*1.1),t.id);assert.equal(data.xp,t.xp);assert.equal(data.business!.workCounts[t.id],1);
 }
 const guest=await store.register(),business=new BusinessService(store);await store.transaction(guest.profileId,null,tx=>{tx.data.credits=3000;refreshCases(tx.data,0);tx.data.service!.completed=8;const b=initBusiness(tx.data);b.workCounts=Object.fromEntries(CASE_CATALOG.map(t=>[t.id,1]));return {ok:true,message:''};});
 const buy={action:'upgrade',id:'field-kit',requestId:randomUUID()};assert.equal((await business.command(guest.profileId,buy,()=>false)).result.ok,false);
 const key={...buy,requestId:randomUUID()};await Promise.all(Array.from({length:8},()=>business.command(guest.profileId,key,()=>true)));assert.equal((await store.read(guest.profileId)).credits,2850);
 const claim={action:'claim',id:'first-clients',requestId:randomUUID()};await Promise.all(Array.from({length:8},()=>business.command(guest.profileId,claim,()=>true)));assert.equal((await store.read(guest.profileId)).credits,3150);
 assert.equal((await business.command(guest.profileId,{...claim,requestId:randomUUID()},()=>true)).result.ok,false);assert.equal((await business.command(guest.profileId,{...buy,price:0,requestId:randomUUID()},()=>true)).result.ok,false);
}
