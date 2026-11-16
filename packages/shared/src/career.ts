import {businessStats,type BusinessProgress} from './business.js';
import {CASE_CATALOG,ENGINEERING_CASES} from './caseCatalog.js';
/** Derived from saved work receipts; no reset, duplicate rewards or second career balance. */
export function careerProgress(b:BusinessProgress|undefined,company:{officeId?:string|null;employees?:unknown[];completed?:number}|null){
 const counts=b?.workCounts??{},stats=businessStats(b),done=(ids:string[])=>ids.reduce((n,id)=>n+(counts[id]??0),0),kind=(kinds:string[])=>done([...CASE_CATALOG,...ENGINEERING_CASES].filter(t=>kinds.includes(t.kind)).map(t=>t.id));
 const goal=(name:string,value:number,target:number)=>({name,value:Math.min(value,target),target,complete:value>=target});
 const chapters=[{name:'Стажёр',goals:[goal('Сдать три клиентские работы',stats.total,3),goal('Освоить три направления',stats.distinct,3),goal('Получить полевой мультиметр',Number(!!b?.upgrades.includes('field-kit')),1)]},{name:'Самостоятельный специалист',goals:[goal('Сдать 12 работ',stats.total,12),goal('Освоить шесть направлений',stats.distinct,6),goal('Оборудовать мастерскую',Number(!!b?.upgrades.includes('workbench')),1),goal('Завершить физическую поставку',b?.logistics?.completed??0,1)]},{name:'Владелец IT-фирмы',goals:[goal('Открыть фирму',Number(!!b?.companyCode),1),goal('Арендовать офис',Number(!!company?.officeId),1),goal('Нанять специалиста',company?.employees?.length??0,1),goal('Сдать три совместных SLA',company?.completed??0,3)]}];
 const specialties=[{name:'Системный администратор',count:kind(['power','backup'])},{name:'Сетевой инженер',count:kind(['network','dhcp','dns','wifi'])},{name:'Телефонист',count:kind(['voip'])},{name:'Видеонаблюдение',count:kind(['camera'])},{name:'Серверный инженер',count:kind(['server','storage','ups'])}].map(s=>({...s,rank:s.count>=12?'Эксперт':s.count>=4?'Специалист':s.count?'Практикант':'Нет практики'}));
 return {chapters,specialties,completed:chapters.filter(c=>c.goals.every(g=>g.complete)).length};
}
