export {CLIENT_CASE_TEMPLATE} from "./clientCaseLegacy.js";
export type CaseStage = "RINGING"|"DECLINED"|"ACCEPTED"|"INTERVIEW"|"DIAGNOSED"|"REPAIRED"|"VERIFIED"|"COMPLETED";
export interface ClientCase {
  id:string; templateId:string; stage:CaseStage; clues:string[]; progress?:Record<string,string|number|boolean>;
  carrying:boolean; droppedAt:{x:number;z:number}|null; satisfaction:number;
  carrier?:string; carryOrigin?:{x:number;z:number};
  availableAt:number; completedAt:number|null;
}
export interface ServiceProgress { cases:ClientCase[]; completed:number; }
export type CaseIntent = { action:"accept"|"decline"|"talk"|"diagnose"|"buyPart"|"returnCleaner"|"returnPart"|"take"|"drop"|"install"|"verify"|"signoff"|"repairStep"; caseId:string; choice?:string; port?:number; };
export function clientCaseTarget(c:ClientCase|undefined,inventory:Record<string,number>) {
  const t=caseTemplate(c);
  if(c?.droppedAt)return c.droppedAt;
  if(c?.stage==="DIAGNOSED")return !t.part||c.carrying||inventory[t.part]>0?t.hardware:t.shop;
  if(c?.stage==="REPAIRED" || c?.stage==="INTERVIEW"&&c.clues.length>=2)return t.hardware;
  return t.client;
}
export type CaseAction = CaseIntent & {requestId:string};
export const BAG_LIMIT = {weight:12,slots:8};
export const ITEM_WEIGHT:Record<string,number>={toolkit:3,cleaner:0.5,patch_cord:0.2,power_supply:1.5,toner:0.8};
export function bagUsage(inventory:Record<string,number>) {
  return {weight:Object.entries(inventory).reduce((n,[id,count])=>n+(ITEM_WEIGHT[id]??1)*count,0),slots:Object.values(inventory).filter(n=>n>0).length};
}
import {caseTemplate} from './caseCatalog.js';
