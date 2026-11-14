import {randomUUID,createHash} from "node:crypto";
import {CLIENT_CASE_TEMPLATE as T, BAG_LIMIT,bagUsage,inOfficeRoom,type ProgressResult} from "@netcity/shared";
import type {ProfileData,ProgressStore} from "./store.js";
import {CASE_CATALOG} from '@netcity/shared';
import {performCase} from './caseEngine.js';
import {initBusiness} from './business.js';
const bad=(message:string):ProgressResult=>({ok:false,message});
const good=(message:string):ProgressResult=>({ok:true,message});
export function refreshCases(data:ProfileData,now:number) {
  data.service??={cases:[],completed:0};
  initBusiness(data);
  const last=data.service.cases.at(-1);
  if(!last || last.stage==="COMPLETED" && now>=last.availableAt) {
    data.service.cases=data.service.cases.slice(-19);
    data.service.cases.push({id:randomUUID(),templateId:CASE_CATALOG[data.service.completed%CASE_CATALOG.length].id,stage:"RINGING",clues:[],carrying:false,droppedAt:null,satisfaction:3,availableAt:0,completedAt:null});
  } else if(last.stage==="DECLINED" && now>=last.availableAt) last.stage="RINGING";
}
/** Purely private case state; actor position is supplied by the authoritative room. */
export class ClientCaseService {
  constructor(readonly store:ProgressStore,private now=Date.now){}
  command(id:string,value:unknown,actor:()=>{x:number;z:number;sessionId:string}|null) {
    const a=value as Record<string,unknown>|null;
    if(!a || typeof a!=="object" || typeof a.requestId!=="string" || !/^[a-f0-9-]{36}$/.test(a.requestId) || typeof a.caseId!=="string" || !/^[a-f0-9-]{36}$/.test(a.caseId) ||
      (a.choice!==undefined && (typeof a.choice!=="string" || a.choice.length>64)) || (a.port!==undefined && (!Number.isInteger(a.port)||Number(a.port)<1||Number(a.port)>8)) ||
      Object.keys(a).some(k=>!["requestId","caseId","action","choice","port"].includes(k)) ||
      !["accept","decline","talk","diagnose","buyPart","returnCleaner","returnPart","take","drop","install","verify","signoff","repairStep"].includes(String(a.action)))
      return Promise.resolve({result:bad("Некорректное действие заявки."),data:null});
    const fingerprint=createHash("sha256").update(JSON.stringify(["case",a.action,a.caseId,a.choice,a.port])).digest("hex");
    return this.store.transaction(id,a.requestId,tx=>{
      if(tx.operation) return tx.operation.fingerprint===fingerprint?{...tx.operation.result,replayed:true}:bad("Ключ операции уже использован.");
      refreshCases(tx.data,this.now());
      const c=tx.data.service!.cases.find(c=>c.id===a.caseId);
      const position=actor();
      const near=(point:{x:number;z:number},indoors=false)=>!!position && Number.isFinite(position.x)&&Number.isFinite(position.z)&&(!indoors||inOfficeRoom(position,point.x))&&Math.hypot(position.x-point.x,position.z-point.z)<=2.5;
      let result:ProgressResult;
      const perform=():ProgressResult=>{
        if(c&&(c.templateId!=='moved-desks'||a.action==='returnPart'))return performCase(tx,c,a,position,this.now());
        if(!position || !Number.isFinite(position.x) || !Number.isFinite(position.z))return bad("Сеанс закрыт. Переподключитесь.");
        if(!c)return bad("Эта заявка не принадлежит вашему профилю.");
        if(a.action==="accept") {
          if(c.stage!=="RINGING")return bad("Звонок уже обработан.");
          if(tx.data.jobs.some(j=>j.status==="ACTIVE"))return bad("Сначала завершите или отложите текущую работу.");
          c.stage="ACCEPTED";tx.data.credits+=T.advance;
          return good(`Елена ждёт в приёмной. Аванс ${T.advance} NET на запчасть начислен; после сдачи — ${T.payment} NET.`);
        }
        if(a.action==="decline") {if(c.stage!=="RINGING")return bad("Звонок уже обработан.");c.stage="DECLINED";c.availableAt=this.now()+20000;return good("Звонок отложен на 20 секунд.");}
        if(["RINGING","DECLINED","COMPLETED"].includes(c.stage))return bad("Нет активной заявки для этого действия.");
        if(a.action==="talk") {
          if(!near(T.client,true))return bad("Подойдите к Елене в приёмной.");
          if(!["ACCEPTED","INTERVIEW"].includes(c.stage))return bad("Опрос уже закончен. Следуйте этапам заявки.");
          if(typeof a.choice!=="string" || !Object.hasOwn(T.questions,a.choice))return bad("Выберите вопрос клиенту.");
          if(!c.clues.includes(a.choice))c.clues.push(a.choice);
          c.stage="INTERVIEW";return good(T.questions[a.choice as keyof typeof T.questions]);
        }
        if(a.action==="diagnose") {
          if(!near(T.hardware,true))return bad("Подойдите к CLIENT-PC04 рядом с окном.");
          if(c.stage!=="INTERVIEW" || c.clues.length<2)return bad("Сначала задайте клиенту хотя бы два разных вопроса.");
          if(tx.data.inventory.toolkit<1)return bad("Нужен набор инструментов.");
          if(a.choice!=="cable") {c.satisfaction=Math.max(1,c.satisfaction-1);return bad("Перезагрузка не помогла. Питание есть, линка нет: проверьте физический кабель.");}
          c.stage="DIAGNOSED";return good("Кабель пережат ножкой стола. Нужен новый патч-корд, розетка №2. Проверьте рюкзак или посетите Марата.");
        }
        if(a.action==="buyPart") {
          if(!near(T.shop))return bad("Покупка оплачивается у стойки Марата.");
          if(c.stage!=="DIAGNOSED")return bad("Сначала установите причину неисправности.");
          const usage=bagUsage(tx.data.inventory);
          if(usage.weight+0.2>BAG_LIMIT.weight || usage.slots+Number(tx.data.inventory.patch_cord===0)>BAG_LIMIT.slots)return bad("В рюкзаке нет места.");
          if(tx.data.credits<30)return bad("Недостаточно NET.");
          if(tx.data.inventory.patch_cord>=99)return bad("Рюкзак заполнен патч-кордами.");
          tx.data.credits-=30;tx.data.inventory.patch_cord++;return good("Оплачено 30 NET. Патч-корд помещён в рюкзак.");
        }
        if(a.action==="returnCleaner") {
          if(!near(T.shop))return bad("Вернуть расходник можно у Марата.");
          if(tx.data.inventory.cleaner<1)return bad("В рюкзаке нет лишнего баллона.");
          tx.data.inventory.cleaner--;tx.data.credits+=10;return good("Баллон возвращён за 10 NET. Место освобождено.");
        }
        if(a.action==="take") {
          if(tx.data.cable?.carrier)return bad('Сначала положите бухту: руки заняты.');
          if(c.stage!=="DIAGNOSED" || c.carrying)return bad("Сейчас нельзя взять деталь.");
          if(c.droppedAt) {if(!near(c.droppedAt))return bad("Подойдите к своей оставленной детали.");c.droppedAt=null;}
          else {if(tx.data.inventory.patch_cord<1)return bad("В рюкзаке нет патч-корда.");tx.data.inventory.patch_cord--;}
          c.carrying=true;c.carrier=position.sessionId;c.carryOrigin={x:position.x,z:position.z};return good("Патч-корд в руках. Положить — через рюкзак или назначенной клавишей; установка — у CLIENT-PC04.");
        }
        if(a.action==="drop") {if(!c.carrying||c.carrier!==position.sessionId)return bad("В этом сеансе в руках нет детали.");c.carrying=false;c.carrier=undefined;c.carryOrigin=undefined;c.droppedAt={x:position.x,z:position.z};return good("Деталь оставлена у ног. Забрать её может только владелец заявки.");}
        if(a.action==="install") {
          if(!near(T.hardware,true))return bad("Установка требует близости к CLIENT-PC04.");
          if(c.stage!=="DIAGNOSED" || !c.carrying || c.carrier!==position.sessionId)return bad("Сначала достаньте патч-корд в этом сеансе.");
          if(a.port!==T.port)return bad("Нужна розетка №2. Деталь не потрачена.");
          c.carrying=false;c.carrier=undefined;c.carryOrigin=undefined;c.stage="REPAIRED";return good("Кабель установлен. Теперь проверьте линк диагностикой планшета.");
        }
        if(a.action==="verify") {if(!near(T.hardware,true))return bad("Проверка выполняется рядом с устройством.");if(c.stage!=="REPAIRED")return bad("Сначала замените повреждённый кабель.");c.stage="VERIFIED";return good("Линк 1 Гбит/с, потерь 0/4. Вернитесь к Елене и сдайте работу.");}
        if(a.action==="signoff") {
          if(!near(T.client,true))return bad("Сдать работу можно только рядом с клиентом.");
          if(c.stage!=="VERIFIED")return bad("Клиент просит сначала проверить результат ремонта.");
          c.stage="COMPLETED";c.completedAt=this.now();c.availableAt=this.now()+60000;tx.data.service!.completed++;
          const business=initBusiness(tx.data);business.workCounts[T.id]=(business.workCounts[T.id]??0)+1;const payment=Math.round(T.payment*(business.upgrades.includes('workbench')?1.1:1));
          tx.data.credits+=payment;tx.data.xp+=T.xp;tx.reward={jobId:c.id,credits:payment,xp:T.xp};
          return good(`Елена: «Работает! Спасибо». Работа подписана: +${payment} NET, +${T.xp} XP.`);
        }
        return bad("Недопустимое действие.");
      };
      result=perform();tx.saveOperation={fingerprint,result};return result;
    });
  }
}
