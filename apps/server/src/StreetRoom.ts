import {DoorState,createDoors} from "./doorsState.js";
import {WorkVanState,GroundFreightState} from './vans.js';
import {CarryObject,createProps} from "./propsState.js";
import {propBlocksMove} from "@netcity/shared";
import {Vehicle,createCars,advanceCity} from "./cityState.js";
import {carBlocksPoint} from "@netcity/shared";
import {officeLift,liftTravelDuration,type CityBuilding} from '@netcity/shared';
import { Room, type Client } from "@colyseus/core";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { ServerError } from "@colyseus/core";
import { WorkController } from "./progress/workController.js";
import { ProgressService } from "./progress/service.js";
import {
  MemoryProgressStore,
  type ProgressStore,
  validToken,
} from "./progress/store.js";
import {
  NetworkDevice,
  JobProgress,
  createDevices,
  createJobs,
} from "./networkState.js";
import {
  advance,
  isMoveInput,
  TICK_RATE,
  JOBS,
  type MoveInput,
} from "@netcity/shared";
export class Player extends Schema {
  declare vehicleId:string;
  declare liftTarget:number;declare liftStarted:number;declare liftUntil:number;
  declare floor:number;declare buildingId:string;
  declare cablePath:string;
  declare heldItem:string;
  declare jobs: MapSchema<JobProgress>;
  declare nickname: string;
  declare ticketStep: number;
  declare rewards: number;
  declare x: number;
  declare z: number;
  declare yaw: number;
  constructor() {
    super();
    this.vehicleId='';
    this.liftTarget=-1;this.liftStarted=0;this.liftUntil=0;
    this.floor=0;this.buildingId='';
    this.cablePath='';
    this.jobs = createJobs();
    this.nickname = "";
    this.heldItem="";
    this.ticketStep = 1;
    this.rewards = 0;
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
  }
}
defineTypes(Player, {
  vehicleId:'string',
  liftTarget:'number',liftStarted:'number',liftUntil:'number',
  floor:'number',buildingId:'string',
  cablePath:'string',
  heldItem:"string",
  jobs: { map: JobProgress },
  nickname: "string",
  x: "number",
  z: "number",
  yaw: "number",
  ticketStep: "number",
  rewards: "number",
});
export class Equipment extends Schema {
  declare officeDoorOpen:boolean;
  declare port3Connected: boolean;
  declare rackServiced: boolean;
  declare patchWorkId: string;
  declare rackWorkId: string;
  constructor() {
    super();
    this.port3Connected = false;
    this.officeDoorOpen=true;
    this.rackServiced = false;
    this.patchWorkId = "";
    this.rackWorkId = "";
  }
}
defineTypes(Equipment, {
  officeDoorOpen:"boolean",
  port3Connected: "boolean",
  rackServiced: "boolean",
  patchWorkId: "string",
  rackWorkId: "string",
});
export class StreetState extends Schema {
  declare freight:MapSchema<GroundFreightState>;
  declare vans:MapSchema<WorkVanState>;
  declare doors:MapSchema<DoorState>;
  declare props:MapSchema<CarryObject>;
  declare cars:MapSchema<Vehicle>;declare worldClock:number;declare trafficPhase:string;
  declare devices: MapSchema<NetworkDevice>;
  declare equipment: Equipment;
  declare players: MapSchema<Player>;
  constructor() {
    super();
    this.vans=new MapSchema<WorkVanState>();
    this.freight=new MapSchema<GroundFreightState>();
    this.doors=createDoors();this.props=createProps();this.cars=createCars();this.worldClock=Date.now();this.trafficPhase="DRIVE";
    this.devices = createDevices();
    this.players = new MapSchema<Player>();
    this.equipment = new Equipment();
  }
}
defineTypes(StreetState, {freight:{map:GroundFreightState},vans:{map:WorkVanState},doors:{map:DoorState},props:{map:CarryObject},cars:{map:Vehicle},worldClock:"number",trafficPhase:"string",
  players: { map: Player },
  equipment: Equipment,
  devices: { map: NetworkDevice },
});
const IDLE: MoveInput = { forward: 0, strafe: 0, yaw: 0 };
export class StreetRoom extends Room<{ state: StreetState }> {
  startLift(client:Client,b:CityBuilding,floor:number){
    const player=this.state.players.get(client.sessionId)!;
    if(player.liftTarget>=0||floor===player.floor)return false;
    player.buildingId=b.id;player.liftTarget=floor;player.liftStarted=Date.now();
    player.liftUntil=player.liftStarted+liftTravelDuration(player.floor,floor);
    Object.assign(player,officeLift(b));this.inputs.delete(client.sessionId);return true;
  }
  maxClients = 32;
  protected progressStore: ProgressStore = new MemoryProgressStore();
  private work!: WorkController;
  private actionBudgets = new Map<string, { tokens: number; at: number }>();
  private inputs = new Map<string, { input: MoveInput; at: number }>();
  async authorize(_client:Client){return true;}
  onCreate() {
    this.setState(new StreetState());
    this.work = new WorkController(
      this,
      new ProgressService(this.progressStore),
    );
    this.setPatchRate(1000 / TICK_RATE);
    this.onMessage("move", (client, value: unknown) => {
      if (isMoveInput(value))
        this.inputs.set(client.sessionId, {
          input: { ...value },
          at: performance.now(),
        });
    });
    this.onMessage("equipment", (client, value: unknown) =>
      this.work.equipment(client, value),
    );
    this.onMessage("progress", (client, value: unknown) =>
      this.work.progress(client, value),
    );
    this.onMessage("case",(client,value:unknown)=>this.work.clientCase(client,value));
    this.onMessage('cable',(client,value:unknown)=>this.work.cable(client,value));
    this.onMessage('business',(client,value:unknown)=>this.work.business(client,value));
    this.onMessage('crew',(client,value:unknown)=>this.work.crewCommand(client,value));
    this.onMessage('van',(client,value:unknown)=>this.work.vanCommand(client,value));
    this.onMessage("interaction",(client,value:unknown)=>this.work.interaction(client,value));
    this.onMessage("computer", (client, value: unknown) => {
      const now = performance.now();
      const budget = this.actionBudgets.get(client.sessionId) ?? {
        tokens: 20,
        at: now,
      };
      budget.tokens = Math.min(20, budget.tokens + (now - budget.at) / 100);
      budget.at = now;
      this.actionBudgets.set(client.sessionId, budget);
      if (budget.tokens < 1) {
        client.send("computerResult", {
          ok: false,
          message: "Слишком много действий. Подождите секунду.",
        });
        return;
      }
      budget.tokens--;
      if (this.state.players.has(client.sessionId)) this.work.computer(client,value);
    });
    // Messages only replace intent. Only this fixed-rate loop can move players.
    let cityTick=0;
    this.setSimulationInterval(() => {
      const now = performance.now();
      this.state.players.forEach((player, id) => {
        if(this.work.isDriving(id))return;
        if(player.liftTarget>=0){
          if(Date.now()>=player.liftUntil){player.floor=player.liftTarget;player.liftTarget=-1;if(!player.floor)player.buildingId='';this.inputs.delete(id);this.clients.find(c=>c.sessionId===id)?.send('interactionResult',{ok:true,message:'Этаж '+(player.floor+1)+'. Двери открыты.'});}
          return;
        }
        const entry = this.inputs.get(id);
        const input = entry && now - entry.at < 250 ? entry.input : IDLE;
        const carrying=player.heldItem==='cable_roll'||player.heldItem==='crew_parcel'||player.heldItem.startsWith('prop:')||player.heldItem.startsWith('freight:'),movement=carrying?{...input,sprint:false}:input;
        const next=this.work.constrainMove(id,player,advance(player,movement,(carrying?(player.heldItem==='freight:server'?.4:.6):1)/TICK_RATE,this.state.equipment.officeDoorOpen,this.state.doors,player.floor?player.buildingId:undefined));
        if(player.floor||!this.work.vanBlocks(next)&&!this.work.freightBlocks(player,next)&&![...this.state.cars.values()].some(car=>carBlocksPoint(next,car))&&![...this.state.props.values()].some(prop=>propBlocksMove(player,next,prop)))Object.assign(player,next);
        if (!player.floor && player.x > 5 && Math.abs(player.z) < 3)
          player.ticketStep = Math.max(player.ticketStep, 2);
        if (!player.floor && player.x > 13.5 && player.x < 20 && Math.abs(player.z) < 5.5)
          player.ticketStep = Math.max(player.ticketStep, 3);
        if (entry) player.yaw = entry.input.yaw;
      });
    this.work.stepVans(this.inputs,now);
    if(++cityTick%3===0){this.state.trafficPhase=advanceCity(this.state.cars,[...[...this.state.players.values()].filter(p=>!p.floor),...[...this.state.vans.values()].flatMap(v=>[-1.5,0,1.5].map(offset=>({x:v.x+Math.sin(v.yaw)*offset,z:v.z+Math.cos(v.yaw)*offset}))),...this.state.props.values()].filter(p=>!('holder' in p)||!p.holder),Date.now());}
      if(cityTick%30===0)this.state.worldClock=Date.now();
    }, 1000 / TICK_RATE);
  }
  async onAuth(_client: Client, options: { guestToken?: unknown }, _context?:unknown) {
    if (options.guestToken === undefined)
      return { profileId: (await this.progressStore.register()).profileId };
    if (!validToken(options.guestToken))
      throw new ServerError(401, "Некорректный гостевой токен.");
    const id = await this.progressStore.identify(options.guestToken);
    if (!id)
      throw new ServerError(
        this.progressStore.mode === "temporary" ? 410 : 401,
        this.progressStore.mode === "temporary"
          ? "TEMP_PROFILE_EXPIRED"
          : "Гостевой профиль не найден.",
      );
    return { profileId: id };
  }
  async onJoin(client: Client, _options: unknown, auth: { profileId: string }) {
    const data = await this.progressStore.read(auth.profileId);
    const player = new Player();
    player.nickname = data.nickname;
    player.heldItem="";
    player.ticketStep = data.tutorialCompleted ? 6 : 1;
    player.rewards = Number(data.tutorialCompleted) + (data.diagnostics?.length ?? 0);
    for (const job of JOBS) if(data.diagnostics?.includes(job.id)) {
      const progress=player.jobs.get(job.id)!;progress.stage=job.steps.length;progress.status="COMPLETED";
    }
    player.z = (this.state.players.size % 10) * 2 - 10;
    this.state.players.set(client.sessionId, player);
    this.work.attach(client, auth.profileId);
  }
  async onDispose() {
    await this.work.idle();
  }
  onLeave(client: Client) {
    this.work.detach(client);
    this.actionBudgets.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }
}
