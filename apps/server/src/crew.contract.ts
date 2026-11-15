import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {CREW_CATALOG,CREW_SHOP,CITY_BUILDINGS,buildingClient,companyFromProgress,type CrewIntent} from '@netcity/shared';
import {CrewService} from './progress/crew.js';
import type {ProgressStore} from './progress/store.js';
export async function crewContract(store:ProgressStore){
 let now=100000;const service=new CrewService(store,()=>now);
 for(const template of CREW_CATALOG){
  const ids=await Promise.all(Array.from({length:6},async()=> (await store.register()).profileId)),positions=new Map(ids.map(id=>[id,{...CREW_SHOP,sessionId:'session-'+id}]));
  const call=(i:number,v:CrewIntent,key=randomUUID())=>service.command(ids[i],{...v,requestId:key},()=>positions.get(ids[i])!);
  const created=await call(0,{action:'create',templateId:template.id});assert.equal(created.result.ok,true);const code=created.data!.projects![0];
  assert.ok((await Promise.all([1,2,3,4].map(i=>call(i,{action:'join',code})))).every(r=>r.result.ok));assert.equal((await call(5,{action:'join',code})).result.ok,false);assert.equal((await call(1,{action:'launch',code})).result.ok,false);assert.equal((await call(0,{action:'launch',code})).result.ok,true);assert.equal((await call(5,{action:'claim',code})).result.ok,false);
  const b=CITY_BUILDINGS.find(b=>b.id===template.buildingId)!;
  const move=(i:number,point:{x:number;z:number})=>positions.set(ids[i],{x:Math.max(b.x-5.2,Math.min(b.x+5.2,point.x)),z:point.z,sessionId:'session-'+ids[i]});let n=0;
  for(const initial of (await service.view(ids[0]))!.tasks){
   const i=n++%5;
   if(initial.kind==='delivery'){
    positions.set(ids[i],{...CREW_SHOP,sessionId:'session-'+ids[i]});const order={action:'order' as const,code,taskId:initial.id},key=randomUUID(),ordered=await Promise.all([call(i,order,key),call(i,order,key)]);assert.ok(ordered.every(r=>r.result.ok));assert.ok(ordered.some(r=>r.result.replayed));
    assert.equal((await call(i,{action:'pickup',code,taskId:initial.id})).result.ok,false);now+=8001;assert.equal((await call(i,{action:'pickup',code,taskId:initial.id})).result.ok,true);assert.equal((await call((i+1)%5,{action:'pickup',code,taskId:initial.id})).result.ok,false);
    assert.equal((await service.command(ids[i],{action:'work',code,taskId:initial.id,step:0,requestId:randomUUID()},()=>({...initial.steps[0].point,sessionId:'other-session'}))).result.ok,false);
   }
   for(let step=0;step<initial.steps.length;step++){
    const s=initial.steps[step],v={action:'work' as const,code,taskId:initial.id,step,...(s.choice?{choice:s.choice}:{})};positions.set(ids[i],{x:0,z:-10,sessionId:'session-'+ids[i]});assert.equal((await call(i,v)).result.ok,false);move(i,s.point);
    if(s.choice)assert.equal((await call(i,{...v,choice:'live'})).result.ok,false);
    assert.equal((await call(i,v)).result.ok,true,initial.id+':'+step);
    if(s.wait){assert.equal((await call(i,v)).result.ok,false);now+=s.wait+1;assert.equal((await call(i,v)).result.ok,true);}
    assert.equal((await call(i,v)).result.ok,false);
   }
  }
  move(0,buildingClient(b));assert.equal((await call(0,{action:'signoff',code})).result.ok,true);let total=0;
  for(let i=0;i<5;i++){const key=randomUUID(),result=await Promise.all([call(i,{action:'claim',code},key),call(i,{action:'claim',code},key)]);assert.ok(result.every(r=>r.result.ok));const d=await store.read(ids[i]);total+=d.credits;assert.equal(d.credits,Math.floor(template.credits/5));assert.equal(d.xp,Math.floor(template.xp/5));assert.deepEqual(d.projects,[]);assert.equal(companyFromProgress(d).reputation,1);assert.equal((await call(i,{action:'claim',code})).result.ok,false);}
  assert.ok(total<=template.credits);const view=await service.view(ids[0],code);assert.ok(view?.tasks.every(t=>t.done));const serialized=JSON.stringify(view);for(const id of ids)assert.ok(!serialized.includes(id));assert.ok(!serialized.includes('carrierSession'));assert.equal((await call(0,{action:'create',templateId:template.id})).result.ok,true);
 }
 const a=await store.register(),svc=new CrewService(store,()=>now),c=await svc.command(a.profileId,{action:'create',templateId:CREW_CATALOG[0].id,requestId:randomUUID()},()=>CREW_SHOP),code=c.data!.projects![0];
 await store.transaction(a.profileId,null,tx=>{const t=tx.project!.tasks[1];t.orderedAt=now;t.parcel={...CREW_SHOP};t.carrier=a.profileId;t.carrierSession='dead-session';return {ok:true,message:''};},code);await svc.recover(a.profileId,new Set());const p=await store.readProject(code);assert.equal(p!.tasks[1].carrier,undefined);assert.deepEqual(p!.tasks[1].parcel,CREW_SHOP);assert.equal(p!.budget,1500);
 assert.equal((await svc.command(a.profileId,{action:'claim',code,credits:999999,requestId:randomUUID()},()=>CREW_SHOP)).result.ok,false);
}
