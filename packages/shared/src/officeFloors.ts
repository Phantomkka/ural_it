import {CITY_BUILDINGS,districtRoute,type CityBuilding} from './buildings.js';
export const FLOOR_HEIGHT=3.6;
export const LIFT_DOOR_MS=450;
export const liftTravelDuration=(from:number,to:number)=>LIFT_DOOR_MS*2+650+Math.abs(to-from)*350;
export const officeFloorCount=(b:CityBuilding)=>b.id==='hq'?2:3;
/** Preserve the legacy service origin and door; extend only towards the rear. */
export const officeEnvelope=(b:CityBuilding)=>({x:Math.sign(b.x)*18,z:b.z,width:20,depth:12});
export const officeLift=(b:CityBuilding)=>({x:Math.sign(b.x)*24,z:b.z+1.8});
export function officeLiftRoute(start:{x:number;z:number},b:CityBuilding){const lift=officeLift(b);if(Math.hypot(start.x-lift.x,start.z-lift.z)<.7)return [start,lift];const front={x:lift.x-Math.sign(b.x)*2.2,z:lift.z},approach={x:front.x,z:start.z};return [...districtRoute(start,insideOffice(start,b)?approach:front),front,lift];}
export function upperWalls(b:CityBuilding){const e=officeEnvelope(b);return [{x:e.x-e.width/2,z:b.z,width:.3,depth:12},{x:e.x+e.width/2,z:b.z,width:.3,depth:12},{x:e.x,z:b.z-6,width:e.width,depth:.3},{x:e.x,z:b.z+6,width:e.width,depth:.3}];}
export function upperFurniture(b:CityBuilding){const e=officeEnvelope(b);return [-3,0,3].flatMap(z=>[-3,2].map(x=>({x:e.x+Math.sign(b.x)*x,z:b.z+z,width:1.6,depth:.85})));}
export const officeCopyStation=(b:CityBuilding)=>({x:Math.sign(b.x)*26.5,z:b.z+4.7,width:1.8,depth:.6});
export function upperAmenities(b:CityBuilding){const side=Math.sign(b.x),copy=officeCopyStation(b);return [copy,...upperFurniture(b).map(p=>({x:p.x,z:p.z+1,width:.65,depth:.65})),...[-.7,.7].flatMap(dx=>[-1.05,1.05].map(dz=>({x:side*24+dx,z:b.z-3.7+dz,width:.65,depth:.65}))),...[3.3,4.9].map(z=>({x:side*10.3,z:b.z+z,width:.85,depth:.9})),{x:side*11.7,z:b.z+4.1,width:.8,depth:.8}];}
export function upperColliders(id:string){const b=CITY_BUILDINGS.find(b=>b.id===id);return b?[...upperWalls(b),...upperFurniture(b),...upperAmenities(b),...officeLiftWalls(b),...meetingWalls(b)]:[];}
export const OFFICE_REAR_FURNITURE=CITY_BUILDINGS.flatMap(b=>[{x:Math.sign(b.x)*22,z:b.z-3,width:1.6,depth:.85},{x:Math.sign(b.x)*25,z:b.z-3,width:1.6,depth:.85},{x:Math.sign(b.x)*21.5,z:b.z+3.3,width:1.6,depth:.85}]);
export function insideOffice(p:{x:number;z:number},b:CityBuilding){const e=officeEnvelope(b);return Math.abs(p.x-e.x)<e.width/2-.55&&Math.abs(p.z-b.z)<5.45;}
export function officeLiftWalls(b:CityBuilding){const p=officeLift(b),side=Math.sign(b.x);return [{x:p.x+side*1.2,z:p.z,width:.12,depth:2.32},...[-1,1].map(z=>({x:p.x+side*.075,z:p.z+z*1.1,width:2.25,depth:.12}))];}
export function meetingWalls(b:CityBuilding){const side=Math.sign(b.x);return [{x:side*21,z:b.z-3.65,width:.12,depth:4.7},{x:side*21.65,z:b.z-1.3,width:1.3,depth:.12},{x:side*25.35,z:b.z-1.3,width:3.3,depth:.12},{x:side*24,z:b.z-3.7,width:2.6,depth:1.3}];}
