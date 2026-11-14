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
export function companyFromProgress(profile: {nickname:string;tutorialCompleted:boolean;diagnostics?:string[]}): CompanyView {
  const steps=[{id:"001",title:"Восстановить общую сеть",completed:profile.tutorialCompleted},
    ...JOBS.map(job=>({id:job.id,title:job.title,completed:profile.diagnostics?.includes(job.id)??false}))];
  const completed=steps.every(step=>step.completed);
  return {name:`IT-бригада · ${profile.nickname}`,reputation:Number(completed),
    contract:{id:"office-first-shift",title:"Офис под ключ",completed,steps}};
}
