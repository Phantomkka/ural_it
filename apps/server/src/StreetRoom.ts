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
  advance,
  isMoveInput,
  TICK_RATE,
  type MoveInput,
} from "@netcity/shared";
export class Player extends Schema {
  declare nickname: string;
  declare ticketStep: number;
  declare rewards: number;
  declare x: number;
  declare z: number;
  declare yaw: number;
  constructor() {
    super();
    this.nickname = "";
    this.ticketStep = 1;
    this.rewards = 0;
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
  }
}
defineTypes(Player, {
  nickname: "string",
  x: "number",
  z: "number",
  yaw: "number",
  ticketStep: "number",
  rewards: "number",
});
export class Equipment extends Schema {
  declare port3Connected: boolean;
  declare rackServiced: boolean;
  declare patchWorkId: string;
  declare rackWorkId: string;
  constructor() {
    super();
    this.port3Connected = false;
    this.rackServiced = false;
    this.patchWorkId = "";
    this.rackWorkId = "";
  }
}
defineTypes(Equipment, {
  port3Connected: "boolean",
  rackServiced: "boolean",
  patchWorkId: "string",
  rackWorkId: "string",
});
export class StreetState extends Schema {
  declare equipment: Equipment;
  declare players: MapSchema<Player>;
  constructor() {
    super();
    this.players = new MapSchema<Player>();
    this.equipment = new Equipment();
  }
}
defineTypes(StreetState, { players: { map: Player }, equipment: Equipment });
const IDLE: MoveInput = { forward: 0, strafe: 0, yaw: 0 };
export class StreetRoom extends Room<{ state: StreetState }> {
  maxClients = 32;
  protected progressStore: ProgressStore = new MemoryProgressStore();
  private work!: WorkController;
  private inputs = new Map<string, { input: MoveInput; at: number }>();
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
  async onAuth(_client: Client, options: { guestToken?: unknown }) {
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
    player.ticketStep = data.tutorialCompleted ? 6 : 1;
    player.rewards = data.tutorialCompleted ? 1 : 0;
    player.z = (this.state.players.size % 10) * 2 - 10;
    this.state.players.set(client.sessionId, player);
    this.work.attach(client, auth.profileId);
  }
  async onDispose() {
    await this.work.idle();
  }
  onLeave(client: Client) {
    this.work.detach(client);
    this.inputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }
}
