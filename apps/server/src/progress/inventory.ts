import {ITEM_WEIGHT,bagUsage,caseTemplate,type ItemId,type ClientCase,type ProgressResult} from '@netcity/shared';
import type {ProfileData} from './store.js';
/** Corporate stock is consumed first and cannot be sold into an employee's personal wallet. */
export function consumeInventory(d:ProfileData,item:ItemId){const issued=d.business?.companyStock?.[item]??0;d.inventory[item]--;if(issued>0){d.business!.companyStock![item]=issued-1;return d.business!.companyCode;}return undefined;}
export function refundableInventory(d:ProfileData,item:ItemId){return d.inventory[item]-(d.business?.companyStock?.[item]??0);}
export function stowCasePart(d:ProfileData,c:ClientCase,p:{x:number;z:number;sessionId:string}|null):ProgressResult{
 const part=caseTemplate(c).part;if(!p||!part||!c.carrying||c.carrier!==p.sessionId||c.stage!=='DIAGNOSED')return {ok:false,message:'В этом сеансе нет детали заявки в руках.'};
 if(d.inventory[part]>=99||bagUsage(d.inventory).weight+ITEM_WEIGHT[part]>(d.business?.upgrades.includes('service-van')?18:12))return {ok:false,message:'В рюкзаке недостаточно места.'};
 const source=c.progress?.companyIssued;if(source&&source!==d.business?.companyCode)return {ok:false,message:'Корпоративный материал нужно вернуть своей фирме.'};
 d.inventory[part]++;if(source){d.business!.companyStock??={};d.business!.companyStock[part]=(d.business!.companyStock[part]??0)+1;delete c.progress!.companyIssued;}
 c.carrying=false;c.carrier=undefined;c.carryOrigin=undefined;c.droppedAt=null;return {ok:true,message:'Деталь убрана в рюкзак. Корпоративная принадлежность сохранена.'};
}
