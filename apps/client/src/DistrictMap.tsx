import { BUILDINGS, OFFICE, SWITCH, COMPUTERS } from "@netcity/shared";
import { CONTACTS } from "./district";
export function DistrictMap({x,z}: {x:number;z:number}) {
  return <><p>Север ↑ · Войдите в офис с улицы через дверь по центру западной стены. Внутри пройдите прямо в серверную.</p>
    <svg className="district-map" viewBox="-46 -46 92 92" role="img" aria-label="Карта Новолинска">
      <rect x="-46" y="-46" width="92" height="92" fill="#183b43"/>
      <path d="M 0 -45 V 45" stroke="#45616d" strokeWidth="12"/>
      {BUILDINGS.map((b,i)=><rect key={i} x={b.x-b.width/2} y={-b.z-b.depth/2} width={b.width} height={b.depth} rx="1" fill={b===OFFICE?"#62e3bd":"#66838b"}/>)}
      <path d={`M ${x} ${-z} L 5 0 L 16 0`} stroke="#ffd38b" strokeWidth="0.6" strokeDasharray="1 1" fill="none"/>
      <circle cx={SWITCH.x} cy={-SWITCH.z} r="1.2" fill="#ffb65f"/>
      {COMPUTERS.map(pc=><circle key={pc.id} cx={pc.x} cy={-pc.z} r="0.7" fill="#153142"/>)}
      {CONTACTS.map(n=><g key={n.id}><circle cx={n.x} cy={-n.z} r="1" fill="#e2b46b"/><text x={n.id==="supplier"?-43:5} y={n.id==="supplier"?-11:11} fill="white" fontSize="2.6">{n.id==="supplier"?"Снабжение · Марат":"Диспетчер · Алина"}</text></g>)}
      <text x="8" y="-26" fill="white" fontSize="2.8">Офис клиента</text>
      <circle cx={x} cy={-z} r="1.4" fill="white" stroke="#132f3d" strokeWidth="0.6"/>
      <text x="8" y="-9" fill="white" fontSize="3">IT-офис №001</text>
      <text x="-43" y="41" fill="white" fontSize="3">● Вы · ● Оборудование в серверной</text>
    </svg><p>Пунктир — ориентир к входу, а не автоматическое движение. Стены и другие здания нужно обходить.</p></>;
}
