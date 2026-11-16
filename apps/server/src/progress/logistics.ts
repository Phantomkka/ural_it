import {createHash,randomUUID} from 'node:crypto';
import {DELIVERY_CATALOG,FREIGHT_PRODUCTS,FREIGHT_SHOP,ITEM_WEIGHT,bagUsage,vanBoot,vanCapacity,insideBuilding,caseTemplate,type ItemId,type WorkVan,type VanPose,type VanAction,type ProgressResult} from '@netcity/shared';
import type {ProgressStore} from './store.js';
import {initBusiness} from './business.js';
import {appendCompanyLedger} from './enterprise.js';

export interface VanActor {x:number;z:number;sessionId:string;floor:number;heldItem:string;vehicleId:string}
export interface VanContext {actor:VanActor|null;van?:WorkVan;parking?:VanPose;exit?:{x:number;z:number};blocked?:boolean}
const fail=(message:string):ProgressResult=>({ok:false,message}),ok=(message:string):ProgressResult=>({ok:true,message});
export class LogisticsService {
 constructor(private store:ProgressStore,private now=Date.now){}
 async command(profileId:string,value:unknown,context:()=>VanContext){
  const a=value as Partial<VanAction>|null;
  if(!a||typeof a!=='object'||!['request','enter','exit','loadCase','unloadCase','order','collect','drop','load','unload','install','test','signoff'].includes(String(a.action))||typeof a.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(a.requestId)||(a.choice!==undefined&&(typeof a.choice!=='string'||a.choice.length>64))||Object.keys(a).some(k=>!['action','choice','requestId'].includes(k)))return Promise.resolve({result:fail('Некорректная операция транспорта.'),data:null});
  const fingerprint=createHash('sha256').update(JSON.stringify(['logistics',a.action,a.choice])).digest('hex');
  const prior=await this.store.read(profileId),companyCode=prior.business?.logistics?.delivery?.companyCode;
  return this.store.transaction(profileId,a.requestId,tx=>{
   if(tx.operation)return tx.operation.fingerprint===fingerprint?{...tx.operation.result,replayed:true}:fail('Ключ операции уже использован.');
   const ctx=context(),p=ctx.actor,b=initBusiness(tx.data),l=b.logistics??={completed:0},v=ctx.van,capacity=vanCapacity(b.upgrades.includes('service-van'));
   const near=(point:{x:number;z:number},radius=2.8)=>!!p&&Math.hypot(p.x-point.x,p.z-point.z)<=radius;
   const handsFree=()=>!!p&&!p.heldItem;
   const boot=()=>!!v&&!!l.van&&v.id===l.van.id&&!v.driver&&Math.abs(v.speed)<.15&&near(vanBoot(v));
   const savePose=()=>{if(l.van&&v)l.van.pose={x:v.x,z:v.z,yaw:v.yaw,speed:0};};
   const cargoUsage=()=>{const delivery=l.delivery,product=delivery&&DELIVERY_CATALOG.find(t=>t.id===delivery.templateId)?.product,loaded=delivery?.location==='van';return {weight:(l.van?.cargo.reduce((n,c)=>n+c.weight,0)??0)+(loaded&&product?FREIGHT_PRODUCTS[product].weight:0),slots:(l.van?.cargo.length??0)+Number(loaded)};};
   const perform=():ProgressResult=>{
    if(!p||p.floor)return fail('Транспорт и груз доступны на улице и первом этаже.');
    if(ctx.blocked)return fail('Ваш фургон используется в другом подключении. Завершите поездку там.');
    if(l.delivery?.companyCode&&l.delivery.stage!=='COMPLETE'&&(!tx.company||!tx.company.members[profileId]||b.companyCode!==l.delivery.companyCode))return fail('Корпоративный груз доступен только участнику фирмы.');
    if(a.action==='request'){
     if(l.van)return ok('Фургон уже закреплён за вами. Его положение указано на GPS.');
     if(!ctx.parking)return fail('Все служебные парковки заняты. Попробуйте позже.');
     l.van={id:randomUUID(),pose:{...ctx.parking,speed:0},cargo:[]};return ok('Выдан служебный фургон. Подойдите к водительской двери.');
    }
    if(a.action==='enter'){
     if(!v||!l.van||v.id!==l.van.id||v.driver||!handsFree()||p.vehicleId||!near(v,3.1))return fail('Подойдите к своему свободному фургону со свободными руками.');
     savePose();return ok('За рулём: W/S — газ и торможение, A/D — руль. На телефоне используйте джойстик.');
    }
    if(a.action==='exit'){
     if(!v||v.driver!==p.sessionId||p.vehicleId!==v.id||Math.abs(v.speed)>.15)return fail('Сначала полностью остановите свой фургон.');
     if(!ctx.exit)return fail('Дверь заблокирована. Перепаркуйтесь.');savePose();return ok('Двигатель остановлен. Вы вышли из фургона.');
    }
    if(p.vehicleId)return fail('Остановитесь и выйдите из фургона для работы с грузом.');
    if(a.action==='loadCase'){
     const c=tx.data.service?.cases.at(-1),part=c&&importPart(c.templateId);
     if(!boot()||!c?.carrying||c.carrier!==p.sessionId||c.stage!=='DIAGNOSED'||!part||c.progress?.inVan)return fail('Подойдите к багажнику своего фургона с деталью заявки.');
     const usage=cargoUsage(),weight=ITEM_WEIGHT[part];if(usage.slots>=capacity.slots||usage.weight+weight>capacity.weight)return fail('В фургоне нет места по весу или слотам.');
     l.van!.cargo.push({companyCode:typeof c.progress?.companyIssued==='string'?c.progress.companyIssued:undefined,id:randomUUID(),caseId:c.id,part,weight});(c.progress??={}).inVan=l.van!.id;c.carrying=false;c.carrier=undefined;c.carryOrigin=undefined;savePose();return ok('Деталь закреплена в багажнике. Руки свободны.');
    }
    if(a.action==='unloadCase'){
     if(!boot()||!handsFree())return fail('Подойдите к багажнику со свободными руками.');
     const cargo=l.van!.cargo.find(item=>item.id===a.choice);if(!cargo)return fail('Такого груза нет в вашем фургоне.');
     const c=tx.data.service?.cases.find(c=>c.id===cargo.caseId);
     if(c?.stage==='DIAGNOSED'&&!c.carrying&&c.progress?.inVan===l.van!.id){delete c.progress.inVan;c.carrying=true;c.carrier=p.sessionId;c.carryOrigin={x:p.x,z:p.z};}
     else {if(cargo.companyCode&&cargo.companyCode!==b.companyCode)return fail('Корпоративный материал принадлежит другой фирме.');if(bagUsage(tx.data.inventory).weight+cargo.weight>(b.upgrades.includes('service-van')?18:12))return fail('В рюкзаке недостаточно места.');tx.data.inventory[cargo.part]++;if(cargo.companyCode){b.companyStock??={};b.companyStock[cargo.part]=(b.companyStock[cargo.part]??0)+1;}if(c?.progress)delete c.progress.inVan;}
     l.van!.cargo=l.van!.cargo.filter(item=>item.id!==cargo.id);savePose();return ok('Деталь выгружена.');
    }
    if(a.action==='order'){
     const t=DELIVERY_CATALOG.find(t=>t.id===a.choice);if(!t||l.delivery&&l.delivery.stage!=='COMPLETE')return fail('Сначала завершите текущую поставку.');
     if(!near(FREIGHT_SHOP)||!l.van||!v)return fail('Оформите поставку у Марата после получения фургона.');
     if(!handsFree())return fail('Для оформления поставки нужны свободные руки.');
     const product=FREIGHT_PRODUCTS[t.product],fee=t.prepaid?0:product.price;
     if(product.weight>capacity.weight)return fail('Для тяжёлого комплекта нужен собственный складской фургон.');
     if(tx.data.credits<fee)return fail('Недостаточно NET на закупку. Начните с оплаченной клиентом учебной поставки.');
     tx.data.credits-=fee;l.delivery={id:randomUUID(),templateId:t.id,stage:'ORDERED',availableAt:this.now()+2000,location:'supplier',...FREIGHT_SHOP,transported:false};return ok(`Заказ оформлен: ${fee} NET. Комплект выдадут через две секунды.`);
    }
    const order=l.delivery,t=order&&DELIVERY_CATALOG.find(t=>t.id===order.templateId);
    if(!order||!t||order.stage==='COMPLETE')return fail('Нет активной поставки. Выберите заказ у Марата.');
    const product=FREIGHT_PRODUCTS[t.product];
    if(a.action==='collect'){
     if(order.stage!=='ORDERED'||!['supplier','ground'].includes(order.location)||!handsFree()||!near(order)||this.now()<order.availableAt)return fail('Подойдите к готовому комплекту со свободными руками.');
     order.location='hands';order.carrier=p.sessionId;order.x=p.x;order.z=p.z;return ok(product.weight>20?'Тяжёлый комплект в руках. Перенос медленнее, спринт недоступен.':'Комплект в руках. Погрузите его в фургон.');
    }
    if(a.action==='drop'){
     if(order.location!=='hands'||order.carrier!==p.sessionId)return fail('В этом сеансе нет комплекта в руках.');order.location='ground';order.carrier=undefined;order.x=p.x;order.z=p.z;return ok('Комплект поставлен на землю. Его положение сохранено.');
    }
    if(a.action==='load'){
     if(!boot()||order.location!=='hands'||order.carrier!==p.sessionId)return fail('Подойдите с комплектом к багажнику своего фургона.');
     const usage=cargoUsage();if(usage.slots>=capacity.slots||usage.weight+product.weight>capacity.weight)return fail('Превышена грузоподъёмность или число слотов.');
     order.location='van';order.carrier=undefined;order.vanId=v!.id;order.loadedAt={x:v!.x,z:v!.z};savePose();return ok('Комплект закреплён в багажнике. Можно садиться за руль.');
    }
    if(a.action==='unload'){
     if(!boot()||!handsFree()||order.location!=='van'||order.vanId!==v!.id)return fail('Подойдите к багажнику своего фургона со свободными руками.');
     const required=Math.max(2,Math.min(12,Math.hypot(t.station.x-FREIGHT_SHOP.x,t.station.z-FREIGHT_SHOP.z)*.35));
     if(!order.loadedAt||Math.hypot(v!.x-order.loadedAt.x,v!.z-order.loadedAt.z)<required||Math.hypot(v!.x-t.client.x,v!.z-t.client.z)>12)return fail('Сначала перевезите комплект к клиенту. Парковка должна быть рядом с адресом доставки.');
     order.transported=true;order.location='hands';order.carrier=p.sessionId;order.x=p.x;order.z=p.z;savePose();return ok('Груз выгружен. Занесите комплект в помещение к рабочему месту.');
    }
    if(a.action==='install'){
     if(!order.transported||order.location!=='hands'||order.carrier!==p.sessionId||!insideBuilding(p,t.buildingId)||!near(t.station,2.5))return fail('Привезите и занесите комплект к указанному рабочему месту.');
     order.location='installed';order.carrier=undefined;order.stage='INSTALLED';order.x=t.station.x;order.z=t.station.z;return ok('Комплект распакован и установлен. Выполните профильную проверку.');
    }
    if(a.action==='test'){
     if(order.stage!=='INSTALLED'||!insideBuilding(p,t.buildingId)||!near(t.station,2.5))return fail('Проверяйте установленное оборудование на месте.');
     if(a.choice!==product.check)return fail('Выбранный тест не подтверждает работоспособность этого комплекта.');order.stage='TESTED';return ok(product.checkName+': PASS. Вернитесь к клиенту за подписью.');
    }
    if(a.action==='signoff'){
     if(order.stage!=='TESTED'||!insideBuilding(p,t.buildingId)||!near(t.client,2.5))return fail('Сдать проверенную поставку можно рядом с клиентом.');
     const company=order.companyCode?tx.company:undefined;if(order.companyCode&&(!company||!company.members[profileId])||(company?company.wallet:tx.data.credits)+t.payment>2147483647)return fail('Проверьте доступ к фирме и лимит бюджета.');
     order.stage='COMPLETE';order.completedAt=this.now();l.completed++;b.workCounts[t.id]=(b.workCounts[t.id]??0)+1;
     if(company){company.wallet+=t.payment;const commission=Math.floor(Math.max(0,t.payment-(t.prepaid?0:product.price))*.25);company.payouts[profileId]=(company.payouts[profileId]??0)+commission;company.deliveries=(company.deliveries??0)+1;company.revision++;appendCompanyLedger(company,tx.data.nickname,this.now(),'LOGISTICS_INCOME','Поставка: '+t.title,t.payment);}else tx.data.credits+=t.payment;
     tx.data.xp+=t.xp;tx.reward={jobId:order.id,credits:t.payment,xp:t.xp};return ok(company?`Поставка принята: ${t.payment} NET фирме, комиссия исполнителя зарезервирована.`:`Поставка принята: +${t.payment} NET / +${t.xp} XP.`);
    }
    return fail('Недопустимое действие с грузом.');
   };
   const result=perform();tx.saveOperation={fingerprint,result};return result;
  },undefined,companyCode);
 }
}
function importPart(templateId:string):ItemId|null{return caseTemplate({templateId}).part;}
