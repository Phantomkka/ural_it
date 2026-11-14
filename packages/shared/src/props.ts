import {WORLD_COLLIDERS,OFFICE_DOORS,ENTRY_DOOR_CLOSED,WORLD_LIMIT} from './index.js';
export const CARRY_PROPS=[{id:'toolbox',name:'Ящик инструментов',weight:4,x:19,z:-4.8},{id:'parcel',name:'Коробка оборудования',weight:6,x:19,z:4.8},{id:'spare-pc',name:'Запасной системный блок',weight:8,x:17,z:4.8}];
export interface CarryProp {id:string;x:number;z:number;holder:string;weight:number}
export function propBlocks(p:{x:number;z:number},prop:CarryProp){return !prop.holder&&Math.abs(p.x-prop.x)<0.65&&Math.abs(p.z-prop.z)<0.65;}
export function propFloor(p:{x:number;z:number},open:boolean){return Math.abs(p.x)<WORLD_LIMIT-.5&&Math.abs(p.z)<WORLD_LIMIT-.5&&!(open?WORLD_COLLIDERS:[...WORLD_COLLIDERS.filter(c=>c!==OFFICE_DOORS[0]),ENTRY_DOOR_CLOSED]).some(b=>Math.abs(p.x-b.x)<b.width/2+.35&&Math.abs(p.z-b.z)<b.depth/2+.35);}
