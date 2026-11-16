import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ENGINEERING_CASES,LAB_REQUIRED,BUSINESS_UPGRADES,ITEMS,type ClientCase,type CaseIntent} from '@netcity/shared';
import {ClientCaseService,refreshCases} from './progress/clientCases.js';
import {labFault,labSite,labPart} from './progress/diagnosticLab.js';
import type {ProgressStore} from './progress/store.js';

export async function diagnosticsContract(store:ProgressStore){
 assert.equal(ENGINEERING_CASES.length,12);const variants=new Set<string>();
 for(const t of ENGINEERING_CASES)for(let variant=0;variant<(['network','server','printer'].includes(t.kind)?2:1);variant++){
  const guest=await store.register(),work={...t.hardware,x:t.hardware.x-Math.sign(t.hardware.x)};let now=Date.now(),p={...t.client},online=true;
  await store.transaction(guest.profileId,null,tx=>{refreshCases(tx.data,now);tx.data.business!.upgrades=BUSINESS_UPGRADES.map(u=>u.id);tx.data.credits=2000;return {ok:true,message:''};});
  const svc=new ClientCaseService(store,()=>now),original=(await store.read(guest.profileId)).service!.cases.at(-1)!;
  const actor=()=>online?{...p,sessionId:'lab-tests'}:null;
  assert.equal((await svc.command(guest.profileId,{action:'select',caseId:original.id,choice:t.id,requestId:randomUUID()},actor)).result.ok,true);
  await store.transaction(guest.profileId,null,tx=>{const c=tx.data.service!.cases.at(-1)!;if(['network','server','printer'].includes(t.kind))while(labFault(c,t)!==({network:['cable','vlan'],server:['heat','ram'],printer:['jam','queue']} as Record<string,string[]>)[t.kind][variant])c.id=randomUUID();return {ok:true,message:''};});
  const current=async()=>(await store.read(guest.profileId)).service!.cases.at(-1)!;let c=await current();const id=c.id,fault=labFault(c,t),site=labSite(c,t);variants.add(fault);
  const act=async(action:CaseIntent['action'],choice?:string,port?:number)=>{now+=2000;return svc.command(guest.profileId,{action,caseId:id,requestId:randomUUID(),...(choice!==undefined?{choice}:{}),...(port!==undefined?{port}:{})},actor);};
  const yes=async(action:CaseIntent['action'],choice?:string,port?:number)=>{const r=await act(action,choice,port);assert.equal(r.result.ok,true,`${t.kind}/${fault}/${action}/${choice}: ${r.result.message}`);return r;};
  const accept={action:'accept',caseId:id,requestId:randomUUID()};assert.equal((await svc.command(guest.profileId,accept,actor)).result.ok,true);assert.equal((await svc.command(guest.profileId,accept,actor)).result.replayed,true);
  await yes('talk','changed');await yes('talk','scope');p={...work};
  assert.equal((await act('diagnose',fault)).result.ok,false,'hypothesis needs observed measurements');
  p={x:0,z:44};assert.equal((await act('measure',LAB_REQUIRED[t.kind][0])).result.ok,false,'remote instruments denied');p={...work};
  online=false;assert.equal((await act('measure',LAB_REQUIRED[t.kind][0])).result.ok,false);online=true;
  for(const i of LAB_REQUIRED[t.kind])await yes('measure',i);
  if(t.kind==='dns'){await yes('measure','ping');assert.equal((await current()).lab!.readings.ping!.healthy,true,'broken DNS still permits an IP ping');}
  assert.equal((await act('measure','constructor')).result.ok,false);assert.equal((await act('diagnose',fault==='cable'?'dns':'cable')).result.ok,false);
  await yes('diagnose',fault);assert.equal((await act('verify')).result.ok,false);
  c=await current();
  if(c.lab?.requiredPart){
   p={...t.shop};await yes('buyPart');await yes('take');p={...work};
   if(['power','heat','jam','battery','disk'].includes(fault)){
    assert.equal((await act('install',undefined,t.port)).result.ok,false,'unsafe replacement denied');
    for(const step of ({power:['isolate'],heat:['shutdown'],jam:['clearJam'],battery:['isolateUPS'],disk:['makeSnapshot','offlineDisk']} as Record<string,string[]>)[fault])await yes('repairStep',step);
   }
   if(fault==='camera')await store.transaction(guest.profileId,null,tx=>{tx.data.cable={id:randomUUID(),kind:'camera',caseId:id,stage:'TESTED',points:[{x:-6,z:2},{x:-6,z:20}],endpoint:{x:-6,z:20}};return {ok:true,message:''};});
   await yes('install',undefined,t.port);
   for(const step of ({power:['powerTest'],heat:['restartServer'],jam:['testPage'],battery:['restoreUPS','upsTest'],disk:['startRebuild']} as Record<string,string[]>)[fault]??[])await yes('repairStep',step);
   if(fault==='disk'){now+=5001;await yes('repairStep','storageVerify');}
  }else{
   const configs:Record<string,string[]>={vlan:['vlan:'+site.vlan],leases:[`dhcp:${site.poolStart}:${site.poolEnd}`],dns:['dns:'+site.address],radio:['channel:'+site.channel],sip:['vlan:'+site.vlan,'sip:'+site.sipHost],queue:['queue:resume'],ram:['ram:reseat'],backup:[`restore:${site.file}:snapshot`]};
   if(fault==='ram'){assert.equal((await act('configure','ram:reseat')).result.ok,false);await yes('repairStep','shutdown');}
   if(fault==='leases')assert.equal((await act('configure','dhcp:1:254')).result.ok,false,'static addresses protected');
   if(fault==='dns')assert.equal((await act('configure','dns:999.1.1.1')).result.ok,false);
   for(const config of configs[fault])await yes('configure',config);
  }
  assert.equal((await act('verify')).result.ok,false,'pre-repair readings cannot close a case');
  for(const i of LAB_REQUIRED[t.kind])await yes('measure',i);
  await yes('verify');p={...t.client};const signoff={action:'signoff',caseId:id,requestId:randomUUID()};
  const replies=await Promise.all([0,1,2,3].map(()=>svc.command(guest.profileId,signoff,actor)));assert.ok(replies.every(r=>r.result.ok));assert.equal(replies.filter(r=>!r.result.replayed).length,1);
  const after=await store.read(guest.profileId),part=labPart(c,t);assert.equal(after.credits,2000+(part?t.advance-ITEMS[part].price:0)+Math.round(t.payment*1.1));assert.equal(after.xp,t.xp);assert.equal(after.service!.completed,1);assert.equal(after.business!.workCounts[t.id],1);assert.equal(after.service!.cases.at(-1)!.lab?.readings[LAB_REQUIRED[t.kind][0]]?.healthy,true);
  assert.equal((await svc.command(guest.profileId,{...signoff,credits:99999},actor)).result.ok,false,'untrusted reward fields rejected');
 }
 assert.equal(variants.size,15,'every physical/configuration fault branch covered');
}
