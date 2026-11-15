import { JOBS } from "./officeNetwork.js";
export interface CompanyView {
  name: string;
  reputation: number;
  contract: {
    id: string; title: string; completed: boolean;
    steps: {id:string;title:string;completed:boolean}[];
  };
}
/** A first solo outsourcing contract, derived only from durable, server-verified facts. */
export function companyFromProgress(profile: {nickname:string;tutorialCompleted:boolean;diagnostics?:string[];service?:{completed:number};business?:{workCounts:Record<string,number>}}): CompanyView {
  const steps=[{id:"001",title:"Восстановить общую сеть",completed:profile.tutorialCompleted},
    ...JOBS.map(job=>({id:job.id,title:job.title,completed:profile.diagnostics?.includes(job.id)??false}))];
  const crewCompleted=['crew-security','crew-network','crew-renewal'].reduce((n,key)=>n+(profile.business?.workCounts[key]??0),0);
  const completed=steps.every(step=>step.completed);
  return {name:`IT-бригада · ${profile.nickname}`,reputation:Number(completed)+(profile.service?.completed??0)+crewCompleted,
    contract:{id:"office-first-shift",title:"Офис под ключ",completed,steps}};
}
