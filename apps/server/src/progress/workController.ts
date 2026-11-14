import { randomUUID } from "node:crypto";
import type { Client } from "@colyseus/core";
import {
  canReachSwitch,
  canReachComputer,
  JOBS,
  type ComputerId,
  type WorkKind,
  type WorkOrder,
  type ActionResult,
} from "@netcity/shared";
import type { StreetRoom } from "../StreetRoom.js";
import { ProgressService } from "./service.js";
import { snapshot, type ProfileData } from "./store.js";
import { handleComputer } from "../computerActions.js";
interface Lease {
  sessionId: string;
  profileId: string;
  jobId: string;
  expires: number;
}
/** Serializes world transactions without blocking authoritative movement ticks. */
export class WorkController {
  private actors = new Map<string, string>();
  private subscribers = new Set<string>();
  private leases = new Map<WorkKind, Lease>();
  private budgets = new Map<string, { at: number; tokens: number }>();
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  constructor(
    private room: StreetRoom,
    readonly service: ProgressService,
  ) {}
  attach(client: Client, id: string) {
    this.actors.set(client.sessionId, id);
  }
  detach(client: Client) {
    this.actors.delete(client.sessionId);
    this.subscribers.delete(client.sessionId);
    this.budgets.delete(client.sessionId);
    this.tail = this.tail
      .then(() => {
        for (const [kind, lease] of this.leases)
          if (lease.sessionId === client.sessionId) this.release(kind);
      })
      .catch(() => {});
  }
  private send(client: Client, type: string, value: unknown) {
    if (this.room.state.players.has(client.sessionId)) client.send(type, value);
  }
  private profile(client: Client, data: ProfileData) {
    if (this.subscribers.has(client.sessionId))
      this.send(client, "profile", snapshot(data, this.service.store.mode));
  }
  private release(kind: WorkKind) {
    this.leases.delete(kind);
    this.room.state.equipment[kind === "patch" ? "patchWorkId" : "rackWorkId"] =
      "";
  }
  private expire() {
    for (const [kind, lease] of this.leases)
      if (lease.expires < Date.now()) this.release(kind);
  }
  private busy(id: string, job: WorkOrder) {
    const l = this.leases.get(job.kind);
    return l && (l.profileId !== id || l.jobId !== job.id)
      ? "Оборудование обслуживает другой инженер. Выберите другую работу или дождитесь освобождения."
      : null;
  }
  private claim(id: string, job: WorkOrder, sessionId: string) {
    const prior = this.leases.get(job.kind);
    this.leases.set(job.kind, {
      sessionId,
      profileId: id,
      jobId: job.id,
      expires: Date.now() + 60_000,
    });
    const e = this.room.state.equipment;
    e[job.kind === "patch" ? "patchWorkId" : "rackWorkId"] = job.id;
    if (prior?.jobId !== job.id)
      e[job.kind === "patch" ? "port3Connected" : "rackServiced"] = false;
  }
  private enqueue(
    client: Client,
    channel: string,
    task: (id: string) => Promise<void>,
  ) {
    const now = Date.now(),
      b = this.budgets.get(client.sessionId) ?? { at: now, tokens: 16 };
    b.tokens = Math.min(16, b.tokens + (now - b.at) / 250);
    b.at = now;
    this.budgets.set(client.sessionId, b);
    if (b.tokens < 1 || this.pending >= 64) {
      this.send(client, channel, {
        ok: false,
        message: "Слишком много действий. Подождите секунду.",
      });
      return;
    }
    b.tokens--;
    this.pending++;
    this.tail = this.tail
      .then(async () => {
        this.expire();
        const id = this.actors.get(client.sessionId);
        if (id) await task(id);
      })
      .catch(() => {
        this.send(client, channel, {
          ok: false,
          message:
            "Хранилище прогресса недоступно. Действие не подтверждено; повторите позже.",
        });
        console.error("Не удалось выполнить транзакцию прогресса.");
      })
      .finally(() => {
        this.pending--;
      });
  }
  progress(client: Client, value: unknown) {
    this.subscribers.add(client.sessionId);
    this.enqueue(client, "progressResult", async (id) => {
      const outcome = await this.service.command(id, value, (job) =>
        this.busy(id, job),
      );
      const a = value as { type?: string; jobId?: string };
      if (outcome.result.ok && !outcome.result.replayed && outcome.data) {
        if (a.type === "accept") {
          const active = outcome.data.jobs.find(
            (j) => j.id === a.jobId && j.status === "ACTIVE",
          );
          if (active) this.claim(id, active, client.sessionId);
        }
        if (a.type === "cancel")
          for (const [kind, l] of this.leases)
            if (l.profileId === id && l.jobId === a.jobId) this.release(kind);
      }
      if (outcome.data) this.profile(client, outcome.data);
      this.send(client, "progressResult", {
        ...outcome.result,
        requestId:
          typeof (value as { requestId?: unknown })?.requestId === "string"
            ? (value as { requestId: string }).requestId.slice(0, 36)
            : undefined,
      });
    });
  }
  computer(client: Client, value: unknown) {
    this.enqueue(client, "computerResult", async id => {
      const player=this.room.state.players.get(client.sessionId)!;
      const action=value as {type?:string;pcId?:ComputerId} | null;
      const job=JOBS.find(j=>j.pcId===action?.pcId);
      const progress=job && player.jobs.get(job.id);
      const prior=progress && {stage:progress.stage,status:progress.status,rewards:player.rewards};
      const result=handleComputer(player,this.room.state.devices,this.room.state.equipment,value);
      if (result.ok && action?.type==="closeTicket" && job && progress && prior) {
        // Keep the session task retryable until the transaction commits.
        progress.stage=prior.stage; progress.status=prior.status; player.rewards=prior.rewards;
        const revision=this.room.state.devices.get(job.pcId)!.revision;
        const outcome=await this.service.finishDiagnostic(id,job.id,()=> {
          if(!this.room.state.players.has(client.sessionId) || !canReachComputer(player,job.pcId)) return "Подойдите к компьютеру для завершения работы.";
          if(this.room.state.devices.get(job.pcId)!.revision!==revision) return "Настройки изменились. Повторите диагностику.";
          return null;
        });
        if(outcome.result.ok) {progress.stage=job.steps.length;progress.status="COMPLETED";player.rewards=prior.rewards+1;}
        this.profile(client,outcome.data);
        this.send(client,"computerResult",{...result,...outcome.result,pcId:job.pcId});
      } else this.send(client,"computerResult",result);
    });
  }
  equipment(client: Client, value: unknown) {
    this.enqueue(client, "actionResult", async (id) => {
      const player = this.room.state.players.get(client.sessionId)!;
      const fail = (message: string) =>
        this.send(client, "actionResult", { ok: false, message });
      if (!canReachSwitch(player))
        return fail("Подойдите к коммутатору на расстояние до 2,5 м.");
      if (!value || typeof value !== "object")
        return fail("Недопустимое действие.");
      const a = value as { type?: string; port?: unknown };
      if (
        !["inspect", "connect", "inspectRack", "serviceRack"].includes(
          a.type ?? "",
        )
      )
        return fail("Недопустимое действие.");
      const kind: WorkKind =
        a.type === "inspectRack" || a.type === "serviceRack" ? "rack" : "patch";
      if (a.type === "connect" && a.port !== 3)
        return fail("Нужен порт №3. Другие порты уже заняты.");
      let data = (await this.service.refresh(id)).data;
      let job = data.jobs.find((j) => j.status === "ACTIVE");
      // Preserve first-ticket E workflow: inspection is acceptance of the free tutorial only.
      if (!job && a.type === "inspect" && !data.tutorialCompleted) {
        const tutorial = data.jobs.find(
          (j) => j.tutorial && j.status === "AVAILABLE",
        );
        if (tutorial) {
          const accepted = await this.service.command(
            id,
            { type: "accept", jobId: tutorial.id, requestId: randomUUID() },
            (j) => this.busy(id, j),
          );
          if (accepted.data) data = accepted.data;
          if (!accepted.result.ok) return fail(accepted.result.message);
          job = data.jobs.find((j) => j.status === "ACTIVE");
          if (job) this.claim(id, job, client.sessionId);
        }
      }
      if (a.type === "inspect" && (!job || job.kind !== "patch")) {
        this.profile(client, data);
        return this.send(client, "actionResult", {
          ok: true,
          inspected: true,
          message: data.tutorialCompleted
            ? "Вводная заявка уже выполнена. Новую работу можно взять на доске."
            : "Выбрана другая заявка. Для стойки нажмите «Осмотреть охлаждение».",
        });
      }
      if (!job || job.kind !== kind)
        return fail(
          data.tutorialCompleted && kind === "patch"
            ? "Заявка уже выполнена. Повторная награда недоступна."
            : "Сначала возьмите соответствующую заявку на доске.",
        );
      const order = job;
      const verify = () =>
        !this.room.state.players.has(client.sessionId) ||
        !canReachSwitch(player)
          ? "Взаимодействие прервано: подойдите к оборудованию."
          : this.busy(id, order);
      if (a.type === "inspect" || a.type === "inspectRack") {
        const outcome = await this.service.inspect(id, job.id, verify);
        if (outcome.result.ok) {
          this.claim(id, job, client.sessionId);
          if (kind === "patch")
            player.ticketStep = Math.max(player.ticketStep, 5);
        }
        this.profile(client, outcome.data);
        this.send(client, "actionResult", {
          ...outcome.result,
          inspected: outcome.result.ok,
        });
        return;
      }
      const outcome = await this.service.finish(id, job.id, () => {
        const error = verify();
        if (error) return error;
        const lease = this.leases.get(kind);
        if (
          lease?.jobId !== job!.id ||
          lease.profileId !== id ||
          lease.expires < Date.now()
        )
          return "Сначала заново осмотрите оборудование: резервирование истекло.";
        return this.room.state.equipment[
          kind === "patch" ? "port3Connected" : "rackServiced"
        ]
          ? "Это оборудование уже исправлено."
          : null;
      });
      if (outcome.result.ok) {
        this.room.state.equipment[
          kind === "patch" ? "port3Connected" : "rackServiced"
        ] = true;
        this.release(kind);
        if (kind === "patch") {
          player.ticketStep = 6;
          player.rewards = Number(outcome.data.tutorialCompleted) + (outcome.data.diagnostics?.length ?? 0);
        }
      }
      if (
        !outcome.result.ok &&
        outcome.data.jobs.find((j) => j.id === job!.id)?.status === "COMPLETED"
      )
        this.release(kind);
      this.profile(client, outcome.data);
      this.send(client, "actionResult", outcome.result satisfies ActionResult);
    });
  }
  async idle() {
    await this.tail;
  }
}
