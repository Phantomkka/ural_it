import { Room, type Client } from '@colyseus/core';
import { Schema, MapSchema, defineTypes } from '@colyseus/schema';
import { advance, isMoveInput, TICK_RATE, type MoveInput } from '@netcity/shared';
export class Player extends Schema {
  declare x: number; declare z: number; declare yaw: number;
  constructor() { super(); this.x = 0; this.z = 0; this.yaw = 0; }
}
defineTypes(Player, { x: 'number', z: 'number', yaw: 'number' });
export class StreetState extends Schema {
  declare players: MapSchema<Player>;
  constructor() { super(); this.players = new MapSchema<Player>(); }
}
defineTypes(StreetState, { players: { map: Player } });
const IDLE: MoveInput = { forward: 0, strafe: 0, yaw: 0 };
export class StreetRoom extends Room<{ state: StreetState }> {
  maxClients = 32;
  private inputs = new Map<string, { input: MoveInput; at: number }>();
  onCreate() {
    this.setState(new StreetState());
    this.setPatchRate(1000 / TICK_RATE);
    this.onMessage('move', (client, value: unknown) => {
      if (isMoveInput(value)) this.inputs.set(client.sessionId, { input: { ...value }, at: performance.now() });
    });
    // Messages only replace intent. Only this fixed-rate loop can move players.
    this.setSimulationInterval(() => {
      const now = performance.now();
      this.state.players.forEach((player, id) => {
        const entry = this.inputs.get(id);
        const input = entry && now - entry.at < 250 ? entry.input : IDLE;
        Object.assign(player, advance(player, input, 1 / TICK_RATE));
        if (entry) player.yaw = entry.input.yaw;
      });
    }, 1000 / TICK_RATE);
  }
  onJoin(client: Client) {
    const player = new Player();
    player.z = (this.state.players.size % 10) * 2 - 10;
    this.state.players.set(client.sessionId, player);
  }
  onLeave(client: Client) {
    this.inputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }
}
