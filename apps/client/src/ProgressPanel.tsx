import { useEffect, useState, type RefObject } from "react";
import {
  ITEMS,
  JOBS,
  DIAGNOSTIC_REWARD,
  WORK,
  type PrivateProfile,
  type ProgressIntent,
  type ProgressAction,
  type ProgressResult,
  type ItemId,
} from "@netcity/shared";
export function ProgressPanel({
  profile,
  pending,
  result,
  act,
  retry,
  close,
  dialogRef,
  track,
}: {
  profile: PrivateProfile | null;
  pending: ProgressAction | null;
  result: ProgressResult | null;
  act: (a: ProgressIntent) => void;
  retry: () => void;
  close: () => void;
  dialogRef: RefObject<HTMLElement | null>;
  track: (id:string)=>void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        className="progress-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Профиль, заявки и снабжение"
        ref={dialogRef}
      >
        <div className="progress-heading">
          <h2>Профиль инженера</h2>
          <button onClick={close} aria-label="Закрыть профиль">
            ✕
          </button>
        </div>
        {!profile ? (
          <p>Загрузка профиля…</p>
        ) : (
          <>
            <div className="profile-card">
              <b>{profile.nickname}</b>
              <span data-testid="wallet">{profile.credits} NET</span>
              <span>
                Уровень {profile.level} · {profile.xp} XP
              </span>
              <progress
                aria-label="Опыт до следующего уровня"
                value={
                  profile.nextLevelXp ? profile.xp - profile.levelStart : 1
                }
                max={
                  profile.nextLevelXp
                    ? profile.nextLevelXp - profile.levelStart
                    : 1
                }
              />
              <small>
                {profile.nextLevelXp
                  ? `До уровня ${profile.level + 1}: ${profile.nextLevelXp - profile.xp} XP`
                  : "Достигнут верхний уровень учебной демонстрации"}
              </small>
            </div>
            <p className="persistence-mode" data-mode={profile.persistence}>
              {profile.persistence === "temporary"
                ? "⚠ Временные данные — прогресс сбросится после перезапуска сервера."
                : "✓ PostgreSQL — прогресс сохраняется между перезапусками сервера."}
            </p>
            <h3>Доска заявок</h3>
            <p>
              Одновременно можно взять одну работу. Техника общая: чужую заявку
              завершить нельзя. Первый осмотр коммутатора принимает вводную
              заявку автоматически.
            </p>
            <div className="work-board">
              {profile.jobs
                .filter((j) => j.status !== "COMPLETED")
                .map((j) => (
                  <article
                    key={j.id}
                    data-job-kind={j.kind}
                    data-job-status={j.status}
                  >
                    <b>{WORK[j.kind].title}</b>
                    <small className="job-id">ID: {j.id}</small>
                    <p>{WORK[j.kind].goal}</p>
                    <p>
                      Награда: {WORK[j.kind].credits} NET · {WORK[j.kind].xp} XP
                    </p>
                    <p>
                      {j.tutorial
                        ? "Вводный ремонт — используйте найденный кабель."
                        : `Расходник: ${ITEMS[WORK[j.kind].item].name}.`}
                    </p>
                    <strong>
                      {j.status === "ACTIVE"
                        ? `Взята · ${j.stage === 0 ? "осмотрите оборудование в серверной" : "выполните ремонт"}`
                        : "Доступна"}
                    </strong>
                    {j.status === "ACTIVE" ? (
                      <button
                        disabled={!!pending}
                        onClick={() => act({ type: "cancel", jobId: j.id })}
                      >
                        Отложить заявку
                      </button>
                    ) : (
                      <button
                        disabled={
                          !!pending ||
                          j.availableAt > now ||
                          profile.jobs.some((k) => k.status === "ACTIVE")
                        }
                        onClick={() => act({ type: "accept", jobId: j.id })}
                      >
                        {j.availableAt > now
                          ? `Доступна через ${Math.ceil((j.availableAt - now) / 1000)} с`
                          : "Взять заявку"}
                      </button>
                    )}
                  </article>
                ))}
            </div>
            {profile.jobs
              .filter((j) => j.status === "COMPLETED")
              .slice(-4)
              .reverse()
              .map((j) => (
                <p key={j.id} className="completed-order">
                  ✓ Выполнена: {WORK[j.kind].title}
                  <small>
                    {WORK[j.kind].goal} Награда: {WORK[j.kind].credits} NET ·{" "}
                    {WORK[j.kind].xp} XP.
                  </small>
                  <small className="job-id">
                    ID: {j.id} · повторная работа{" "}
                    {j.availableAt > now
                      ? `через ${Math.ceil((j.availableAt - now) / 1000)} с`
                      : "доступна на доске"}
                  </small>
                </p>
              ))}
            <h3>Диагностика рабочих мест</h3>
            <p>Вначале восстановите общую сеть. Затем осмотрите ПК, выполните диагностику, исправьте причину и проверьте результат. Нужен набор инструментов. За каждый ПК платим один раз на профиль; повторная практика не приносит деньги.</p>
            <div className="work-board diagnostic-board">{JOBS.map(job=><article key={job.id}>
              <b>№{job.id} · {job.title}</b><p>{job.description}</p>
              <p>{profile.diagnostics?.includes(job.id)?"✓ Выполнено и оплачено":`Награда: ${DIAGNOSTIC_REWARD.credits} NET · ${DIAGNOSTIC_REWARD.xp} XP`}</p>
              <button onClick={()=>track(job.id)}>Отслеживать №{job.id}</button>
            </article>)}</div>
            <h3>Снабжение · только виртуальные кредиты</h3>
            <div className="supply-list">
              {(Object.keys(ITEMS) as ItemId[]).map((id) => (
                <article key={id}>
                  <b>{ITEMS[id].name}</b>
                  <span>
                    В инвентаре:{" "}
                    <strong data-item={id}>{profile.inventory[id]}</strong>
                  </span>
                  <button
                    disabled={!!pending}
                    onClick={() => act({ type: "buy", itemId: id })}
                  >
                    Купить: {ITEMS[id].price} NET
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {pending && (
          <p role="status">
            Ожидание подтверждения сервера…{" "}
            <button onClick={retry}>Повторить ту же операцию</button>
          </p>
        )}
        {result && (
          <p
            role="status"
            className={`notification ${result.ok ? "success" : "error"}`}
          >
            {result.message}
            {result.replayed ? " (повтор обработан без нового списания)" : ""}
          </p>
        )}
      </section>
    </div>
  );
}
