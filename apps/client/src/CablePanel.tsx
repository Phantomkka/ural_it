import {useEffect,useState} from 'react';
import {WIRE_EQUIPMENT,cableSpec,cableLength,type CableAction,type PrivateProfile} from '@netcity/shared';
import {DistrictMap} from './DistrictMap';
export function CablePanel({profile,position,sessionId,send,pending,message,retry,ports=[]}:{profile:PrivateProfile|null;position:{x:number;z:number;floor?:number};sessionId?:string;send:(action:CableAction['action'],options?:Pick<CableAction,'sourceId'|'port'>)=>void;pending:boolean;message:string;retry:()=>void;ports?:number[]}){
 const [source,setSource]=useState(WIRE_EQUIPMENT[0].id),[port,setPort]=useState(5),c=profile?.cable,spec=cableSpec(c),held=!!sessionId&&c?.carrier===sessionId;
 useEffect(()=>{send('refresh');const timer=setInterval(()=>send('refresh'),5000);return()=>clearInterval(timer);},[]);
 const free=!c||c.routing==='free',length=c?cableLength([...c.points,held?position:c.endpoint]):0;
 return <section className="cable-panel"><div className="eyebrow">ИНСТРУМЕНТЫ · КАБЕЛЬ</div><h2>Оборудование → SW-01</h2>
 <p>Начните у оборудования, затем подключите второй конец к свободному порту свича в серверной. Маршрут выбираете сами; крепления на поворотах необязательны. Порты 1–4 заняты инфраструктурой офиса.</p>
 {!c&&<label>Источник <select aria-label="Источник кабеля" value={source} onChange={e=>setSource(e.target.value)}>{WIRE_EQUIPMENT.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
 {free&&<label>Порт SW-01 <select aria-label="Порт свича" value={port} onChange={e=>setPort(Number(e.target.value))}>{[5,6,7,8].map(n=><option key={n} value={n} disabled={ports.includes(n)&&c?.port!==n}>{n} · {ports.includes(n)?'занят':'свободен'}</option>)}</select></label>}
 <p>{length.toFixed(1)} м · {held?'бухта в руках':c?.carrier?'бухта у другого сеанса':c?.stage==='TESTED'?'линк проверен':c?.stage==='TERMINATED'?'коннектор установлен':'линия не подключена'}{c?.port?` · порт ${c.port}`:''}</p>
 {!free&&<p>Сохранена линия прежней версии: её можно проверить или убрать у источника. Новая линия будет использовать свободный порт.</p>}
 <div className="case-actions">
 {(!c||c.stage==='PULLING'&&!c.carrier)&&<button disabled={pending||!profile||!!position.floor} onClick={()=>send('take',!c?{sourceId:source}:{})}>{c?'Поднять бухту':'Начать линию у оборудования'}</button>}
 {!c&&<button disabled={pending||!profile||!!position.floor} onClick={()=>send('mission',{sourceId:'active-ticket'})}>Начать у оборудования текущей заявки</button>}
 {held&&<><button disabled={pending} onClick={()=>send('anchor')}>Закрепить здесь</button><button disabled={pending} onClick={()=>send('drop')}>Положить бухту</button><button disabled={pending||free&&ports.includes(port)} onClick={()=>send('terminate',free?{port}:{})}>Подключить к {free?`порту ${port}`:'патч-панели'}</button></>}
 {c?.stage==='TERMINATED'&&<button disabled={pending} onClick={()=>send('test')}>Проверить линк</button>}
 {c&&<button disabled={pending} onClick={()=>send('reset')}>Отключить и убрать линию</button>}
 </div><p role="status">{message}</p>{pending&&<button onClick={retry}>Повторить операцию</button>}
 <details><summary>Расположение концов линии</summary><DistrictMap {...position} destination={!c?WIRE_EQUIPMENT.find(v=>v.id===source):held?spec.target:c.endpoint}/></details>
 <small>Подключение к порту проверяет сервер. Занятый другим инженером разъём использовать нельзя. Новая прокладка пока доступна на первом этаже.</small></section>;
}
