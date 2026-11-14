import {createHash} from 'node:crypto';
import {BUSINESS_CONTRACTS,BUSINESS_UPGRADES,freshBusiness,companyFromProgress,type ProgressResult} from '@netcity/shared';
import type {ProfileData,ProgressStore} from './store.js';
export function initBusiness(data:ProfileData){
  if(data.business)return data.business;
  const b=data.business=freshBusiness();for(const c of data.service?.cases??[])if(c.stage==='COMPLETED')b.workCounts[c.templateId]=(b.workCounts[c.templateId]??0)+1;
  const known=Object.values(b.workCounts).reduce((n,v)=>n+v,0),oldTotal=data.service?.completed??0;if(oldTotal>known)b.workCounts['moved-desks']=(b.workCounts['moved-desks']??0)+oldTotal-known;
  if(data.cable?.stage==='TESTED'&&!data.cable.kind)b.cableCertified=true;return b;
}
const fail=(message:string):ProgressResult=>({ok:false,message});
export class BusinessService {
 constructor(private store:ProgressStore){}
 command(profileId:string,value:unknown,nearShop:()=>boolean){
  const a=value as Record<string,unknown>;if(!a||!['upgrade','claim'].includes(String(a.action))||typeof a.id!=='string'||a.id.length>32||typeof a.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(a.requestId)||Object.keys(a).some(k=>!['action','id','requestId'].includes(k)))return Promise.resolve({result:fail('Некорректная операция компании.'),data:null});
  const fingerprint=createHash('sha256').update(JSON.stringify(['business',a.action,a.id])).digest('hex');
  return this.store.transaction(profileId,a.requestId,tx=>{
   if(tx.operation)return tx.operation.fingerprint===fingerprint?{...tx.operation.result,replayed:true}:fail('Ключ операции уже использован.');
   const b=initBusiness(tx.data);let result:ProgressResult;
   if(a.action==='upgrade'){
    const i=BUSINESS_UPGRADES.findIndex(u=>u.id===a.id),u=BUSINESS_UPGRADES[i];
    if(!u)result=fail('Неизвестное улучшение.');
    else if(!nearShop())result=fail('Оформите улучшение у Марата.');
    else if(b.upgrades.includes(u.id))result=fail('Улучшение уже приобретено.');
    else if(companyFromProgress(tx.data).reputation<u.reputation||i>0&&!b.upgrades.includes(BUSINESS_UPGRADES[i-1].id))result=fail('Сначала выполните предыдущие цели компании.');
    else if(tx.data.credits<u.price)result=fail('Недостаточно NET. Получите оплату контрактов компании.');
    else {tx.data.credits-=u.price;b.upgrades.push(u.id);result={ok:true,message:'Приобретено: '+u.name};}
   }else{
    const c=BUSINESS_CONTRACTS.find(c=>c.id===a.id),total=Object.values(b.workCounts).reduce((n,v)=>n+v,0),distinct=Object.values(b.workCounts).filter(v=>v>0).length;
    if(!c||b.claimed.includes(c.id)||total<c.total||distinct<c.distinct)result=fail('Контракт ещё не выполнен или уже оплачен.');
    else {const hash=createHash('sha256').update(profileId+':business:'+c.id).digest('hex').slice(0,32),jobId=[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20)].join('-');b.claimed.push(c.id);tx.data.credits+=c.credits;tx.data.xp+=c.xp;tx.reward={jobId,credits:c.credits,xp:c.xp};result={ok:true,message:`Контракт «${c.name}» оплачен: +${c.credits} NET.`};}
   }
   tx.saveOperation={fingerprint,result};return result;
  });
 }
}
