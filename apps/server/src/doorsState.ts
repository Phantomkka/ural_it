import {Schema,MapSchema,defineTypes} from '@colyseus/schema';
import {CITY_DOORS,doorClosed,doorLeaf,segmentHitsBox,blockingCablePaths} from '@netcity/shared';
import type {StreetRoom} from './StreetRoom.js';
export class DoorState extends Schema {declare open:boolean;constructor(){super();this.open=false;}}
defineTypes(DoorState,{open:'boolean'});
export function createDoors(){const m=new MapSchema<DoorState>();for(const d of CITY_DOORS)m.set(d.id,Object.assign(new DoorState(),{open:d.id==='hq-server'}));return m;}
export function toggleDoor(room:StreetRoom,session:string,value:unknown){
 const v=value as {kind?:string;id?:string};if(!v||Object.keys(v).some(k=>!['kind','id'].includes(k))||v.kind!=='cityDoor')return {ok:false,message:'Некорректное действие двери.'};
 const d=CITY_DOORS.find(d=>d.id===v.id),p=room.state.players.get(session),s=d&&room.state.doors.get(d.id);
 if(!d||!p||!s||Math.hypot(p.x-d.x,p.z-d.z)>2.5)return {ok:false,message:'Подойдите к двери.'};
 const zone=s.open?doorClosed(d):doorLeaf(d),overlap=(o:{x:number;z:number},margin=.4)=>Math.abs(o.x-zone.x)<zone.width/2+margin&&Math.abs(o.z-zone.z)<zone.depth/2+margin;
 if([...room.state.players.values()].some(o=>!o.floor&&overlap(o))||[...room.state.props.values()].some(o=>!o.holder&&overlap(o,.35)))return {ok:false,message:'Двери мешает человек или предмет.'};
 for(const path of blockingCablePaths(room.state.players.values()).values())for(let i=1;i<path.length;i++)if(segmentHitsBox(path[i-1],path[i],zone))return {ok:false,message:'Сначала уберите кабель из дверного проёма.'};
 s.open=!s.open;return {ok:true,message:`${d.name}: дверь ${s.open?'открыта':'закрыта'}.`};
}
