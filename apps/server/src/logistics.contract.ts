import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {DELIVERY_CATALOG,FREIGHT_PRODUCTS,FREIGHT_SHOP,VAN_BAYS,vanBoot,type WorkVan,type VanIntent} from '@netcity/shared';
import {LogisticsService,type VanContext} from './progress/logistics.js';
import {ClientCaseService} from './progress/clientCases.js';
import type {ProgressStore} from './progress/store.js';

export async function logisticsContract(store:ProgressStore){
 const guest=await store.register(),stranger=await store.register();let now=Date.now();
 let p={x:0,z:-10,sessionId:'driver',floor:0,heldItem:'',vehicleId:''},v:WorkVan|undefined;
 const context=():VanContext=>({actor:p,van:v,parking:VAN_BAYS[0],exit:{x:-5.4,z:6}}),svc=new LogisticsService(store,()=>now);
 const act=(action:VanIntent['action'],choice?:string,key=randomUUID())=>svc.command(guest.profileId,{action,choice,requestId:key},context);
 const yes=async(action:VanIntent['action'],choice?:string)=>{const r=await act(action,choice);assert.equal(r.result.ok,true,action+': '+r.result.message);return r;};
 const request=randomUUID();await act('request',undefined,request);const saved=(await store.read(guest.profileId)).business!.logistics!.van!;
 assert.equal((await act('request',undefined,request)).result.replayed,true);assert.equal((await store.read(guest.profileId)).business!.logistics!.van!.id,saved.id);
 v={id:saved.id,...saved.pose,driver:'',cargoCount:0};assert.equal((await act('enter')).result.ok,false);p={...p,x:-5.4,z:6,heldItem:'patch_cord'};assert.equal((await act('enter')).result.ok,false);p.heldItem='';await yes('enter');v.driver=p.sessionId;p.vehicleId=v.id;v.speed=2;
 assert.equal((await act('exit')).result.ok,false);v.speed=0;await yes('exit');v.driver='';p.vehicleId='';
 assert.equal((await svc.command(stranger.profileId,{action:'enter',requestId:randomUUID()},context)).result.ok,false,'another profile cannot acquire a visible van');
 assert.equal((await svc.command(guest.profileId,{action:'request',requestId:randomUUID(),x:999,credits:99999},context)).result.ok,false);
 assert.equal((await svc.command(guest.profileId,{action:'enter',requestId:randomUUID()},()=>({...context(),blocked:true}))).result.ok,false,'another active room cannot clone ownership');
 p={...p,...FREIGHT_SHOP};const heavy=DELIVERY_CATALOG.find(t=>t.product==='server')!;assert.equal((await act('order',heavy.id)).result.ok,false,'capacity checked before money');assert.equal((await store.read(guest.profileId)).credits,0);
 const t=DELIVERY_CATALOG[0],product=FREIGHT_PRODUCTS[t.product];assert.equal(t.prepaid,true);await yes('order',t.id);assert.equal((await act('collect')).result.ok,false);now+=2100;await yes('collect');p.heldItem='freight:'+t.product;assert.equal((await act('collect')).result.ok,false);
 assert.equal((await act('load')).result.ok,false,'must approach boot');p={...p,...vanBoot(v)};await yes('load');p.heldItem='';assert.equal((await act('unload')).result.ok,false,'walking around the van is not a delivery');
 v.z=-34;p={...p,...vanBoot(v)};assert.equal((await act('unload')).result.ok,false,'automatic parking relocation is not actual driving');v.odometer=40;await yes('unload');p.heldItem='freight:'+t.product;p.x=0;p.z=0;assert.equal((await act('install')).result.ok,false);
 p={...p,x:t.station.x-Math.sign(t.station.x),z:t.station.z+1};await yes('install');p.heldItem='';assert.equal((await act('test','wrong-test')).result.ok,false);await yes('test',product.check);p={...p,...t.client};
 const key=randomUUID(),out=await Promise.all([0,1,2,3].map(()=>act('signoff',undefined,key)));assert.ok(out.every(r=>r.result.ok));assert.equal(out.filter(r=>!r.result.replayed).length,1);assert.equal((await act('signoff')).result.ok,false);
 const done=await store.read(guest.profileId);assert.equal(done.credits,t.payment);assert.equal(done.xp,t.xp);assert.equal(done.business!.logistics!.completed,1);assert.equal(done.business!.workCounts[t.id],1);
 const caseId=randomUUID();await store.transaction(guest.profileId,null,tx=>{tx.data.service={completed:0,cases:[{id:caseId,templateId:'moved-desks',stage:'DIAGNOSED',clues:['changed','scope'],carrying:true,carrier:p.sessionId,carryOrigin:vanBoot(v!),droppedAt:null,satisfaction:3,availableAt:0,completedAt:null}]};tx.data.inventory.patch_cord=2;return {ok:true,message:''};});
 p={...p,...vanBoot(v),heldItem:'patch_cord'};await yes('loadCase');p.heldItem='';let data=await store.read(guest.profileId);assert.equal(data.business!.logistics!.van!.cargo.length,1);assert.equal(data.service!.cases[0].carrying,false);assert.equal(data.inventory.patch_cord,2);
 const duplicate=await new ClientCaseService(store).command(guest.profileId,{action:'take',caseId,requestId:randomUUID()},()=>({...p}));assert.equal(duplicate.result.ok,false,'case part cannot exist both in hands and boot');
 const cargo=data.business!.logistics!.van!.cargo[0];await yes('unloadCase',cargo.id);data=await store.read(guest.profileId);assert.equal(data.business!.logistics!.van!.cargo.length,0);assert.equal(data.service!.cases[0].carrying,true);assert.equal(data.inventory.patch_cord,2);
 assert.equal((await act('unloadCase',cargo.id)).result.ok,false);assert.equal((await store.read(guest.profileId)).credits,t.payment);
}
