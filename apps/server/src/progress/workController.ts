import {toggleDoor} from "../doorsState.js";
import {VanController} from '../vans.js';
import type {MoveInput} from '@netcity/shared';
import {handleProp} from "../propsState.js";
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
import { ClientCaseService } from "./clientCases.js";
import {CableService} from './cable.js';
import {BusinessService} from './business.js';
import {CableRoomController} from '../cableRoom.js';
import {CrewService} from './crew.js';
import {EnterpriseService} from './enterprise.js';
import {enterpriseView,type EnterpriseCompany} from '@netcity/shared';
import {crewView,CREW_SHOP,type CrewProject,type CrewObject} from '@netcity/shared';
import {CITY_BUILDINGS,officeLift,officeFloorCount} from '@netcity/shared';
interface Lease {
  sessionId: string;
  profileId: string;
  jobId: string;
  expires: number;
}
const liveSessions=new Set<string>();
/** Serializes world transactions without blocking authoritative movement ticks. */
export class WorkController {
  private companyCodes=new Map<string,string>();
  private async refreshCompany(client:Client,data?:ProfileData,previous?:string){
    const id=this.actors.get(client.sessionId);if(!id)return;const profile=data??await this.service.store.read(id),code=profile.business?.companyCode;
    if(code)this.companyCodes.set(client.sessionId,code);else{this.companyCodes.delete(client.sessionId);this.send(client,'companyState',null);}
    for(const key of new Set([code,previous].filter((x):x is string=>!!x))){const company=await this.service.store.readCompany(key);for(const peer of this.room.clients){const actor=this.actors.get(peer.sessionId);if(this.companyCodes.get(peer.sessionId)===key&&actor){if(company?.members[actor])this.send(peer,'companyState',enterpriseView(company,actor));else{this.companyCodes.delete(peer.sessionId);this.send(peer,'companyState',null);}}}}
  }
  companyCommand(client:Client,value:unknown){this.subscribers.add(client.sessionId);this.enqueue(client,'companyResult',value,async id=>{const previous=this.companyCodes.get(client.sessionId),outcome=await new EnterpriseService(this.service.store).command(id,value,()=>{const p=this.room.state.players.get(client.sessionId);return p?{x:p.x,z:p.z,floor:p.floor,buildingId:p.buildingId}:null;});if(outcome.data)this.profile(client,outcome.data);await this.refreshCompany(client,outcome.data??undefined,previous);this.send(client,'companyResult',{...outcome.result,requestId:typeof(value as any)?.requestId==='string'?(value as any).requestId.slice(0,36):undefined});});}
  private vans:VanController;
  isDriving(session:string){return this.vans.isDriving(session);}
  vanBlocks(p:{x:number;z:number}){return this.vans.blocks(p);}
  freightBlocks(from:{x:number;z:number},to:{x:number;z:number}){return this.vans.blocksFreight(from,to);}
  stepVans(inputs:ReadonlyMap<string,{input:MoveInput;at:number}>,now:number){this.vans.step(inputs,now);}
  vanCommand(client:Client,value:unknown){this.subscribers.add(client.sessionId);this.enqueue(client,'vanResult',value,async id=>{const outcome=await this.vans.command(client,id,value);if(outcome.data){this.profile(client,outcome.data);if(outcome.data.business?.companyCode)await this.refreshCompany(client,outcome.data);}this.send(client,'vanResult',{...outcome.result,requestId:typeof(value as any)?.requestId==='string'?(value as any).requestId.slice(0,36):undefined});});}
  private crewProjects=new Map<string,CrewProject>();
  private crewCodes=new Map<string,string>();
  private syncCrewHands(){for(const [session,id]of this.actors){const player=this.room.state.players.get(session);if(!player)continue;const carrying=[...this.crewProjects.values()].some(p=>p.tasks.some(t=>t.carrier===id&&t.carrierSession===session&&!t.done));if(carrying)player.heldItem='crew_parcel';else if(player.heldItem==='crew_parcel')player.heldItem='';}}
  private async refreshCrew(client:Client){
    const id=this.actors.get(client.sessionId);if(!id)return;const d=await this.service.store.read(id),code=d.projects?.at(-1);if(code){const p=await this.service.store.readProject(code);if(p?.members[id]){this.crewProjects.set(code,p);this.crewCodes.set(client.sessionId,code);}}else{this.crewCodes.delete(client.sessionId);this.send(client,'crewState',null);}
    for(const peer of this.room.clients){const key=this.crewCodes.get(peer.sessionId),p=key&&this.crewProjects.get(key),actor=this.actors.get(peer.sessionId);if(p&&actor&&p.members[actor])this.send(peer,'crewState',crewView(p,actor));}
    this.syncCrewHands();const objects:CrewObject[]=[];
    // Keep the latest site per building, bounded by nine district sites.
    const sites=new Map<string,CrewProject>();for(const p of this.crewProjects.values()){const site=p.templateId.replace(/-(security|network|renewal)$/,'');if(!sites.has(site)||sites.get(site)!.createdAt<p.createdAt)sites.set(site,p);}
    for(const p of sites.values())for(const t of p.tasks){const pt=t.steps[0].point,id=p.id+':'+t.id;if(t.kind==='delivery'&&t.parcel&&!t.done)objects.push({id,kind:'parcel',...t.parcel,done:false,step:t.step,holder:t.carrierSession});if(['camera','replace'].includes(t.kind)&&t.step>0)objects.push({id,kind:t.kind==='camera'?'camera':'cabinet',...pt,done:t.done,step:t.step});if(t.kind==='cable'&&t.step>1)objects.push({id,kind:'cable',...pt,done:t.done,step:t.step,points:t.steps.slice(1,Math.min(t.step,6)).map(s=>s.point)});}
    this.room.broadcast('crewObjects',objects);if(this.crewProjects.size>18)for(const [key,p]of this.crewProjects)if(p.status==='COMPLETE'&&![...this.crewCodes.values()].includes(key))this.crewProjects.delete(key);
  }
  crewCommand(client:Client,value:unknown){this.subscribers.add(client.sessionId);this.enqueue(client,'crewResult', value, async id=>{const outcome=await new CrewService(this.service.store).command(id,value,()=>{const p=this.room.state.players.get(client.sessionId);return p&&!p.floor?{x:p.x,z:p.z,sessionId:client.sessionId}:null;},()=>{const p=this.room.state.players.get(client.sessionId);return !!p&&!p.heldItem;});if(outcome.data)this.profile(client,outcome.data);await this.refreshCrew(client);this.send(client,'crewResult',{...outcome.result,requestId:typeof(value as any)?.requestId==='string'?(value as any).requestId.slice(0,36):undefined});});}
  private lastDoorAction=0;
  private doorActions=new Map<string,number>();
  private actors = new Map<string, string>();
  private subscribers = new Set<string>();
  private leases = new Map<WorkKind, Lease>();
  private budgets = new Map<string, { at: number; tokens: number }>();
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private cableRoom:CableRoomController;
  constructor(
    private room: StreetRoom,
    readonly service: ProgressService,
  ) {this.cableRoom=new CableRoomController(room);this.vans=new VanController(room,service.store);}
  attach(client: Client, id: string) {
    this.actors.set(client.sessionId, id);
    liveSessions.add(client.sessionId);
    this.tail=this.tail.then(async()=>{const outcome=await this.service.store.transaction(id,null,tx=>{
      for(const c of tx.data.service?.cases??[])if(c.carrying&&c.carrier&&!liveSessions.has(c.carrier)){c.carrying=false;c.carrier=undefined;c.droppedAt=c.carryOrigin??null;c.carryOrigin=undefined;}
      const cable=tx.data.cable;if(cable?.carrier&&!liveSessions.has(cable.carrier)){cable.carrier=undefined;cable.endpoint={...cable.points.at(-1)!};}
      const delivery=tx.data.business?.logistics?.delivery;if(delivery?.location==='hands'&&delivery.carrier&&!liveSessions.has(delivery.carrier)){delivery.location='ground';delivery.carrier=undefined;}
      return {ok:true,message:""};
    });this.cableRoom.sync(client,outcome.data);this.vans.bind(client,outcome.data);if(outcome.data.business?.companyCode)await this.refreshCompany(client,outcome.data);await new CrewService(this.service.store).recover(id,liveSessions);await this.refreshCrew(client);}).catch(()=>{});
  }
  detach(client: Client) {
    this.vans.stopSession(client.sessionId);
    const id=this.actors.get(client.sessionId),p=this.room.state.players.get(client.sessionId),position=p?{x:p.x,z:p.z}:undefined;
    liveSessions.delete(client.sessionId);
    this.actors.delete(client.sessionId);
    this.companyCodes.delete(client.sessionId);
    this.subscribers.delete(client.sessionId);
    this.budgets.delete(client.sessionId);this.doorActions.delete(client.sessionId);
    this.cableRoom.forget(client.sessionId);
    for(const prop of this.room.state.props.values())if(prop.holder===client.sessionId){prop.holder="";if(position){prop.x=position.x;prop.z=position.z;}}
    this.tail = this.tail
      .then(async () => {
        if(id)await this.service.store.transaction(id,null,tx=>{for(const c of tx.data.service?.cases??[])if(c.carrying&&c.carrier===client.sessionId){c.carrying=false;c.carrier=undefined;c.droppedAt=position??c.carryOrigin??null;c.carryOrigin=undefined;}const cable=tx.data.cable;if(cable?.carrier===client.sessionId){cable.carrier=undefined;cable.endpoint=position??{...cable.points.at(-1)!};}return {ok:true,message:""};});
        if(id&&position){await this.vans.detach(client.sessionId,position);await new CrewService(this.service.store).dropOnDisconnect(id,position,client.sessionId);}this.crewCodes.delete(client.sessionId);const peer=this.room.clients.find(c=>this.actors.has(c.sessionId));if(peer)await this.refreshCrew(peer);
        for (const [kind, lease] of this.leases)
          if (lease.sessionId === client.sessionId) this.release(kind);
      })
      .catch(() => {});
  }
  private send(client: Client, type: string, value: unknown) {
    if (this.room.state.players.has(client.sessionId)) client.send(type, value);
  }
  private profile(client: Client, data: ProfileData) {
    for(const peer of this.room.clients)if(this.actors.get(peer.sessionId)===data.id)this.cableRoom.sync(peer,data);
    this.syncCrewHands();
    this.vans.sync(data);
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
    requestValue: unknown,
    task: (id: string) => Promise<void>,
  ) {
    const request=requestValue as {requestId?:unknown;pcId?:unknown}|null;
    const failure=(message:string)=>this.send(client,channel,{ok:false,message,requestId:typeof request?.requestId==='string'?request.requestId.slice(0,36):undefined,pcId:typeof request?.pcId==='string'?request.pcId:undefined});
    const now = Date.now(),
      b = this.budgets.get(client.sessionId) ?? { at: now, tokens: 16 };
    b.tokens = Math.min(16, b.tokens + (now - b.at) / 250);
    b.at = now;
    this.budgets.set(client.sessionId, b);
    if (b.tokens < 1 || this.pending >= 64) {
      failure("Слишком много действий. Подождите секунду.");
      return;
    }
    b.tokens--;
    this.pending++;
    this.tail = this.tail
      .then(async () => {
        this.expire();
        const id = this.actors.get(client.sessionId);
        if (id) {if(await this.room.authorize(client)){const p=this.room.state.players.get(client.sessionId);if(p&&(p.liftTarget>=0||p.vehicleId&&channel!=='vanResult')){const v=requestValue as {requestId?:unknown;pcId?:unknown};this.send(client,channel,{ok:false,message:p.vehicleId?'Остановитесь и выйдите из фургона для работы.':'Дождитесь остановки лифта и открытия дверей.',requestId:typeof v?.requestId==='string'?v.requestId.slice(0,36):undefined,pcId:typeof v?.pcId==='string'?v.pcId:undefined});return;}if(p?.floor&&['actionResult'].includes(channel)){this.send(client,channel,{ok:false,message:'Это оборудование находится на первом этаже. Спуститесь на лифте.'});return;}await task(id);}else client.leave(4001);}
      })
      .catch(() => {
        failure("Хранилище прогресса недоступно. Действие не подтверждено; повторите позже.");
        console.error("Не удалось выполнить транзакцию прогресса.");
      })
      .finally(() => {
        this.pending--;
      });
  }
  progress(client: Client, value: unknown) {
    this.subscribers.add(client.sessionId);
    this.enqueue(client, "progressResult", value, async (id) => {
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
  clientCase(client:Client,value:unknown) {
    this.subscribers.add(client.sessionId);
    this.enqueue(client,"caseResult", value, async id=>{
      if(this.room.state.players.get(client.sessionId)?.heldItem.match(/^(prop:|crew_parcel|freight:)/))return this.send(client,"caseResult",{ok:false,message:"Сначала поставьте предмет: G / Положить.",requestId:(value as any)?.requestId});
      const outcome=await new ClientCaseService(this.service.store).command(id,value,()=>{const p=this.room.state.players.get(client.sessionId);return p&&!p.floor?{x:p.x,z:p.z,sessionId:client.sessionId}:null;});
      if(outcome.data) {
        this.profile(client,outcome.data);
        const player=this.room.state.players.get(client.sessionId);
        if(player)this.cableRoom.sync(client,outcome.data);
      }
      this.send(client,"caseResult",{...outcome.result,requestId:typeof (value as any)?.requestId==="string"?(value as any).requestId.slice(0,36):undefined});
    });
  }
  constrainMove(id:string,from:{x:number;z:number},next:{x:number;z:number}){return this.cableRoom.constrain(id,from,next);}
  business(client:Client,value:unknown){this.subscribers.add(client.sessionId);this.enqueue(client,'businessResult', value, async id=>{const outcome=await new BusinessService(this.service.store).command(id,value,()=>{const p=this.room.state.players.get(client.sessionId);return !!p&&!p.floor&&Math.hypot(p.x+6,p.z-2)<=2.5;});if(outcome.data)this.profile(client,outcome.data);this.send(client,'businessResult',{...outcome.result,requestId:typeof (value as any)?.requestId==='string'?(value as any).requestId:undefined});});}
  cable(client:Client,value:unknown){
    this.subscribers.add(client.sessionId);
    this.enqueue(client,'cableResult', value, async id=>{
      if(this.room.state.players.get(client.sessionId)?.heldItem.match(/^(prop:|crew_parcel|freight:)/))return this.send(client,"cableResult",{ok:false,message:"Сначала поставьте предмет: G / Положить.",requestId:(value as any)?.requestId});
      const outcome=await new CableService(this.service.store).command(id,value,()=>{const p=this.room.state.players.get(client.sessionId);return p&&!p.floor?{x:p.x,z:p.z,sessionId:client.sessionId,entryOpen:this.room.state.equipment.officeDoorOpen}:null;});
      if(outcome.data){this.profile(client,outcome.data);this.cableRoom.sync(client,outcome.data);this.syncCrewHands();}
      this.send(client,'cableResult',{...outcome.result,requestId:typeof (value as any)?.requestId==='string'?(value as any).requestId.slice(0,36):undefined});
    });
  }
  interaction(client:Client,value:unknown) {
    this.enqueue(client,"interactionResult", value, async()=>{
      const action=(value as {kind?:string})?.kind,player=this.room.state.players.get(client.sessionId);
      const fail=(message:string)=>this.send(client,"interactionResult",{ok:false,message});
      if(action==='floor'){
        const a=value as {kind:string;buildingId?:string;floor?:number},b=CITY_BUILDINGS.find(b=>b.id===a.buildingId);if(!player||!b||!Number.isInteger(a.floor)||a.floor!<0||a.floor!>=officeFloorCount(b)||Object.keys(a).some(k=>!['kind','buildingId','floor'].includes(k)))return fail('Некорректный этаж.');
        const lift=officeLift(b);if(Math.hypot(player.x-lift.x,player.z-lift.z)>2.2||player.floor>0&&player.buildingId!==b.id)return fail('Подойдите к лифту внутри нужного офиса.');if(player.heldItem)return fail('Поставьте груз перед поездкой на лифте.');
        const last=this.doorActions.get(client.sessionId)??0;if(Date.now()-last<800)return fail('Дождитесь остановки лифта.');if(!this.room.startLift(client,b,a.floor!))return fail('Этот этаж уже выбран.');this.doorActions.set(client.sessionId,Date.now());this.send(client,'interactionResult',{ok:true,message:'Двери закрываются. Едем на этаж '+(a.floor!+1)+'…'});return;
      }
      if(player?.floor)return fail('Воспользуйтесь лифтом для спуска к оборудованию первого этажа.');
      if(action==="cityDoor"){const last=this.doorActions.get(client.sessionId)??0;if(Date.now()-last<800)return fail("Дождитесь движения двери.");this.doorActions.set(client.sessionId,Date.now());this.send(client,"interactionResult",toggleDoor(this.room,client.sessionId,value));return;}
      if(player&&["takeProp","dropProp"].includes(action??"")){this.send(client,"interactionResult",handleProp(this.room.state.props,player,client.sessionId,value,this.room.state.equipment.officeDoorOpen,this.room.state.cars.values(),this.room.state.players.values()));return;}
      if(action==="liftHeavy")return fail("Автомобиль и серверная стойка слишком тяжёлые. Переносите небольшие детали.");
      if(action!=="door"||!player||Math.hypot(player.x-8,player.z)>2.5)return fail("Подойдите к входной двери.");
      if(Date.now()-this.lastDoorAction<800)return fail("Дождитесь движения двери.");
      if(this.room.state.equipment.officeDoorOpen && [...this.room.state.players.values()].some(p=>!p.floor&&Math.abs(p.x-8)<0.7&&Math.abs(p.z)<1.65))return fail("В проёме человек — дверь не закрывается.");
      if(this.room.state.equipment.officeDoorOpen&&[...this.room.state.props.values()].some(p=>!p.holder&&Math.abs(p.x-8)<.7&&Math.abs(p.z)<1.65))return fail("В проёме предмет — дверь не закрывается.");
      if(this.room.state.equipment.officeDoorOpen&&this.cableRoom.blocksDoor())return fail('В проёме проложен кабель. Сначала уберите линию.');
      this.lastDoorAction=Date.now();this.room.state.equipment.officeDoorOpen=!this.room.state.equipment.officeDoorOpen;
      this.send(client,"interactionResult",{ok:true,message:this.room.state.equipment.officeDoorOpen?"Дверь открыта":"Дверь закрыта"});
    });
  }
  computer(client: Client, value: unknown) {
    this.enqueue(client, "computerResult", value, async id => {
      const player=this.room.state.players.get(client.sessionId)!;
      if(player.floor)return this.send(client,"computerResult",{ok:false,message:"Этот терминал находится на первом этаже.",pcId:(value as any)?.pcId});
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
    this.enqueue(client, "actionResult", value, async (id) => {
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
    await this.vans.idle();
  }
}
