import {Schema,MapSchema,defineTypes} from '@colyseus/schema';
import {CARRY_PROPS,propFloor,carBlocksPoint,type CityCar} from '@netcity/shared';
export class CarryObject extends Schema {declare id:string;declare x:number;declare z:number;declare holder:string;declare weight:number;constructor(){super();this.id='';this.x=this.z=0;this.holder='';this.weight=0;}}
defineTypes(CarryObject,{id:'string',x:'number',z:'number',holder:'string',weight:'number'});
export function createProps(){const props=new MapSchema<CarryObject>();for(const p of CARRY_PROPS)props.set(p.id,Object.assign(new CarryObject(),p));return props;}
export function handleProp(props:Map<string,CarryObject>,player:{x:number;z:number;yaw:number;heldItem:string},session:string,value:unknown,open:boolean,cars:Iterable<CityCar>){
 const v=value as {kind?:string;id?:string};if(!v||Object.keys(v).some(k=>!['kind','id'].includes(k)))return {ok:false,message:'Недопустимое действие.'};
 const held=[...props.values()].find(p=>p.holder===session);
 if(v.kind==='dropProp'){
  if(!held)return {ok:false,message:'В руках нет предмета.'};
  const candidates=[0,Math.PI/2,-Math.PI/2,Math.PI].map(a=>({x:player.x+Math.sin(player.yaw+a)*1.1,z:player.z+Math.cos(player.yaw+a)*1.1}));
  const floor=candidates.find(p=>propFloor(p,open)&&![...cars].some(c=>carBlocksPoint(p,c))&&![...props.values()].some(o=>o!==held&&!o.holder&&Math.hypot(o.x-p.x,o.z-p.z)<.9));
  if(!floor)return {ok:false,message:'Мало места. Отойдите от стены или автомобиля.'};
  Object.assign(held,floor,{holder:''});player.heldItem='';return {ok:true,message:'Предмет аккуратно поставлен на землю.'};
 }
 const prop=props.get(v.id??'');if(v.kind!=='takeProp'||!prop||Math.hypot(player.x-prop.x,player.z-prop.z)>2.5)return {ok:false,message:'Подойдите к предмету.'};
 if(prop.holder||player.heldItem||held)return {ok:false,message:'Предмет занят или руки уже заняты.'};
 if(prop.weight>10)return {ok:false,message:'Слишком тяжело для одного инженера.'};
 prop.holder=session;player.heldItem='prop:'+prop.id;return {ok:true,message:`В руках ${CARRY_PROPS.find(p=>p.id===prop.id)?.name} · ${prop.weight} кг. G / «Положить» — поставить.`};
}
