import { Client, type Room } from "@colyseus/sdk";
import {
  ROOM_NAME,
  type PlayerView,
  type DeviceView,
  type ProgressView,
  type ComputerAction,
  type EquipmentView,
  type EquipmentAction,
} from "@netcity/shared";
export type NetworkPlayer = PlayerView & { jobs: Map<string, ProgressView> };
export interface NetworkState {
  players: Map<string, NetworkPlayer>;
  equipment: EquipmentView;
  devices: Map<string, DeviceView>;
}
export async function connect() {
  const endpoint =
    import.meta.env.VITE_SERVER_URL ||
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/game`;
  const room = await new Client(endpoint).joinOrCreate<NetworkState>(ROOM_NAME);
  // Server sessions do not support resume: avoid buffered movement replay on a stale session.
  room.reconnection.enabled = false;
  return room;
}

export function sendEquipment(
  room: Room<NetworkState>,
  action: EquipmentAction,
) {
  room.send("equipment", action);
}

const closing = new WeakSet<Room<NetworkState>>();
export function leaveRoom(room: Room<NetworkState>) {
  if (closing.has(room)) return;
  closing.add(room);
  room.reconnection.enabled = false;
  if (room.connection.isOpen) void room.leave().catch(() => {});
}

export function sendComputer(room: Room<NetworkState>, action: ComputerAction) {
  room.send("computer", action);
}
