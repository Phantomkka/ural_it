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
export function connect() {
  const endpoint =
    import.meta.env.VITE_SERVER_URL ||
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/game`;
  return new Client(endpoint).joinOrCreate<NetworkState>(ROOM_NAME);
}

export function sendEquipment(
  room: Room<NetworkState>,
  action: EquipmentAction,
) {
  room.send("equipment", action);
}
