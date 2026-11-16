import {CITY_BUILDINGS} from './buildings.js';
import {officeFloorCount} from './officeFloors.js';
import type {CaseKind} from './caseCatalog.js';
import type {ItemId} from './progression.js';

export const COMPANY_ROLES=['Владелец','Диспетчер','Выездной техник','Сетевой инженер','Кладовщик','Инженер'] as const;
export type CompanyRole=typeof COMPANY_ROLES[number];
export interface CompanyMember {id:string;name:string;role:CompanyRole;allowance:number;spent:number}
export const OFFICE_LEASES=[{id:'coworking',name:'Коворкинг IT-офиса',buildingId:'hq',floor:1,x:25,z:4.1,price:100,rent:60,staff:1},...CITY_BUILDINGS.filter(b=>b.id!=='hq').flatMap(b=>Array.from({length:officeFloorCount(b)-1},(_,i)=>({id:b.id+'-floor-'+(i+1),name:b.name+' · этаж '+(i+2),buildingId:b.id,floor:i+1,x:Math.sign(b.x)*25,z:b.z+4.1,price:650+i*150,rent:100+i*20,staff:4})))];
export const STAFF_CATALOG=[
 {id:'support',name:'Вера · поддержка',skill:'Рабочие места и сети',hire:80,wage:40,seconds:12,kinds:['network','wifi','printer','power'] as CaseKind[]},
 {id:'network',name:'Антон · сетевой инженер',skill:'VLAN / DHCP / DNS / SIP',hire:180,wage:70,seconds:15,kinds:['network','wifi','dhcp','dns','voip','camera'] as CaseKind[]},
 {id:'systems',name:'Нина · системный инженер',skill:'Серверы, диски и резервные копии',hire:260,wage:90,seconds:18,kinds:['server','backup','storage','ups'] as CaseKind[]},
] as const;
export const SLA_CATALOG=[
 {id:'network-care',name:'Абонентское обслуживание сети',reputation:0,payment:350,kinds:['network','wifi','dhcp','dns'] as CaseKind[]},
 {id:'workplace-care',name:'Рабочие места и телефония',reputation:1,payment:420,kinds:['printer','power','voip'] as CaseKind[]},
 {id:'infrastructure-care',name:'Инфраструктурный SLA',reputation:3,payment:650,kinds:['server','backup','storage','ups','camera'] as CaseKind[]},
] as const;
export interface CompanyEmployee {id:string;type:string;hiredAt:number}
export interface CompanySLA {id:string;templateId:string;caseTemplateId:string;startedAt:number;status:'ACTIVE'|'COMPLETE';expense:number;staffWork?:{employeeId:string;readyAt:number;wage:number};receipt?:{caseId:string;memberId:string;satisfaction:number};completedAt?:number}
export interface CompanyLedgerEntry {id:string;at:number;kind:string;label:string;amount:number;balance:number;actor:string}
export interface EnterpriseCompany {deliveries?:number;id:string;code:string;name:string;owner:string;members:Record<string,CompanyMember>;wallet:number;officeId:string|null;employees:CompanyEmployee[];stock:Record<string,number>;sla?:CompanySLA;payouts:Record<string,number>;ledger:CompanyLedgerEntry[];completed:number;satisfactionTotal:number;invites:boolean;createdAt:number;revision:number}
export interface CompanyViewState {deliveries:number;code:string;name:string;myRole:CompanyRole;myMemberId:string;wallet:number;reserved:number;myPayout:number;officeId:string|null;employees:CompanyEmployee[];members:CompanyMember[];stock:Record<string,number>;sla?:CompanySLA;ledger:CompanyLedgerEntry[];completed:number;rating:number;invites:boolean;revision:number}
export function enterpriseView(c:EnterpriseCompany,profileId:string):CompanyViewState{return {deliveries:c.deliveries??0,code:c.code,name:c.name,myRole:c.members[profileId].role,myMemberId:c.members[profileId].id,wallet:c.wallet,reserved:Object.values(c.payouts).reduce((n,a)=>n+a,0),myPayout:c.payouts[profileId]??0,officeId:c.officeId,employees:structuredClone(c.employees),members:structuredClone(Object.values(c.members)),stock:structuredClone(c.stock),sla:c.sla?structuredClone(c.sla):undefined,ledger:structuredClone(c.ledger),completed:c.completed,rating:c.completed?Math.min(5,Math.round(c.satisfactionTotal/c.completed/3*50)/10):5,invites:c.invites,revision:c.revision};}
export type CompanyIntent={action:'returnStock'|'procureDelivery'|'create'|'join'|'refresh'|'deposit'|'withdraw'|'role'|'allowance'|'invites'|'leave'|'rent'|'hire'|'fire'|'purchase'|'checkout'|'acceptSLA'|'assign'|'report'|'signoff'|'payout';code?:string;name?:string;choice?:string;amount?:number;target?:string};
export type CompanyAction=CompanyIntent&{requestId:string};
export function validCompany(c:EnterpriseCompany){const integer=(v:number)=>Number.isSafeInteger(v)&&v>=0&&v<=2147483647,members=Object.values(c.members);return /^[A-F0-9]{12}$/.test(c.code)&&c.name.length>=3&&c.name.length<=40&&integer(c.wallet)&&integer(c.completed)&&integer(c.satisfactionTotal)&&integer(c.revision)&&members.length>=1&&members.length<=5&&c.members[c.owner]?.role==='Владелец'&&members.filter(m=>m.role==='Владелец').length===1&&new Set(members.map(m=>m.id)).size===members.length&&members.every(m=>COMPANY_ROLES.includes(m.role)&&integer(m.allowance)&&integer(m.spent))&&(c.officeId===null||OFFICE_LEASES.some(l=>l.id===c.officeId))&&c.employees.length<=4&&new Set(c.employees.map(e=>e.id)).size===c.employees.length&&c.employees.every(e=>STAFF_CATALOG.some(s=>s.id===e.type))&&Object.keys(c.stock).length<=32&&Object.values(c.stock).every(n=>integer(n)&&n<=99)&&Object.values(c.payouts).every(integer)&&Object.values(c.payouts).reduce((n,a)=>n+a,0)<=c.wallet&&c.ledger.length<=80&&c.ledger.every(e=>Number.isSafeInteger(e.amount)&&integer(e.balance));}
