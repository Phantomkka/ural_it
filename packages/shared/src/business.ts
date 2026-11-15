import {CASE_CATALOG} from './caseCatalog.js';
export interface BusinessProgress {upgrades:string[];claimed:string[];workCounts:Record<string,number>;cableCertified?:boolean}
export function businessStats(b:BusinessProgress|undefined){const counts=b?.workCounts??{};return {total:Object.values(counts).reduce((n,v)=>n+v,0),distinct:new Set(Object.entries(counts).filter(([,n])=>n>0).map(([id])=>CASE_CATALOG.find(t=>t.id===id)?.kind??({'crew-security':'camera','crew-network':'network','crew-renewal':'server'} as Record<string,string>)[id]??id)).size};}
export const BUSINESS_UPGRADES=[
 {id:'field-kit',name:'Полевой мультиметр',price:150,reputation:1,description:'Диагностика питания ПК и механики принтера.'},
 {id:'workbench',name:'Мастерская и стенд резервирования',price:450,reputation:3,description:'Серверные заказы и восстановление данных; +10% к оплате работ.'},
 {id:'service-van',name:'Складской фургон и выездной комплект',price:1000,reputation:6,description:'Выезды на склад, камеры и телефония; рюкзак 18 кг.'},
 {id:'network-lab',name:'Сетевая лаборатория',price:900,reputation:8,description:'Аудит DHCP, DNS и сложные сетевые заявки.'},
 {id:'infra-lab',name:'Инфраструктурная лаборатория',price:1400,reputation:12,description:'Обслуживание ИБП и восстановление дисковых массивов.'},
] as const;
export const BUSINESS_CONTRACTS=[
 {id:'first-clients',name:'Первые клиенты',distinct:3,total:3,credits:300,xp:120},
 {id:'reliable-office',name:'Надёжный офис',distinct:6,total:6,credits:600,xp:240},
 {id:'district-service',name:'Районная служба',distinct:6,total:12,credits:1000,xp:400},
 {id:'infrastructure-expert',name:'Эксперт инфраструктуры',distinct:12,total:24,credits:2000,xp:800},
 {id:'beta-season',name:'Оператор всего района',distinct:12,total:60,credits:4000,xp:1500},
 {id:'city-partner',name:'Партнёр Новолинска',distinct:8,total:32,credits:1200,xp:480},
] as const;
export const freshBusiness=():BusinessProgress=>({upgrades:[],claimed:[],workCounts:{}});
