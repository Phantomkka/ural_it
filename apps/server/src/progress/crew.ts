import {createHash,randomUUID} from 'node:crypto';
import {CREW_CATALOG,CREW_GOODS,CREW_ROLES,CREW_SHOP,crewTasks,crewView,CITY_BUILDINGS,buildingClient,insideBuilding,type CrewProject,type CrewAction,type CrewView,type ProgressResult} from '@netcity/shared';
import type {ProgressStore,Transaction} from './store.js';
import {initBusiness} from './business.js';
const fail=(message:string):ProgressResult=>({ok:false,message});
const ok=(message:string):ProgressResult=>({ok:true,message});
export class CrewService {
 constructor(readonly store:ProgressStore,private now=Date.now){}
 async view(id:string,code?:string):Promise<CrewView|null>{const d=await this.store.read(id),key=code??d.projects?.at(-1);if(!key)return null;const p=await this.store.readProject(key);return p?.members[id]?crewView(p,id):null;}
 async command(id:string,value:unknown,position:()=>{x:number;z:number;sessionId?:string}|null,freeHands:()=>boolean=()=>true){
  const a=value as CrewAction;
  const allowed=['action','requestId','code','templateId','role','taskId','step','choice'];
  if(!a||typeof a!=='object'||Object.keys(a).some(k=>!allowed.includes(k))||!['create','join','refresh','role','leave','launch','order','pickup','drop','work','signoff','claim'].includes(a.action)||typeof a.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(a.requestId)||a.code!==undefined&&(typeof a.code!=='string'||!/^[A-F0-9]{12}$/.test(a.code))||a.taskId!==undefined&&(typeof a.taskId!=='string'||a.taskId.length>40)||a.choice!==undefined&&(typeof a.choice!=='string'||a.choice.length>30)||a.step!==undefined&&(!Number.isSafeInteger(a.step)||a.step<0||a.step>20)||a.role!==undefined&&!CREW_ROLES.includes(a.role as any)||a.templateId!==undefined&&!CREW_CATALOG.some(c=>c.id===a.templateId))return {result:fail('Некорректная команда бригады.'),data:null};
  if(a.action==='refresh')return {result:ok('Заказ обновлён.'),data:await this.store.read(id)};
  // Stable create code from operation key: an ambiguous network retry must never
  // allocate a second project or change its invite code.
  const code=a.action==='create'?createHash('sha256').update(id+':crew:'+a.requestId).digest('hex').slice(0,12).toUpperCase():a.code;
  if(!code)return {result:fail('Нужен код заказа.'),data:null};
  const fingerprint=createHash('sha256').update(JSON.stringify(['crew',a.action,code,a.templateId??'',a.role??'',a.taskId??'',a.step??null,a.choice??''])).digest('hex');
  return this.store.transaction(id,a.requestId,tx=>{
   if(tx.operation)return tx.operation.fingerprint===fingerprint?{...tx.operation.result,replayed:true}:fail('Ключ операции уже использован.');
   const result=this.mutate(tx,id,a,code,position,freeHands);if(result.ok&&tx.project)tx.project.revision++;
   tx.saveOperation={fingerprint,result};return result;
  },code);
 }
 private mutate(tx:Transaction,id:string,a:CrewAction,code:string,position:()=>{x:number;z:number;sessionId?:string}|null,freeHands:()=>boolean):ProgressResult{
  const d=tx.data,now=this.now();let p=tx.project;
  if(a.action==='create'){
   if(!a.templateId||p)return fail('Заказ уже существует или не выбран проект.');
   if(d.projects?.length){
    return fail('Сначала сдайте и получите оплату текущего заказа бригады.');
   }
   p=tx.project={id:randomUUID(),code,templateId:a.templateId,owner:id,members:{[id]:{name:d.nickname,role:'Универсал',contributions:0,claimed:false}},status:'LOBBY',budget:1500,spent:0,tasks:crewTasks(a.templateId),createdAt:now,completedAt:null,revision:0};d.projects=[code];return ok('Бригада создана. Пригласите до четырёх друзей по коду '+code+'.');
  }
  if(!p)return fail('Заказ не найден. Проверьте код.');
  if(a.action==='join'){
   if(p.members[id])return ok('Вы уже в этой бригаде.');
   if(p.status!=='LOBBY'||Object.keys(p.members).length>=5)return fail('Бригада уже начала работу или заполнена (максимум 5).');
   if(d.projects?.length)return fail('Сначала завершите свою текущую работу бригады.');
   p.members[id]={name:d.nickname,role:'Универсал',contributions:0,claimed:false};d.projects=[code];return ok('Вы в бригаде. Выберите роль.');
  }
  const member=p.members[id];if(!member)return fail('Вы не участник этой бригады.');
  if(a.action==='claim'){
   if(p.status!=='COMPLETE'||member.claimed)return fail('Оплата ещё недоступна или уже получена.');
   const c=CREW_CATALOG.find(c=>c.id===p.templateId)!,n=Object.keys(p.members).length,credits=Math.floor(c.credits/n),xp=Math.floor(c.xp/n);member.claimed=true;d.credits+=credits;d.xp+=xp;d.projects=[];const b=initBusiness(d);b.workCounts['crew-'+c.kind]=(b.workCounts['crew-'+c.kind]??0)+1;
   const hash=createHash('sha256').update(p.id+':'+id).digest('hex').slice(0,32);tx.reward={jobId:[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20)].join('-'),credits,xp};return ok(`Общий заказ оплачен: +${credits} NET, +${xp} XP. Доля 1/${n}.`);
  }
  if(a.action==='role'){if(!a.role||p.status!=='LOBBY')return fail('Роли выбираются до выезда.');member.role=a.role;return ok('Роль назначена: '+a.role);}
  if(a.action==='leave'){
   if(p.status!=='LOBBY')return fail('После выезда состав фиксирован до сдачи работы.');if(p.owner===id&&Object.keys(p.members).length>1)return fail('Руководитель выходит последним.');delete p.members[id];d.projects=[];if(p.owner===id){p.status='COMPLETE';p.completedAt=now;}return ok('Вы вышли из бригады.');
  }
  if(a.action==='launch'){if(p.owner!==id||p.status!=='LOBBY')return fail('Начать выезд может руководитель.');p.status='ACTIVE';return ok('Выезд начат. Средства клиента доступны только для комплектующих.');}
  if(p.status!=='ACTIVE')return fail('Сначала соберите бригаду и начните выезд.');
  const b=CITY_BUILDINGS.find(b=>b.id===CREW_CATALOG.find(c=>c.id===p!.templateId)!.buildingId)!,where=position();if(!where)return fail('Персонаж не в мире.');
  const near=(point:{x:number;z:number})=>Math.hypot(where.x-point.x,where.z-point.z)<=2.15;
  if(a.action==='signoff'){
   if(!p.tasks.every(t=>t.done))return fail('Есть незаконченные работы и испытания.');if(!near(buildingClient(b))||!insideBuilding(where,b.id))return fail('Подойдите к клиенту для подписания акта.');p.status='COMPLETE';p.completedAt=now;return ok('Клиент подписал общий акт. Каждый участник может получить свою долю.');
  }
  const task=p.tasks.find(t=>t.id===a.taskId);if(!task||task.done)return fail('Задача уже выполнена или не найдена.');
  if(!task.requires.every(id=>p!.tasks.find(t=>t.id===id)?.done))return fail('Сначала завершите предыдущие этапы.');
  if(a.action==='order'){
   if(task.kind!=='delivery'||!task.good||task.orderedAt)return fail('Этот комплект уже заказан.');if(!near(CREW_SHOP)||!insideBuilding(where,'building-2'))return fail('Закажите комплект у склада внутри мастерской.');const cost=CREW_GOODS[task.good].price;if(p.budget-p.spent<cost)return fail('Превышена смета клиента.');p.spent+=cost;task.orderedAt=now;task.readyAt=now+8000;task.parcel={x:CREW_SHOP.x,z:CREW_SHOP.z-1};member.contributions++;return ok('Заказ оплачен из сметы клиента. Комплектация: 8 секунд.');
  }
  if(a.action==='pickup'){
   if(task.kind!=='delivery'||!task.parcel||!task.orderedAt)return fail('Сначала закажите комплект.');if(now<task.readyAt)return fail('Комплект ещё собирается на складе.');if(task.carrier)return fail('Комплект уже несёт другой инженер.');if(p.tasks.some(t=>t.carrier===id)||!freeHands())return fail('Освободите руки. Один инженер несёт один комплект.');if(!near(task.parcel))return fail('Подойдите к коробке.');task.carrier=id;task.carrierSession=where.sessionId;return ok('Комплект в руках. Доставьте в монтажную зону.');
  }
  if(a.action==='drop'){
   if(task.carrier!==id||task.carrierSession!==where.sessionId)return fail('Этот комплект несёт другой инженер.');task.carrier=undefined;task.carrierSession=undefined;task.parcel={x:where.x,z:where.z};return ok('Комплект поставлен. Его может забрать напарник.');
  }
  if(a.action!=='work'||a.step!==task.step)return fail('Этап изменился. Обновите заказ.');
  const step=task.steps[task.step];if(!step||!near(step.point)||!insideBuilding(where,b.id))return fail('Подойдите к отмеченному узлу внутри нужного здания.');
  if(task.kind==='delivery'&&(task.carrier!==id||task.carrierSession!==where.sessionId))return fail('Принесите комплект в руках.');
  if(task.kind!=='delivery'&&(p.tasks.some(t=>t.carrier===id)||!freeHands()))return fail('Перед монтажом освободите руки.');
  if(step.choice&&a.choice!==step.choice)return fail('Небезопасный вариант. Проверьте план, питание и схему соединения.');
  if(step.wait){if(!task.readyAt){task.readyAt=now+step.wait;return ok('Испытание запущено. Дождитесь результата на этом узле.');}if(now<task.readyAt)return fail('Измерение ещё выполняется.');}
  task.step++;task.readyAt=0;task.done=task.step===task.steps.length;member.contributions++;
  if(task.kind==='delivery'){task.carrier=undefined;task.carrierSession=undefined;task.parcel=undefined;}
  return ok(task.done?'Задача выполнена: '+task.title:'Готово. Следующий шаг: '+task.steps[task.step].label);
 }
 async dropOnDisconnect(id:string,point:{x:number;z:number},sessionId:string){const d=await this.store.read(id),code=d.projects?.at(-1);if(!code)return;await this.store.transaction(id,null,tx=>{for(const t of tx.project?.tasks??[])if(t.carrier===id&&t.carrierSession===sessionId){t.carrier=undefined;t.carrierSession=undefined;t.parcel=point;tx.project!.revision++;}return ok('');},code);}
 async recover(id:string,sessions:Set<string>){const d=await this.store.read(id),code=d.projects?.at(-1);if(!code)return;await this.store.transaction(id,null,tx=>{for(const t of tx.project?.tasks??[])if(t.carrier===id&&(!t.carrierSession||!sessions.has(t.carrierSession))){t.carrier=undefined;t.carrierSession=undefined;tx.project!.revision++;}return ok('');},code);}
}
