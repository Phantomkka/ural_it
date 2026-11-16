import type {CaseKind,CaseTemplate} from './caseCatalog.js';
import type {ItemId} from './progression.js';

export const LAB_INSTRUMENTS={
 link:'Кабель / порт коммутатора',ping:'Ping / потери',trace:'Traceroute',ip:'IP / DHCP / DNS',wifi:'Радиоэфир / каналы',smart:'SMART / диски',memory:'Тест RAM',thermal:'Температуры / вентиляторы',voltage:'Питание / напряжения',printer:'Очередь и механика печати',sip:'PBX / SIP / voice VLAN',camera:'PoE / поток камеры',backup:'Файлы / резервные копии',battery:'ИБП / нагрузка / батарея',
} as const;
export type LabInstrument=keyof typeof LAB_INSTRUMENTS;
export const LAB_FAULTS={
 cable:'Повреждён физический кабель',vlan:'Порт находится в неверной VLAN',leases:'Исчерпан пул DHCP',dns:'Устаревшая запись DNS',radio:'Помехи на канале Wi-Fi',disk:'Неисправный диск зеркала',ram:'Ошибка модуля оперативной памяти',heat:'Нарушено охлаждение',jam:'Замятие и износ картриджа',queue:'Очередь печати приостановлена',sip:'Неверные параметры голосовой сети',camera:'Повреждена линия камеры',backup:'Повреждён файл, нужен проверенный снимок',battery:'Изношена батарея ИБП',power:'Неисправен блок питания',
} as const;
export type LabFault=keyof typeof LAB_FAULTS;
export interface LabReading {instrument:LabInstrument;revision:number;at:number;healthy:boolean;rows:{label:string;value:string}[]}
export interface LabSite {vlan:number;poolStart:number;poolEnd:number;channel:number;host:string;address:string;sipHost:string;file:string;disk:number}
export interface DiagnosticLab {notes?:Record<string,string>;revision:number;readings:Partial<Record<LabInstrument,LabReading>>;settings:Record<string,string|number>;busyUntil:number;site?:LabSite;requiredPart?:ItemId|null;hypothesis?:LabFault}
export const freshLab=():DiagnosticLab=>({revision:0,readings:{},settings:{},busyUntil:0});
export const LAB_REQUIRED:Record<CaseKind,LabInstrument[]>={network:['link','ping'],dhcp:['ip','ping'],dns:['ip','trace'],wifi:['wifi','ping'],power:['voltage','memory'],server:['thermal','memory'],printer:['printer','link'],voip:['sip','ip'],camera:['camera','link'],backup:['backup','smart'],ups:['battery','voltage'],storage:['smart','backup']};
export function engineeringCases(base:readonly CaseTemplate[]):CaseTemplate[]{
 return (Object.keys(LAB_REQUIRED) as CaseKind[]).map(kind=>{const t=base.find(t=>t.kind===kind)!;return {...t,id:'engineering-'+kind,title:'Инженерный аудит: '+t.title,lab:true,symptom:({network:'Один терминал не видит рабочее приложение; соседние работают.',server:'Сервер под нагрузкой завершает задачи с ошибкой.',printer:'Документы остаются в очереди, печать не заканчивается.'} as Partial<Record<CaseKind,string>>)[kind]??t.symptom,advance:t.advance,payment:t.payment+90,xp:t.xp+55,questions:{...t.questions,changed:'Сбой повторяется. Мы не уверены в причине; сначала снимите показания оборудования.',lights:'Журналы доступны через диагностический стенд планшета.',scope:'Согласованные параметры площадки находятся в карточке аудита. Работайте без потери данных.'}};});
}
