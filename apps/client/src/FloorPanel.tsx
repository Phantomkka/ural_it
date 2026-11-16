import {CITY_BUILDINGS,officeFloorCount,officeLift} from '@netcity/shared';
import {DistrictMap} from './DistrictMap';
export function FloorPanel({id,position,send,message}:{id:string;position:{x:number;z:number;floor?:number;buildingId?:string;liftTarget?:number};send:(id:string,floor:number)=>void;message:string}){
 const b=CITY_BUILDINGS.find(b=>b.id===(id||position.buildingId));
 if(!b)return <section><h2>Офисы и этажи</h2><p>Лифт находится в дальнем крыле каждого офиса. Подойдите к панели и нажмите E или кнопку взаимодействия.</p></section>;
 const lift=officeLift(b),travelling=(position.liftTarget??-1)>=0,near=Math.hypot(position.x-lift.x,position.z-lift.z)<=2.2&&(!(position.floor??0)||position.buildingId===b.id);
 return <section className="floor-panel"><h2>{b.name} · этажи</h2><p>Текущий этаж: {(position.floor??0)+1}. {b.id==='hq'?'Приёмная и IT-инфраструктура; рабочие кабинеты.':'Клиентская зона и мастерская; рабочие кабинеты; администрация и переговорные.'}</p>
 <p>{travelling?`Лифт едет на этаж ${(position.liftTarget??0)+1}. Дождитесь открытия дверей.`:near?'Вы у лифта. Выберите этаж.':'Подойдите к панели лифта в дальнем крыле.'}</p>
 <div className="floor-buttons">{Array.from({length:officeFloorCount(b)},(_,i)=><button key={i} disabled={!near||travelling||(position.floor??0)===i} aria-current={(position.floor??0)===i?'page':undefined} onClick={()=>send(b.id,i)}>Этаж {i+1} · {['Приёмная / сервис','Рабочие кабинеты','Администрация'][i]}</button>)}</div>
 <p role="status">{message}</p><DistrictMap x={position.x} z={position.z} destination={lift}/><p>Поставьте груз перед поездкой. Клиентские и бригадные ремонты расположены на первом этаже.</p></section>;
}
