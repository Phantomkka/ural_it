import { COMPUTERS, JOBS, SWITCH, WORK, type PrivateProfile, type ProgressView } from "@netcity/shared";
import type { WorldView } from "./world";
export function missionTarget(tracked: string) {
  return COMPUTERS.find(pc=>pc.id===JOBS.find(j=>j.id===tracked)?.pcId) ?? SWITCH;
}
export function MissionHud({tracked,track,view,profile,jobs,step}: {
  tracked:string;track:(id:string)=>void;view:WorldView;profile:PrivateProfile|null;jobs:Map<string,ProgressView>;step:number;
}) {
  const active=profile?.jobs.find(j=>j.status==="ACTIVE");
  const destination=active ? SWITCH : missionTarget(tracked);
  const distance=Math.hypot(destination.x-view.x,destination.z-view.z);
  const job=JOBS.find(j=>j.id===tracked);
  const stage=jobs.get(tracked);
  const bearing=Math.atan2(destination.x-view.x,destination.z-view.z)-view.yaw;
  const objective=active ? `${WORK[active.kind].title} · ${active.stage===0?"Осмотрите оборудование":"Выполните ремонт"}`
    : job ? `${job.title} · ${profile?.diagnostics?.includes(tracked)?"Выполнено и оплачено":job.steps[stage?.stage??0]??"Выполнено"}`
    : step===6 ? "Первая заявка выполнена. Выберите следующую работу." : "Офис №001 → серверная → порт №3";
  return <nav className="mission-hud" aria-label="Отслеживание заявки">
    <label>Отслеживать<select aria-label="Отслеживать заявку" value={tracked} disabled={!!active} onChange={e=>track(e.target.value)}>
      <option value="001">№001 · Первая сеть</option>{JOBS.map(j=><option key={j.id} value={j.id}>№{j.id} · {j.title}</option>)}
    </select></label>
    <p>{objective}</p><span className="mission-bearing" style={{transform:`rotate(${bearing}rad)`}}>↑</span><strong>{Math.ceil(distance)} м</strong>
    <small>Стрелка указывает направление. В офис входите через дверь с улицы.</small>
  </nav>;
}
