import { createHash } from "node:crypto";
import { refreshCases } from "./clientCases.js";
import {
  ITEMS,
  WORK,
  REPEAT_DELAY_MS,
  DIAGNOSTIC_REWARD,
  JOBS,
  BAG_LIMIT,bagUsage,ITEM_WEIGHT,
  type ItemId,
  type ProgressResult,
  type WorkKind,
  type WorkOrder,
} from "@netcity/shared";
import {
  newJob,
  type ProfileData,
  type ProgressStore,
  type Transaction,
} from "./store.js";
const bad = (message: string): ProgressResult => ({ ok: false, message });
const good = (message: string): ProgressResult => ({ ok: true, message });
export function refreshBoard(data: ProfileData, now: number) {
  refreshCases(data,now);
  for (const job of data.jobs)
    if (job.status === "AVAILABLE" && job.availableAt <= now)
      job.availableAt = 0;
  for (const kind of Object.keys(WORK) as WorkKind[]) {
    const latest = data.jobs.filter((j) => j.kind === kind).at(-1);
    if (!latest || (latest.status === "COMPLETED" && now >= latest.availableAt))
      data.jobs.push(newJob(kind));
  }
  const done = data.jobs.filter((j) => j.status === "COMPLETED").slice(-20);
  data.jobs = data.jobs.filter(
    (j) => j.status !== "COMPLETED" || done.includes(j),
  );
}
export class ProgressService {
  constructor(
    readonly store: ProgressStore,
    private now: () => number = Date.now,
  ) {}
  refresh(id: string) {
    return this.store.transaction(id, null, (tx) => {
      refreshBoard(tx.data, this.now());
      return good("Профиль обновлён.");
    });
  }
  /** Called only after a complete server-side PC workflow; never from a progress message. */
  finishDiagnostic(id: string, jobId: string, verify: () => string | null) {
    return this.store.transaction(id, `diagnostic:${jobId}`, tx => {
      if (!JOBS.some(j => j.id === jobId)) return bad("Неизвестная диагностика.");
      if (tx.data.diagnostics?.includes(jobId)) return {ok:true, replayed:true, message:"Диагностика уже оплачена. Повторное начисление не выполняется."};
      const error = verify();
      if (error) return bad(error);
      if (tx.data.jobs.some(j=>j.status==="ACTIVE")) return bad("Сначала завершите или отложите активную работу на доске.");
      if (tx.data.inventory.toolkit < 1) return bad("Для обслуживания ПК нужен набор инструментов.");
      const hash = createHash("sha256").update(`diagnostic:${id}:${jobId}`).digest("hex").slice(0,32);
      const rewardId = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`;
      tx.data.diagnostics = [...(tx.data.diagnostics ?? []), jobId];
      tx.data.credits += DIAGNOSTIC_REWARD.credits;
      tx.data.xp += DIAGNOSTIC_REWARD.xp;
      tx.reward = {jobId:rewardId,...DIAGNOSTIC_REWARD};
      const result=good(`✅ Заявка №${jobId} выполнена! +${DIAGNOSTIC_REWARD.credits} NET, +${DIAGNOSTIC_REWARD.xp} XP.`);
      tx.saveOperation = {fingerprint:`diagnostic:${jobId}`,result};
      return result;
    });
  }
  /** Caller supplies a server-only equipment availability check, never client world state. */
  command(
    id: string,
    value: unknown,
    canAccept: (job: WorkOrder) => string | null = () => null,
  ) {
    if (!value || typeof value !== "object")
      return Promise.resolve({
        result: bad("Некорректная команда."),
        data: null,
      });
    const a = value as Record<string, unknown>;
    if (a.type === "refresh") return this.refresh(id);
    if (
      !["buy", "accept", "cancel"].includes(String(a.type)) ||
      typeof a.requestId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(a.requestId)
    )
      return Promise.resolve({
        result: bad(
          "Нужен корректный тип действия и уникальный ключ операции.",
        ),
        data: null,
      });
    const allowed =
      a.type === "buy"
        ? ["type", "requestId", "itemId"]
        : ["type", "requestId", "jobId"];
    if (Object.keys(a).some((key) => !allowed.includes(key)))
      return Promise.resolve({
        result: bad("Недопустимые поля команды."),
        data: null,
      });
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([a.type, a.type === "buy" ? a.itemId : a.jobId]))
      .digest("hex");
    return this.store.transaction(id, a.requestId, (tx) => {
      if (tx.operation)
        return tx.operation.fingerprint === fingerprint
          ? { ...tx.operation.result, replayed: true }
          : bad("Ключ операции уже использован для другого действия.");
      refreshBoard(tx.data, this.now());
      const result = this.mutate(tx, a, canAccept);
      tx.saveOperation = { fingerprint, result };
      return result;
    });
  }
  private mutate(
    tx: Transaction,
    a: Record<string, unknown>,
    canAccept: (job: WorkOrder) => string | null,
  ): ProgressResult {
    const d = tx.data;
    if (a.type === "buy") {
      if(d.service?.cases.some(c=>!["RINGING","DECLINED","COMPLETED"].includes(c.stage)))return bad("По клиентской заявке покупайте запчасть у стойки Марата в приложении заявки.");
      if (typeof a.itemId !== "string" || !Object.hasOwn(ITEMS, a.itemId))
        return bad("Неизвестный товар.");
      const id = a.itemId as ItemId,
        item = ITEMS[id];
      if (d.inventory[id] >= (item.consumable ? 99 : 1))
        return bad("Этот предмет уже есть в достаточном количестве.");
      if (d.credits < item.price) return bad("Недостаточно кредитов NET.");
      const bag=bagUsage(d.inventory);
      if(bag.weight+ITEM_WEIGHT[id]>(d.business?.upgrades.includes('service-van')?18:BAG_LIMIT.weight) || bag.slots+Number(d.inventory[id]===0)>BAG_LIMIT.slots)return bad("В рюкзаке нет места.");
      d.credits -= item.price;
      d.inventory[id]++;
      return good(`Куплено: ${item.name} (−${item.price} NET).`);
    }
    const job = d.jobs.find((j) => j.id === a.jobId);
    if (!job) return bad("Заявка не принадлежит этому профилю или устарела.");
    if (a.type === "cancel") {
      if (job.status !== "ACTIVE") return bad("Эта заявка не взята.");
      job.status = "AVAILABLE";
      job.stage = 0;
      job.availableAt = this.now() + 5000;
      return good("Заявка отложена. Повторно взять её можно через 5 секунд.");
    }
    if (job.status !== "AVAILABLE" || job.availableAt > this.now())
      return bad("Этот экземпляр заявки сейчас недоступен.");
    if(d.service?.cases.some(c=>!["RINGING","DECLINED","COMPLETED"].includes(c.stage)))return bad("Сначала завершите клиентскую заявку.");
    if (d.jobs.some((j) => j.status === "ACTIVE"))
      return bad("Сначала завершите или отложите активную заявку.");
    const blocked = canAccept(job);
    if (blocked) return bad(blocked);
    job.status = "ACTIVE";
    job.stage = 0;
    return good(`Заявка принята: ${WORK[job.kind].title}.`);
  }
  /** Only equipment inspection invokes this method, after distance/lease validation. */
  inspect(id: string, jobId: string, verify: () => string | null) {
    return this.store.transaction(id, null, (tx) => {
      const job = tx.data.jobs.find(
        (j) => j.id === jobId && j.status === "ACTIVE",
      );
      if (!job) return bad("Сначала возьмите эту заявку на доске.");
      const error = verify();
      if (error) return bad(error);
      job.stage = 1;
      return good(
        job.kind === "patch"
          ? "Обнаружен отключённый патч-корд. Нужен порт №3."
          : "Обнаружена пыль в охлаждении. Используйте инструменты и баллон для очистки.",
      );
    });
  }
  /** No client message can call completion without a live server equipment check. */
  finish(id: string, jobId: string, verify: () => string | null) {
    return this.store.transaction(id, null, (tx) => {
      const d = tx.data,
        job = d.jobs.find((j) => j.id === jobId);
      if (!job || job.status !== "ACTIVE")
        return bad(
          "Заявка уже выполнена или не взята. Повторная награда недоступна.",
        );
      if (job.stage !== 1)
        return bad("Сначала осмотрите оборудование для этой заявки.");
      const error = verify();
      if (error) return bad(error);
      const rule = WORK[job.kind],
        item = job.tutorial ? null : rule.item;
      if (job.kind === "rack" && d.inventory.toolkit < 1)
        return bad("Нужен набор инструментов.");
      if (item && d.inventory[item] < 1)
        return bad(
          `Не хватает расходника: ${ITEMS[item].name}. Купите его в снабжении.`,
        );
      if (item) d.inventory[item]--;
      job.status = "COMPLETED";
      job.stage = 2;
      job.completedAt = this.now();
      job.availableAt = this.now() + REPEAT_DELAY_MS;
      d.credits += rule.credits;
      d.xp += rule.xp;
      if (job.tutorial) d.tutorialCompleted = true;
      tx.reward = { jobId: job.id, credits: rule.credits, xp: rule.xp };
      return good(
        `✅ Заявка выполнена! ${job.kind === "patch" ? "Сеть восстановлена." : "Охлаждение обслужено."} +${rule.credits} NET, +${rule.xp} XP.`,
      );
    });
  }
}
