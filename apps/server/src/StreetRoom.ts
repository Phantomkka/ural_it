import { Room, type Client } from "@colyseus/core";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { handleComputer } from "./computerActions.js";
import {
  NetworkDevice,
  JobProgress,
  createDevices,
  createJobs,
} from "./networkState.js";
import { handleEquipment } from "./equipment.js";
import {
  advance,
  isMoveInput,
  TICK_RATE,
  type MoveInput,
} from "@netcity/shared";
export class Player extends Schema {
  declare jobs: MapSchema<JobProgress>;
  declare nickname: string;
  declare ticketStep: number;
  declare rewards: number;
  declare x: number;
  declare z: number;
  declare yaw: number;
  constructor() {
    super();
    this.jobs = createJobs();
    this.nickname = "";
    this.ticketStep = 1;
    this.rewards = 0;
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
  }
}
defineTypes(Player, {
  jobs: { map: JobProgress },
  nickname: "string",
  x: "number",
  z: "number",
  yaw: "number",
  ticketStep: "number",
  rewards: "number",
});
export class Equipment extends Schema {
  declare port3Connected: boolean;
  constructor() {
    super();
    this.port3Connected = false;
  }
}
defineTypes(Equipment, { port3Connected: "boolean" });
export class StreetState extends Schema {
  declare devices: MapSchema<NetworkDevice>;
  declare equipment: Equipment;
  declare players: MapSchema<Player>;
  constructor() {
    super();
    this.devices = createDevices();
    this.players = new MapSchema<Player>();
    this.equipment = new Equipment();
  }
}
defineTypes(StreetState, {
  players: { map: Player },
  equipment: Equipment,
  devices: { map: NetworkDevice },
});
const IDLE: MoveInput = { forward: 0, strafe: 0, yaw: 0 };
export class StreetRoom extends Room<{ state: StreetState }> {
  maxClients = 32;
  private nextNickname = 1;
  private actionBudgets = new Map<string, { tokens: number; at: number }>();
  private inputs = new Map<string, { input: MoveInput; at: number }>();
  onCreate() {
    this.setState(new StreetState());
    this.setPatchRate(1000 / TICK_RATE);
    this.onMessage("move", (client, value: unknown) => {
      if (isMoveInput(value))
        this.inputs.set(client.sessionId, {
          input: { ...value },
          at: performance.now(),
        });
    });
    this.onMessage("equipment", (client, value: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (player)
        client.send(
          "actionResult",
          handleEquipment(player, this.state.equipment, value),
        );
    });
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
      const player = this.state.players.get(client.sessionId);
      if (player)
        client.send(
          "computerResult",
          handleComputer(
            player,
            this.state.devices,
            this.state.equipment,
            value,
          ),
        );
    });
    // Messages only replace intent. Only this fixed-rate loop can move players.
    this.setSimulationInterval(() => {
      const now = performance.now();
      this.state.players.forEach((player, id) => {
        const entry = this.inputs.get(id);
        const input = entry && now - entry.at < 250 ? entry.input : IDLE;
        Object.assign(player, advance(player, input, 1 / TICK_RATE));
        if (player.x > 5 && Math.abs(player.z) < 3)
          player.ticketStep = Math.max(player.ticketStep, 2);
        if (player.x > 13.5 && player.x < 20 && Math.abs(player.z) < 5.5)
          player.ticketStep = Math.max(player.ticketStep, 3);
        if (entry) player.yaw = entry.input.yaw;
      });
    }, 1000 / TICK_RATE);
  }
  onJoin(client: Client) {
    const player = new Player();
    player.nickname = `Инженер ${String(this.nextNickname++).padStart(2, "0")}`;
    player.z = (this.state.players.size % 10) * 2 - 10;
    this.state.players.set(client.sessionId, player);
  }
  onLeave(client: Client) {
    this.actionBudgets.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }
}
