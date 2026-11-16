import {Schema,defineTypes} from '@colyseus/schema';
import type {Client} from '@colyseus/core';
import {VAN_BAYS,FREIGHT_PRODUCTS,DELIVERY_CATALOG,movementColliders,stepVan,vanOverlaps,vanOnRoad,vanDoor,type WorkVan,type VanPose,type MoveInput} from '@netcity/shared';
import type {StreetRoom} from './StreetRoom.js';
import type {ProfileData,ProgressStore} from './progress/store.js';
import {LogisticsService,type VanContext} from './progress/logistics.js';

export class WorkVanState extends Schema implements WorkVan {
 declare id:string;declare x:number;declare z:number;declare yaw:number;declare speed:number;declare driver:string;declare cargoCount:number;declare bootOpen:boolean;
 constructor(){super();Object.assign(this,{id:'',x:0,z:0,yaw:0,speed:0,driver:'',cargoCount:0,bootOpen:false});}
}
defineTypes(WorkVanState,{id:'string',x:'number',z:'number',yaw:'number',speed:'number',driver:'string',cargoCount:'number',bootOpen:'boolean'});
export class GroundFreightState extends Schema {declare id:string;declare x:number;declare z:number;declare product:string;constructor(){super();Object.assign(this,{id:'',x:0,z:0,product:'pc'});}}
defineTypes(GroundFreightState,{id:'string',x:'number',z:'number',product:'string'});
// One active room per profile in the single authoritative server process. Cargo itself stays transactional.
const activeRooms=new Map<string,VanController>();
export class VanController {
 private profiles=new Map<string,string>();
 private owners=new Map<string,string>();
 private pending=new Map<string,Promise<unknown>>();
 private checkpointAt=0;
 private bootUntil=new Map<string,number>();
 private parcels=new Map<string,string>();
 constructor(private room:StreetRoom,private store:ProgressStore){}
 private obstacles(except='',driver='',drive=0){
  const current=this.room.state.vans.get(except),redLine=current&&this.room.state.trafficPhase!=='DRIVE'&&Math.abs(current.z)>3.5&&Math.abs(current.z)<11&&Math.cos(current.yaw)*(Math.abs(current.speed)>.05?current.speed:drive)*Math.sign(current.z)<0?[{x:0,z:Math.sign(current.z)*3,width:9.9,depth:.08}]:[];
  return [...redLine,...movementColliders(this.room.state.equipment.officeDoorOpen,this.room.state.doors),...[...this.room.state.freight.values()].map(p=>({...p,width:.65,depth:.55})),...[...this.room.state.cars.values()].map(c=>({...c,width:1.9,depth:4.1})),...[...this.room.state.vans.values()].filter(v=>v.id!==except).map(v=>({x:v.x,z:v.z,width:Math.abs(Math.cos(v.yaw))*1.95+Math.abs(Math.sin(v.yaw))*4.2,depth:Math.abs(Math.sin(v.yaw))*1.95+Math.abs(Math.cos(v.yaw))*4.2})),...[...this.room.state.players.entries()].filter(([id,p])=>id!==driver&&!p.floor&&!p.vehicleId).map(([,p])=>({...p,width:.8,depth:.8})),...[...this.room.state.props.values()].filter(p=>!p.holder).map(p=>({...p,width:.55,depth:.55}))];
 }
 private freeParking(preferred?:VanPose){const obstacles=this.obstacles();return [preferred,...VAN_BAYS].find((p):p is VanPose=>!!p&&vanOnRoad(p)&&!obstacles.some(b=>vanOverlaps(p,b)));}
 private vehicle(profileId:string){return [...this.room.state.vans.values()].find(v=>this.owners.get(v.id)===profileId);}
 sync(data:ProfileData){
  const saved=data.business?.logistics?.van;
  if(saved&&(!activeRooms.has(data.id)||activeRooms.get(data.id)===this)){
   let v=this.vehicle(data.id);if(!v&&this.room.state.vans.size<8){const pose=this.freeParking(saved.pose);if(pose){v=Object.assign(new WorkVanState(),pose,{id:saved.id});this.room.state.vans.set(v.id,v);this.owners.set(v.id,data.id);activeRooms.set(data.id,this);}}
   if(v)v.cargoCount=saved.cargo.length+Number(data.business?.logistics?.delivery?.location==='van');
  }
  const d=data.business?.logistics?.delivery,t=d&&DELIVERY_CATALOG.find(t=>t.id===d.templateId);
  const old=this.parcels.get(data.id);if(old&&old!==d?.id){this.room.state.freight.delete(old);this.parcels.delete(data.id);}if(d&&t&&d.location==='ground'&&d.stage==='ORDERED'){this.room.state.freight.set(d.id,Object.assign(new GroundFreightState(),{id:d.id,x:d.x,z:d.z,product:t.product}));this.parcels.set(data.id,d.id);}else if(old){this.room.state.freight.delete(old);this.parcels.delete(data.id);}
  for(const [session,profile]of this.profiles)if(profile===data.id){const p=this.room.state.players.get(session);if(!p)continue;if(d?.location==='hands'&&d.carrier===session&&t)p.heldItem='freight:'+t.product;else if(p.heldItem.startsWith('freight:'))p.heldItem='';}
 }
 bind(client:Client,data:ProfileData){this.profiles.set(client.sessionId,data.id);this.sync(data);}
 isDriving(session:string){const p=this.room.state.players.get(session);return !!p?.vehicleId;}
 stopSession(session:string){for(const v of this.room.state.vans.values())if(v.driver===session){v.driver='';v.speed=0;}const p=this.room.state.players.get(session);if(p)p.vehicleId='';}
 private exitPoint(v:WorkVan,session:string){const blocked=this.obstacles(v.id,session);return [-1,1].map(side=>vanDoor(v,side)).sort((a,b)=>Math.abs(b.x)-Math.abs(a.x)).find(p=>Math.abs(p.x)<44&&Math.abs(p.z)<44&&!blocked.some(b=>Math.abs(p.x-b.x)<b.width/2+.4&&Math.abs(p.z-b.z)<b.depth/2+.4));}
 async command(client:Client,profileId:string,value:unknown){
  const context=():VanContext=>{const p=this.room.state.players.get(client.sessionId),v=this.vehicle(profileId);return {actor:p?{x:p.x,z:p.z,sessionId:client.sessionId,floor:p.floor,heldItem:p.heldItem,vehicleId:p.vehicleId}:null,van:v,parking:this.freeParking(),exit:v?this.exitPoint(v,client.sessionId):undefined,blocked:activeRooms.has(profileId)&&activeRooms.get(profileId)!==this};};
  const result=await new LogisticsService(this.store).command(profileId,value,context);
  if(result.data)this.sync(result.data);
  if(result.result.ok&&!result.result.replayed){const p=this.room.state.players.get(client.sessionId),v=this.vehicle(profileId),a=value as {action:string};if(v&&['load','unload','loadCase','unloadCase'].includes(a.action)){v.bootOpen=true;this.bootUntil.set(v.id,Date.now()+1400);}if(p&&v&&a.action==='enter'){v.bootOpen=false;v.driver=client.sessionId;p.vehicleId=v.id;p.x=v.x;p.z=v.z;p.yaw=v.yaw;}if(p&&v&&a.action==='exit'){const exit=this.exitPoint(v,client.sessionId);if(exit){v.driver='';v.speed=0;p.vehicleId='';Object.assign(p,exit);}}}
  return result;
 }
 blocks(p:{x:number;z:number}){return [...this.room.state.vans.values()].some(v=>vanOverlaps(v,{...p,width:.8,depth:.8}));}
 blocksFreight(from:{x:number;z:number},to:{x:number;z:number}){return [...this.room.state.freight.values()].some(p=>Math.abs(to.x-p.x)<.725&&Math.abs(to.z-p.z)<.675&&Math.hypot(to.x-p.x,to.z-p.z)<Math.hypot(from.x-p.x,from.z-p.z));}
 step(inputs:ReadonlyMap<string,{input:MoveInput;at:number}>,now:number){
  for(const v of this.room.state.vans.values()){
   if((this.bootUntil.get(v.id)??0)<Date.now())v.bootOpen=false;
   const p=v.driver&&this.room.state.players.get(v.driver),entry=v.driver&&inputs.get(v.driver),input=p&&entry&&now-entry.at<250?entry.input:{forward:0,strafe:0,yaw:0};
   if(!p)v.driver='';Object.assign(v,stepVan(v,input,1/30,this.obstacles(v.id,v.driver,input.forward)));
   if(p){p.x=v.x;p.z=v.z;p.yaw=v.yaw;}
  }
  if(now-this.checkpointAt>5000){this.checkpointAt=now;for(const [vehicle,owner]of this.owners){const v=this.room.state.vans.get(vehicle);if(v?.driver)void this.checkpoint(owner,v);}}
 }
 private checkpoint(profileId:string,v:WorkVan){
  const previous=this.pending.get(profileId)??Promise.resolve(),pose={x:v.x,z:v.z,yaw:v.yaw,speed:0};
  const next=previous.then(()=>this.store.transaction(profileId,null,tx=>{const saved=tx.data.business?.logistics?.van;if(saved?.id===v.id)saved.pose=pose;return {ok:true,message:''};})).catch(()=>{v.speed=0;const p=this.room.state.players.get(v.driver),exit=this.exitPoint(v,v.driver);if(p){p.vehicleId='';if(exit)Object.assign(p,exit);}this.room.clients.find(c=>c.sessionId===v.driver)?.send('vanResult',{ok:false,message:'Сохранение транспорта недоступно. Поездка остановлена.'});v.driver='';});
  this.pending.set(profileId,next);void next.finally(()=>{if(this.pending.get(profileId)===next)this.pending.delete(profileId);});return next;
 }
 async detach(session:string,position:{x:number;z:number}){
  const profile=this.profiles.get(session);if(!profile)return;this.profiles.delete(session);const v=this.vehicle(profile);
  if(v?.driver===session){v.driver='';v.speed=0;}if(v)await this.checkpoint(profile,v);
  await this.store.transaction(profile,null,tx=>{const d=tx.data.business?.logistics?.delivery;if(d?.location==='hands'&&d.carrier===session){d.location='ground';d.carrier=undefined;Object.assign(d,position);}return {ok:true,message:''};});
  if(![...this.profiles.values()].includes(profile)){if(v){this.room.state.vans.delete(v.id);this.owners.delete(v.id);this.bootUntil.delete(v.id);}const parcel=this.parcels.get(profile);if(parcel)this.room.state.freight.delete(parcel);this.parcels.delete(profile);if(activeRooms.get(profile)===this)activeRooms.delete(profile);}
 }
 async idle(){await Promise.all(this.pending.values());}
}
