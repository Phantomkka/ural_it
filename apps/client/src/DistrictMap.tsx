import {BUILDINGS,OFFICE,SWITCH,COMPUTERS,CITY_DOORS,districtRoute} from '@netcity/shared';
import {CONTACTS} from './district';
export function DistrictMap({x,z,destination=SWITCH}:{x:number;z:number;destination?:{x:number;z:number}}){
 const path=districtRoute({x,z},destination).map((p,i)=>`${i?'L':'M'} ${p.x} ${-p.z}`).join(' ');
 return <><p>Все десять зданий имеют доступный первый этаж. Входы обращены к улице; дверь открывается клавишей E или кнопкой «Осмотреть». Переход между сторонами — по центру района.</p>
 <svg className="district-map" viewBox="-46 -46 92 92" role="img" aria-label="Карта Новолинска">
 <rect x="-46" y="-46" width="92" height="92" fill="#183b43"/><path d="M 0 -45 V 45" stroke="#45616d" strokeWidth="10"/>
 {BUILDINGS.map(b=><g key={b.id}><rect x={b.x-6} y={-b.z-6} width="12" height="12" rx="1" fill={b===OFFICE?'#62e3bd':'#66838b'}/><text x={b.x} y={-b.z} fill="#102b36" textAnchor="middle" fontSize="2">{b.name.split(' ')[0]}</text><circle cx={Math.sign(b.x)*8} cy={-b.z} r=".7" fill="#e9d59d"/></g>)}
 <path d={path} stroke="#ffd38b" strokeWidth=".6" strokeDasharray="1 1" fill="none"/>
 <circle cx={destination.x} cy={-destination.z} r="2" fill="none" stroke="#ffd38b" strokeWidth=".5"/>
 <circle cx={SWITCH.x} cy={-SWITCH.z} r="1.1" fill="#ffb65f"/>{COMPUTERS.map(pc=><circle key={pc.id} cx={pc.x} cy={-pc.z} r=".6" fill="#153142"/>)}
 {CONTACTS.map(n=><circle key={n.id} cx={n.x} cy={-n.z} r=".8" fill="#e2b46b"><title>{n.name}</title></circle>)}
 <circle cx={x} cy={-z} r="1.3" fill="white" stroke="#132f3d" strokeWidth=".5"/><text x="-43" y="44" fill="white" fontSize="2.5">● Вы · ◦ Входы · ● Клиенты · пунктир — маршрут</text></svg>
 <p>Маршрут ведёт через входы; закрытые двери нужно открыть. Клиент и номер узла указаны в заявке.</p></>;
}
