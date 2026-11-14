export const CLIENT_CASE_TEMPLATE = {
  id: "moved-desks", title: "Сеть пропала после перестановки",
  caller: "Елена · бухгалтерия", address: "Офис №001 · первый этаж · приёмная",
  client: { x: 10, z: -2.5 }, hardware: { x: 11.3, z: -4.8 }, shop: { x: -6, z: 2 },
  advance: 30, payment: 110, xp: 80, port: 2,
  questions: {
    changed: "Вчера передвинули стол. Кабель натянулся под ножкой.",
    lights: "Индикатор на сетевой розетке не горит. Питание компьютера есть.",
    scope: "Не работает только мой компьютер. У коллег сеть есть.",
  },
} as const;
export type CaseStage = "RINGING"|"DECLINED"|"ACCEPTED"|"INTERVIEW"|"DIAGNOSED"|"REPAIRED"|"VERIFIED"|"COMPLETED";
export interface ClientCase {
  id:string; templateId:"moved-desks"; stage:CaseStage; clues:string[];
  carrying:boolean; droppedAt:{x:number;z:number}|null; satisfaction:number;
  carrier?:string; carryOrigin?:{x:number;z:number};
  availableAt:number; completedAt:number|null;
}
export interface ServiceProgress { cases:ClientCase[]; completed:number; }
export type CaseIntent = { action:"accept"|"decline"|"talk"|"diagnose"|"buyPart"|"returnCleaner"|"take"|"drop"|"install"|"verify"|"signoff"; caseId:string; choice?:string; port?:number; };
export function clientCaseTarget(c:ClientCase|undefined,inventory:Record<string,number>) {
  if(c?.droppedAt)return c.droppedAt;
  if(c?.stage==="DIAGNOSED")return c.carrying||inventory.patch_cord>0?CLIENT_CASE_TEMPLATE.hardware:CLIENT_CASE_TEMPLATE.shop;
  if(c?.stage==="REPAIRED" || c?.stage==="INTERVIEW"&&c.clues.length>=2)return CLIENT_CASE_TEMPLATE.hardware;
  return CLIENT_CASE_TEMPLATE.client;
}
export type CaseAction = CaseIntent & {requestId:string};
export const BAG_LIMIT = {weight:12,slots:8};
export const ITEM_WEIGHT:Record<string,number>={toolkit:3,cleaner:0.5,patch_cord:0.2};
export function bagUsage(inventory:Record<string,number>) {
  return {weight:Object.entries(inventory).reduce((n,[id,count])=>n+(ITEM_WEIGHT[id]??1)*count,0),slots:Object.values(inventory).filter(n=>n>0).length};
}
