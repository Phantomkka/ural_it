export interface CityBuilding {id:string;name:string;x:number;z:number;width:number;depth:number;height:number;theme:string}
const names=['Коворкинг «Север»','Клиника «Пульс»','Снабжение и мастерская','Кафе «Пакет»','Логистический центр','Учебный центр','Студия «Пиксель»','IT-офис №001','Страховая компания','Отель «Сигнал»'];
export const CITY_BUILDINGS:CityBuilding[]=[-1,1].flatMap((side,s)=>Array.from({length:5},(_,i)=>({id:side===1&&i===2?'hq':`building-${s*5+i}`,name:names[s*5+i],x:side*14,z:(i-2)*17,width:12,depth:12,height:7+(i%3)*4,theme:['#c3b09a','#a6b8b7','#a6b0c5'][i%3]})));
export interface CityDoor {id:string;buildingId:string;x:number;z:number;side:number;name:string}
export const CITY_DOORS:CityDoor[]=CITY_BUILDINGS.filter(b=>b.id!=='hq').map(b=>({id:b.id,buildingId:b.id,x:Math.sign(b.x)*8,z:b.z,side:Math.sign(b.x),name:b.name}));
CITY_DOORS.push({id:'hq-server',buildingId:'hq',x:13,z:0,side:1,name:'Серверная IT-офиса'});
export const doorLeaf=(d:CityDoor)=>({x:d.x+d.side*.8,z:d.z-1.15,width:1.6,depth:.12});
export const doorClosed=(d:CityDoor)=>({x:d.x,z:d.z-.35,width:.12,depth:1.6});
export function buildingWalls(b:CityBuilding){const side=Math.sign(b.x);return [
 {x:side*8,z:b.z-3.6,width:.3,depth:4.8},{x:side*8,z:b.z+3.6,width:.3,depth:4.8},
 {x:side*28,z:b.z,width:.3,depth:12},{x:side*18,z:b.z-6,width:20,depth:.3},{x:side*18,z:b.z+6,width:20,depth:.3},
];}
export const CITY_WALLS=CITY_BUILDINGS.filter(b=>b.id!=='hq').flatMap(buildingWalls);
export function insideBuilding(p:{x:number;z:number},id:string){const b=CITY_BUILDINGS.find(b=>b.id===id);return !!b&&Math.abs(p.x-Math.sign(b.x)*18)<9.45&&Math.abs(p.z-b.z)<5.45;}
export function buildingAt(p:{x:number;z:number}){return CITY_BUILDINGS.find(b=>insideBuilding(p,b.id));}
export function missionStation(b:CityBuilding,slot:number){return {x:b.x+(slot%2===0?-1:2.5)*Math.sign(b.x),z:b.z+(slot<2?-3.2:3.2)};}
export function buildingClient(b:CityBuilding){return {x:b.x-Math.sign(b.x)*3,z:b.z-3.7};}
export const DISTRICT_FURNITURE=CITY_BUILDINGS.filter(b=>b.id!=='hq').flatMap(b=>[0,1,2,3].map(slot=>({...missionStation(b,slot),width:.8,depth:.7,buildingId:b.id,slot})));
export function districtRoute(start:{x:number;z:number},target:{x:number;z:number}){
 const from=buildingAt(start),to=buildingAt(target),out=[start];let side=Math.sign(from?.x??start.x)||Math.sign(target.x)||1;
 if(from){if(from.id==='hq'&&start.x>13)out.push({x:16,z:0},{x:11,z:0});else out.push({x:from.x,z:from.z});out.push({x:side*8,z:from.z},{x:side*6,z:from.z});}
 else if(Math.abs(start.x)<5)out.push({x:start.x,z:0},{x:side*6,z:0});else out.push({x:side*6,z:start.z});
 const goalSide=Math.sign(to?.x??target.x)||side;
 if(goalSide!==side){out.push({x:side*6,z:0},{x:goalSide*6,z:0});side=goalSide;}
 out.push({x:side*6,z:to?.z??target.z});
 if(to){out.push({x:side*8,z:to.z});if(to.id==='hq'){out.push({x:11,z:0});if(target.x>13)out.push({x:16,z:0});}else out.push({x:to.x,z:to.z});}
 out.push(target);return out;
}
