import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {CASE_CATALOG,CITY_BUILDINGS,BUSINESS_UPGRADES,propFloor} from '@netcity/shared';
import type {ProgressStore} from './progress/store.js';import {ClientCaseService,refreshCases} from './progress/clientCases.js';
export async function betaContract(store:ProgressStore){
 assert.equal(CASE_CATALOG.length,44);assert.equal(new Set(CASE_CATALOG.map(t=>t.kind)).size,12);
 for(const t of CASE_CATALOG.slice(8)){
  const guest=await store.register(),b=CITY_BUILDINGS.find(b=>b.id===t.buildingId)!;let now=Date.now(),p={...t.client};
  const work={...t.hardware,x:t.hardware.x-Math.sign(b.x)*1.1};assert.ok(propFloor(work,true),t.id+' work position');
  await store.transaction(guest.profileId,null,tx=>{refreshCases(tx.data,now);tx.data.service!.cases[0].templateId=t.id;tx.data.business!.upgrades=BUSINESS_UPGRADES.map(u=>u.id);return {ok:true,message:''};});
  const id=(await store.read(guest.profileId)).service!.cases[0].id,svc=new ClientCaseService(store,()=>now);
  const act=(action:string,extra={})=>svc.command(guest.profileId,{action,caseId:id,requestId:randomUUID(),...extra},()=>({...p,sessionId:'beta'}));
  const step=async(choice:string)=>assert.equal((await act('repairStep',{choice})).result.ok,true,t.id+': '+choice);
  assert.equal((await act('accept')).result.ok,true);p={...t.client,z:b.z-6.1};assert.equal((await act('talk',{choice:'changed'})).result.ok,false,'no talking through outer wall');p={...t.client};
  await act('talk',{choice:'changed'});await act('talk',{choice:'scope'});p={...work};assert.equal((await act('diagnose',{choice:t.diagnosis})).result.ok,true,t.id);
  assert.equal((await act('signoff')).result.ok,false);assert.equal((await act('verify')).result.ok,false);
  if(t.part){p={...t.shop};assert.equal((await act('buyPart')).result.ok,true);p={...work};assert.equal((await act('take')).result.ok,true);}
  if(['power','printer','server','ups','storage'].includes(t.kind)){
   assert.equal((await act('install',{port:t.port})).result.ok,false,'unsafe install rejected');
   if(t.kind==='storage'){await step('makeSnapshot');await step('offlineDisk');}else await step(({power:'isolate',printer:'clearJam',server:'shutdown',ups:'isolateUPS'} as Record<string,string>)[t.kind]);
  }
  if(t.part){assert.equal((await act('install',{port:t.port})).result.ok,true,t.id);}
  if(t.kind==='network')await step('linkTest');
  if(t.kind==='power')await step('powerTest');
  if(t.kind==='printer')await step('testPage');
  if(t.kind==='server')await step('restartServer');
  if(t.kind==='wifi'){await step('survey');await step('channel:'+(t.tuning?.wifiChannel===11?6:11));assert.equal((await act('repairStep',{choice:'wifiPing'})).result.ok,false);await step('channel:'+(t.tuning?.wifiChannel??6));await step('wifiPing');}
  if(t.kind==='backup'){await step('checksumScan');assert.equal((await act('repairStep',{choice:'restore:contracts.db:current'})).result.ok,false);await step(`restore:${t.tuning!.backupFile}:snapshot`);await step('verifyHashes');}
  if(t.kind==='voip'){assert.equal((await act('repairStep',{choice:'voiceVlan:1'})).result.ok,false);await step('voiceVlan:'+t.tuning!.voiceVlan);await step('sip:'+t.tuning!.sipHost);await step('testCall');}
  if(t.kind==='dhcp'){assert.equal((await act('repairStep',{choice:'renewLease'})).result.ok,false);await step('auditLeases');assert.equal((await act('repairStep',{choice:'dhcpPool:1:10'})).result.ok,false);await step(`dhcpPool:${t.tuning!.poolStart}:${t.tuning!.poolEnd}`);await step('renewLease');}
  if(t.kind==='dns'){assert.equal((await act('repairStep',{choice:'dnsResolve'})).result.ok,false);await step('zoneAudit');assert.equal((await act('repairStep',{choice:'dnsRecord:127.0.0.1'})).result.ok,false);await step('dnsRecord:'+t.tuning!.targetIP);await step('dnsResolve');}
  if(t.kind==='ups'){await step('restoreUPS');await step('upsTest');}
  if(t.kind==='storage'){await step('startRebuild');assert.equal((await act('repairStep',{choice:'storageVerify'})).result.ok,false);now+=5001;await step('storageVerify');}
  assert.equal((await act('verify')).result.ok,true,t.id);p={...t.client};const done=await Promise.all([0,1,2,3].map(()=>act('signoff')));assert.equal(done.filter(r=>r.result.ok).length,1,t.id);
  const data=await store.read(guest.profileId);assert.equal(data.credits,Math.round(t.payment*1.1),t.id);assert.equal(data.xp,t.xp);assert.equal(data.business!.workCounts[t.id],1);if(t.part)assert.equal(data.inventory[t.part],0);
 }
 const guest=await store.register();await store.transaction(guest.profileId,null,tx=>{refreshCases(tx.data,Date.now());return {ok:true,message:''};});const svc=new ClientCaseService(store),old=(await store.read(guest.profileId)).service!.cases.at(-1)!;
 const select={action:'select',caseId:old.id,choice:CASE_CATALOG[8].id,requestId:randomUUID()};assert.equal((await svc.command(guest.profileId,select,()=>({x:0,z:0,sessionId:'one'}))).result.ok,true);const c=(await store.read(guest.profileId)).service!.cases.at(-1)!;
 assert.equal((await svc.command(guest.profileId,select,()=>null)).result.replayed,true);assert.equal((await store.read(guest.profileId)).credits,0);
 await svc.command(guest.profileId,{action:'accept',caseId:c.id,requestId:randomUUID()},()=>({x:0,z:0,sessionId:'one'}));
 assert.equal((await svc.command(guest.profileId,{...select,caseId:c.id,requestId:randomUUID()},()=>({x:0,z:0,sessionId:'one'}))).result.ok,false);assert.equal((await store.read(guest.profileId)).credits,30);
 await store.transaction(guest.profileId,null,tx=>{const c=tx.data.service!.cases.at(-1)!;c.stage='COMPLETED';c.availableAt=Date.now()-1;return {ok:true,message:''};});
 assert.equal((await svc.command(guest.profileId,{...select,caseId:c.id,choice:CASE_CATALOG[12].id,requestId:randomUUID()},()=>({x:0,z:0,sessionId:'one'}))).result.ok,true,'selection after cooldown must retain the requested case');
}
