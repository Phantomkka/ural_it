import {LAB_INSTRUMENTS,LAB_REQUIRED,freshLab,type CaseTemplate,type ClientCase,type LabFault,type LabInstrument,type ProgressResult,type ItemId} from '@netcity/shared';
import type {Transaction} from './store.js';

const good=(message:string):ProgressResult=>({ok:true,message}),bad=(message:string):ProgressResult=>({ok:false,message});
const serial=(id:string)=>[...id].reduce((sum,ch)=>((sum*31+ch.charCodeAt(0))>>>0),0);
export function labFault(c:ClientCase,t:CaseTemplate):LabFault {
 const variant=serial(c.id)%2;
 return ({network:variant?'vlan':'cable',dhcp:'leases',dns:'dns',wifi:'radio',power:'power',server:variant?'ram':'heat',printer:variant?'queue':'jam',backup:'backup',camera:'camera',voip:'sip',ups:'battery',storage:'disk'} as const)[t.kind];
}
export function labPart(c:ClientCase,t:CaseTemplate):ItemId|null{const parts:Partial<Record<LabFault,ItemId>>={cable:'patch_cord',power:'power_supply',heat:'cleaner',jam:'toner',camera:'patch_cord',battery:'ups_battery',disk:'ssd'};return parts[labFault(c,t)]??null;}
export function labSite(c:ClientCase,t:CaseTemplate){const n=serial(c.id)%8+1;return {vlan:20+n*10,poolStart:50,poolEnd:150,channel:n%2?6:11,host:`portal-${n}.netcity.local`,address:`10.80.${n}.20`,sipHost:`pbx-${n}.netcity.local`,file:n%2?'clients.csv':'contracts.db',disk:1};}
export function initLab(c:ClientCase,t:CaseTemplate){
 if(c.lab)return c.lab;
 const site=labSite(c,t);c.lab={...freshLab(),site,settings:{vlan:1,poolStart:10,poolEnd:20,channel:1,address:`10.80.99.10`,sipHost:'old-pbx.netcity.local'}};
 return c.lab;
}
function resolved(c:ClientCase,t:CaseTemplate){const f=labFault(c,t),l=initLab(c,t),s=labSite(c,t),q=c.progress??{};
 if(f==='vlan')return l.settings.vlan===s.vlan;
 if(f==='leases')return l.settings.poolStart===s.poolStart&&l.settings.poolEnd===s.poolEnd;
 if(f==='dns')return l.settings.address===s.address;
 if(f==='radio')return l.settings.channel===s.channel;
 if(f==='sip')return l.settings.vlan===s.vlan&&l.settings.sipHost===s.sipHost;
 if(f==='queue')return l.settings.queue==='running';
 if(f==='ram')return l.settings.ram==='reseated';
 if(f==='backup')return l.settings.restored===s.file;
 if(f==='disk')return !!q.storageTest;
 if(f==='battery')return !!q.upsTest;
 if(f==='camera')return ['REPAIRED','VERIFIED','COMPLETED'].includes(c.stage)&&!!q.labInstalled;
 return ['REPAIRED','VERIFIED','COMPLETED'].includes(c.stage)&&!!q.labInstalled;
}
/** Fixed virtual instruments only; no shell, URL fetch or user string evaluation. */
export function labMeasurement(c:ClientCase,t:CaseTemplate,instrument:LabInstrument,now:number){
 const l=initLab(c,t),f=labFault(c,t),s=labSite(c,t),fixed=resolved(c,t),broken=(...faults:LabFault[])=>!fixed&&faults.includes(f);
 const row=(label:string,value:string|number)=>({label,value:String(value)});
 let rows:{label:string;value:string}[]=[],healthy=true;
 if(instrument==='link'){healthy=!broken('cable','vlan','camera');rows=[row('Порт','SW-01 / Gi0/3'),row('Линк',broken('cable','camera')?'DOWN · 0 Мбит/с':'UP · 1000 Мбит/с'),row('VLAN',broken('vlan')?l.settings.vlan:s.vlan),row('Кабель',broken('cable','camera')?'Обрыв пары 3–6 на 4.2 м':'4 пары · PASS')];}
 if(instrument==='ping'){healthy=!broken('cable','vlan','camera','leases','radio','sip');rows=[row('Шлюз',broken('leases')?'169.254.0.0 / нет маршрута':'10.80.0.1'),row('Ответы',healthy?'4/4 · 1, 2, 1, 2 мс':broken('radio')?'2/4 · 80, timeout, 180, timeout мс':'0/4 · timeout'),row('Потери',healthy?'0%':broken('radio')?'50%':'100%')];}
 if(instrument==='trace'){healthy=!broken('dns','vlan','cable','leases');rows=[row('По адресу',broken('cable','vlan','leases')?'1 * * *':`1 10.80.0.1 / 1 мс → 2 ${s.address} / 2 мс`),row('По имени',broken('dns')?`${s.host} → 10.80.99.10 / узел недоступен`:healthy?`${s.host} → ${s.address} / доступен`:'Нет маршрута')];}
 if(instrument==='ip'){healthy=!broken('leases','dns','sip','vlan');rows=[row('IPv4',broken('leases')?'169.254.18.40 / 16':'10.80.0.52 / 24'),row('DHCP',broken('leases')?`Пул ${l.settings.poolStart}–${l.settings.poolEnd}, свободно 0`:`Пул ${s.poolStart}–${s.poolEnd}, свободно 84`),row('DNS A',`${s.host} → ${broken('dns')?l.settings.address:s.address}`),row('VLAN',broken('vlan','sip')?l.settings.vlan:s.vlan)];}
 if(instrument==='wifi'){healthy=!broken('radio');rows=[row('RSSI','−51 dBm'),row('Текущий канал',broken('radio')?l.settings.channel:s.channel),...([1,6,11].map(channel=>row('Занятость канала '+channel,channel===s.channel?'8%':channel===1?'94%':'77%'))),row('Повторы',healthy?'1%':'47%')];}
 if(instrument==='smart'){healthy=!broken('disk');rows=[row('Диск 0','PASSED · reallocated 0 · 34 °C'),row('Диск 1',broken('disk')?'FAILED · pending 184 · uncorrectable 92':'PASSED · pending 0 · 33 °C'),row('Массив',healthy?'MIRROR / healthy':'MIRROR / degraded')];}
 if(instrument==='memory'){healthy=!broken('ram');rows=[row('Модуль A','8192 MB · PASS / 4 прохода'),row('Модуль B',broken('ram')?'8192 MB · 64 ошибки адреса 0x0040':'8192 MB · PASS / 4 прохода'),row('POST',broken('power')?'Нет питания, тест не запущен':'Завершён')];if(broken('power'))healthy=false;}
 if(instrument==='thermal'){healthy=!broken('heat');rows=[row('CPU',healthy?'48 °C':'93 °C / throttling'),row('Вентилятор',healthy?'1640 rpm':'340 rpm / забит фильтр'),row('Нагрузка','80%'),row('RAM',broken('ram')?'ECC: 64 ошибки':'ECC: 0 ошибок')];}
 if(instrument==='voltage'){healthy=!broken('power','battery');rows=[row('Сеть','230 В'),row('+12 В',broken('power')?'8.1 В / вне допуска':'12.08 В'),row('+5 В',broken('power')?'3.2 В / вне допуска':'5.02 В'),row('Состояние',broken('battery')?'Батарея не держит нагрузку':healthy?'Стабильно':'Не включать оборудование')];}
 if(instrument==='printer'){healthy=!broken('jam','queue');rows=[row('Очередь',broken('queue')?'PAUSED / 12 заданий':broken('jam')?'BLOCKED / 12 заданий':'READY / 0 заданий'),row('Тракт',broken('jam')?'JAM / датчик P2':'FREE'),row('Тонер',broken('jam')?'3%':'86%'),row('Тестовая страница',healthy?'PASS / без полос':'Не напечатана')];}
 if(instrument==='sip'){healthy=!broken('sip');rows=[row('REGISTER',healthy?'200 OK / expires 3600':'408 timeout'),row('Voice VLAN',healthy?s.vlan:l.settings.vlan),row('АТС',healthy?s.sipHost:l.settings.sipHost),row('RTP',healthy?'Два направления / потери 0%':'Нет медиапотока')];}
 if(instrument==='camera'){healthy=!broken('camera');rows=[row('PoE','48 В / 6.2 Вт'),row('Ethernet',healthy?'100 Мбит/с':'DOWN'),row('Поток',healthy?'1920×1080 / 25 fps':'Недоступен'),row('Запись',healthy?'Тестовый фрагмент прочитан':'Нет кадров')];}
 if(instrument==='backup'){healthy=!broken('backup');rows=['clients.csv','contracts.db','inventory.json'].map(file=>row(file,broken('backup')&&file===s.file?'SHA256 MISMATCH':'SHA256 OK'));rows.push(row('Снимок','Вчера 22:00 / проверен / чтение разрешено'));}
 if(instrument==='battery'){healthy=!broken('battery');rows=[row('Заряд',healthy?'100%':'18%'),row('Нагрузка',healthy?'46%':'108%'),row('Автономность',healthy?'24 мин':'0 мин'),row('Самотест',healthy?'PASS':'REPLACE BATTERY')];}
 return {instrument,revision:l.revision,at:now,healthy,rows};
}
export function performLab(tx:Transaction,c:ClientCase,t:CaseTemplate,a:Record<string,unknown>,now:number):ProgressResult|null{
 const l=initLab(c,t),s=labSite(c,t),f=labFault(c,t);
 if(!['measure','configure','diagnose','verify'].includes(String(a.action)))return null;
 if(!['INTERVIEW','DIAGNOSED','REPAIRED','VERIFIED'].includes(c.stage))return bad('Сначала примите заявку и поговорите с клиентом.');
 if(now<l.busyUntil)return bad('Прибор выполняет предыдущую операцию. Подождите.');
 if(a.action==='measure'){
  if(typeof a.choice!=='string'||!Object.hasOwn(LAB_INSTRUMENTS,a.choice))return bad('Выберите виртуальный прибор из списка.');
  const instrument=a.choice as LabInstrument;l.readings[instrument]=labMeasurement(c,t,instrument,now);l.busyUntil=now+350;return good(LAB_INSTRUMENTS[instrument]+': показания записаны в журнал.');
 }
 if(a.action==='diagnose'){
  if(c.stage!=='INTERVIEW'||c.clues.length<2)return bad('Сначала задайте клиенту два разных вопроса.');
  if(!LAB_REQUIRED[t.kind].every(i=>l.readings[i]?.revision===l.revision))return bad('Снимите все обязательные показания для текущей конфигурации.');
  if(a.choice!==f){c.satisfaction=Math.max(1,c.satisfaction-1);l.busyUntil=now+1500;return bad('Гипотеза не соответствует измерениям. Время потрачено, удовлетворённость снижена. Повторите анализ.');}
  l.hypothesis=f;l.requiredPart=labPart(c,t);
  c.stage='DIAGNOSED';return good('Причина подтверждена измерениями. Выполните безопасный ремонт и снимите новые показания.');
 }
 if(a.action==='configure'){
  if(!['DIAGNOSED','REPAIRED'].includes(c.stage))return bad('Сначала установите причину по измерениям.');
  const [key,raw,end,...extra]=String(a.choice??'').split(':');if(extra.length)return bad('Некорректная настройка.');
  let correct=false;
  if(['vlan','sip'].includes(f)&&key==='vlan'&&/^\d{1,4}$/.test(raw)&&Number(raw)>=1&&Number(raw)<=4094&&!end){l.settings.vlan=Number(raw);correct=l.settings.vlan===s.vlan;}
  else if(f==='leases'&&key==='dhcp'&&/^\d{1,3}$/.test(raw)&&/^\d{1,3}$/.test(end)&&Number(raw)>=50&&Number(end)<=254&&Number(raw)<Number(end)){l.settings.poolStart=Number(raw);l.settings.poolEnd=Number(end);correct=Number(raw)===s.poolStart&&Number(end)===s.poolEnd;}
  else if(f==='dns'&&key==='dns'&&/^(?:\d{1,3}\.){3}\d{1,3}$/.test(raw)&&raw.split('.').every(n=>Number(n)<=255)&&!end){l.settings.address=raw;correct=raw===s.address;}
  else if(f==='radio'&&key==='channel'&&['1','6','11'].includes(raw)&&!end){l.settings.channel=Number(raw);correct=Number(raw)===s.channel;}
  else if(f==='sip'&&key==='sip'&&/^[a-z0-9.-]{1,48}$/.test(raw)&&!end){l.settings.sipHost=raw;correct=raw===s.sipHost;}
  else if(f==='queue'&&key==='queue'&&raw==='resume'&&!end){l.settings.queue='running';correct=true;}
  else if(f==='ram'&&key==='ram'&&raw==='reseat'&&!end){if(!c.progress?.shutdown)return bad('Сначала штатно остановите сервер.');l.settings.ram='reseated';correct=true;}
  else if(f==='backup'&&key==='restore'&&['clients.csv','contracts.db','inventory.json'].includes(raw)&&end==='snapshot'){l.settings.restored=raw;correct=raw===s.file;}
  else return bad('Настройка не подходит этому устройству или выходит за безопасные границы.');
  l.revision++;l.busyUntil=now+700;if(!correct)c.satisfaction=Math.max(1,c.satisfaction-1);c.stage=resolved(c,t)?'REPAIRED':'DIAGNOSED';
  return good(correct?'Настройка применена. Повторите измерения.':'Настройка применена, но неисправность осталась. Сопоставьте параметры с паспортом площадки.');
 }
 if(c.stage!=='REPAIRED'||!resolved(c,t))return bad('Сначала устраните причину и завершите специальные тесты ремонта.');
 if(t.kind==='camera'){if(tx.data.cable?.kind!=='camera'||tx.data.cable.caseId!==c.id||tx.data.cable.stage!=='TESTED')return bad('Монтажная линия изменилась. Проложите и проверьте её повторно.');(c.progress??={}).verifiedCable=tx.data.cable.id;}
 if(!LAB_REQUIRED[t.kind].every(i=>l.readings[i]?.revision===l.revision&&l.readings[i]?.healthy))return bad('Нужны исправные показания всех обязательных приборов после последнего изменения.');
 c.stage='VERIFIED';return good('Акт диагностики: контрольные показания исправны, можно сдавать работу клиенту.');
}
