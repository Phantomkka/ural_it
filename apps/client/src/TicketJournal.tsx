import { useState } from "react";
import { JOBS, type ProgressView } from "@netcity/shared";
export function TicketJournal({
  jobs,
  rewards,
  step,
}: {
  jobs: Map<string, ProgressView>;
  rewards: number;
  step: number;
}) {
  const [active, setActive] = useState("002");
  return (
    <details className="journal">
      <summary>Журнал заявок · награды: {rewards}/4</summary>
      <p>
        №001 · В офисе пропала сеть · {step === 6 ? "COMPLETED" : "IN_PROGRESS"}
      </p>
      <p>
        Выберите заявку. Действия учитываются индивидуально, исправления сети
        общие.
      </p>
      <select
        aria-label="Активная заявка"
        value={active}
        onChange={(e) => setActive(e.target.value)}
      >
        <option value="001">№001 · В офисе пропала сеть</option>
        {JOBS.map((j) => (
          <option key={j.id} value={j.id}>
            №{j.id} · {j.title}
          </option>
        ))}
      </select>
      {active === "001" && (
        <article>
          <h3>№001 · В офисе пропала сеть</h3>
          <p>
            Этапы и описание показаны в основной панели. Нужен порт №3
            коммутатора в серверной.
          </p>
          <b>{step === 6 ? "COMPLETED" : "IN_PROGRESS"}</b>
        </article>
      )}
      {JOBS.map((job) => {
        const p = jobs.get(job.id);
        return (
          <article key={job.id} data-job={job.id} hidden={job.id !== active}>
            <h3>
              №{job.id} · {job.title}
            </h3>
            <p>{job.description}</p>
            <b>{p?.status ?? "NEW"}</b>
            <p>Текущий этап: {job.steps[p?.stage ?? 0] ?? "Выполнено"}</p>
            <ol>
              {job.steps.map((s, n) => (
                <li key={s} className={n < (p?.stage ?? 0) ? "done" : ""}>
                  {n < (p?.stage ?? 0) ? "✓ " : ""}
                  {s}
                </li>
              ))}
            </ol>
          </article>
        );
      })}
    </details>
  );
}
