import { Client, type Room } from "@colyseus/sdk";
import {
  ROOM_NAME,
  type PlayerView,
  type EquipmentView,
  type EquipmentAction,
} from "@netcity/shared";
export type NetworkPlayer = PlayerView;
export interface NetworkState {
  players: Map<string, NetworkPlayer>;
  equipment: EquipmentView;
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
