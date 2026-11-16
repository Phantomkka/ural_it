import {CITY_BUILDINGS,buildingClient,missionStation} from './buildings.js';
import type {MoveInput} from './index.js';
import type {Footprint} from './worldGeometry.js';
import type {ItemId} from './progression.js';
import {ITEMS} from './progression.js';

export interface VanPose {x:number;z:number;yaw:number;speed:number}
export interface WorkVan extends VanPose {id:string;driver:string;cargoCount:number;bootOpen?:boolean}
export interface VanCaseCargo {id:string;caseId:string;part:ItemId;weight:number}
export interface SavedVan {id:string;pose:VanPose;cargo:VanCaseCargo[]}
export const VAN_BAYS=[-1,1].flatMap(side=>[6,-12,24,-24].map(z=>({x:side*3.8,z,yaw:side<0?Math.PI:0,speed:0})));
export const VAN_WIDTH=1.95,VAN_LENGTH=4.2,VAN_MAX_SPEED=10;
export const vanBoot=(v:VanPose)=>({x:v.x-Math.sin(v.yaw)*2.15,z:v.z-Math.cos(v.yaw)*2.15});
export const vanDoor=(v:VanPose,side=-1)=>({x:v.x+Math.cos(v.yaw)*side*1.6,z:v.z-Math.sin(v.yaw)*side*1.6});
export const DRIVE_SURFACES:Footprint[]=[{x:0,z:0,width:9.9,depth:90}];
export function vanOnRoad(v:VanPose){const c=Math.cos(v.yaw),s=Math.sin(v.yaw);return [-1,0,1].every(x=>[-1,0,1].every(z=>{const p={x:v.x+x*VAN_WIDTH/2*c+z*VAN_LENGTH/2*s,z:v.z-x*VAN_WIDTH/2*s+z*VAN_LENGTH/2*c};return DRIVE_SURFACES.some(r=>Math.abs(p.x-r.x)<=r.width/2&&Math.abs(p.z-r.z)<=r.depth/2);}));}
export function vanFootprint(v:VanPose):Footprint{return {x:v.x,z:v.z,width:Math.abs(Math.cos(v.yaw))*VAN_WIDTH+Math.abs(Math.sin(v.yaw))*VAN_LENGTH,depth:Math.abs(Math.sin(v.yaw))*VAN_WIDTH+Math.abs(Math.cos(v.yaw))*VAN_LENGTH};}
/** Oriented vehicle versus axis-aligned object SAT; yaw cannot squeeze a van through walls. */
export function vanOverlaps(v:VanPose,b:Footprint,padding=.08){
 const dx=b.x-v.x,dz=b.z-v.z,c=Math.cos(v.yaw),s=Math.sin(v.yaw),hw=VAN_WIDTH/2+padding,hl=VAN_LENGTH/2+padding,bw=b.width/2,bl=b.depth/2;
 return Math.abs(dx)<Math.abs(c)*hw+Math.abs(s)*hl+bw&&Math.abs(dz)<Math.abs(s)*hw+Math.abs(c)*hl+bl&&Math.abs(dx*c-dz*s)<hw+bw*Math.abs(c)+bl*Math.abs(s)&&Math.abs(dx*s+dz*c)<hl+bw*Math.abs(s)+bl*Math.abs(c);
}
export function stepVan(v:VanPose,input:MoveInput,dt:number,obstacles:readonly Footprint[],limit=45):VanPose{
 const step=Math.max(0,Math.min(dt,1/30));let speed=v.speed;
 if(input.forward){const reversing=Math.sign(input.forward)!==Math.sign(speed)&&Math.abs(speed)>.3;speed+=input.forward*(reversing?9:4)*step;}else speed=Math.sign(speed)*Math.max(0,Math.abs(speed)-5*step);
 speed=Math.max(-3.5,Math.min(VAN_MAX_SPEED,speed));
 const yaw=(v.yaw+input.strafe*1.05*Math.min(1,Math.abs(speed)/3)*Math.sign(speed)*step+Math.PI*4)%(Math.PI*2);
 const next={x:v.x+Math.sin(yaw)*speed*step,z:v.z+Math.cos(yaw)*speed*step,yaw,speed};
 if(!vanOnRoad(next)||Math.abs(next.x)>limit-2.4||Math.abs(next.z)>limit-2.4||obstacles.some(b=>vanOverlaps(next,b)))return {...v,speed:0};
 return next;
}
export const FREIGHT_PRODUCTS={
 pc:{name:'Рабочая станция в упаковке',price:180,weight:12,check:'boot',checkName:'POST и загрузка ОС'},
 server:{name:'Серверный комплект',price:600,weight:24,check:'burnin',checkName:'Нагрузочный тест и журнал температур'},
 camera:{name:'Комплект камер PoE',price:90,weight:4,check:'stream',checkName:'PoE, видеопоток и тест записи'},
 cable:{name:'Бухта UTP и монтажный комплект',price:60,weight:8,check:'wiremap',checkName:'Распиновка и гигабитный линк'},
} as const;
export type FreightProduct=keyof typeof FREIGHT_PRODUCTS;
export interface GroundFreight {id:string;x:number;z:number;product:FreightProduct}
export interface DeliveryTemplate {id:string;title:string;buildingId:string;product:FreightProduct;prepaid:boolean;payment:number;xp:number;client:{x:number;z:number};station:{x:number;z:number}}
export const FREIGHT_SHOP={x:-6,z:2};
export const DELIVERY_CATALOG:DeliveryTemplate[]=CITY_BUILDINGS.filter(b=>b.id!=='hq').map((b,i)=>{const product=(['pc','camera','cable','server'] as const)[i%4];return {id:'delivery-'+b.id,title:b.name+' · '+FREIGHT_PRODUCTS[product].name,buildingId:b.id,product,prepaid:i===0,payment:(i===0?0:FREIGHT_PRODUCTS[product].price)+120+i*20,xp:60+i*10,client:buildingClient(b),station:missionStation(b,0)};});
export interface DeliveryOrder {id:string;templateId:string;stage:'ORDERED'|'INSTALLED'|'TESTED'|'COMPLETE';availableAt:number;location:'supplier'|'hands'|'ground'|'van'|'installed';x:number;z:number;carrier?:string;vanId?:string;loadedAt?:{x:number;z:number};transported:boolean;completedAt?:number}
export interface LogisticsProgress {van?:SavedVan;delivery?:DeliveryOrder;completed:number}
export type VanIntent={action:'request'|'enter'|'exit'|'loadCase'|'unloadCase'|'order'|'collect'|'drop'|'load'|'unload'|'install'|'test'|'signoff';choice?:string};
export type VanAction=VanIntent&{requestId:string};
export const vanCapacity=(owned:boolean)=>({weight:owned?70:20,slots:owned?8:2});
export function validLogistics(l:LogisticsProgress){
 const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v),point=(p:{x:number;z:number}|undefined)=>!!p&&[p.x,p.z].every(v=>Number.isFinite(v)&&Math.abs(v)<=45),v=l.van,d=l.delivery;
 if(!Number.isSafeInteger(l.completed)||l.completed<0||l.completed>2147483647)return false;
 if(v&&(!uuid(v.id)||!point(v.pose)||!Number.isFinite(v.pose.yaw)||Math.abs(v.pose.yaw)>Math.PI*2||v.pose.speed!==0||!Array.isArray(v.cargo)||v.cargo.length>8||new Set(v.cargo.map(c=>c.id)).size!==v.cargo.length||v.cargo.some(c=>!uuid(c.id)||!uuid(c.caseId)||!Object.hasOwn(ITEMS,c.part)||!Number.isFinite(c.weight)||c.weight<=0||c.weight>30)))return false;
 if(d&&(!uuid(d.id)||!DELIVERY_CATALOG.some(t=>t.id===d.templateId)||!['ORDERED','INSTALLED','TESTED','COMPLETE'].includes(d.stage)||!['supplier','hands','ground','van','installed'].includes(d.location)||!point(d)||typeof d.transported!=='boolean'||!Number.isFinite(d.availableAt)||d.availableAt<0||(d.loadedAt!==undefined&&!point(d.loadedAt))||(d.carrier!==undefined&&(typeof d.carrier!=='string'||d.carrier.length>40))||(d.vanId!==undefined&&!uuid(d.vanId))||(d.location==='hands'&&!d.carrier)||(d.location==='van'&&(!v||d.vanId!==v.id))))return false;
 return true;
}
