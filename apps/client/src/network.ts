import { Client, type Room } from "@colyseus/sdk";
import {
  ROOM_NAME,
  type PlayerView,
  type EquipmentView,
  type EquipmentAction,
  type ProgressAction,
} from "@netcity/shared";
export type NetworkPlayer = PlayerView;
export interface NetworkState {
  players: Map<string, NetworkPlayer>;
  equipment: EquipmentView;
}
let transientToken: string | null = null;
export async function connect() {
  const endpoint =
    import.meta.env.VITE_SERVER_URL ||
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/game`;
  const storageKey = "netcity-guest-token";
  const getToken = () => {
    try {
      return sessionStorage.getItem(storageKey) ?? transientToken;
    } catch {
      return transientToken;
    }
  };
  const createGuest = async () => {
    const response = await fetch(
      endpoint.replace(/^ws/, "http").replace(/\/$/, "") + "/guest",
      { method: "POST", cache: "no-store", credentials: "omit" },
    );
    const value = await response.json();
    if (!response.ok)
      throw Error(value.message ?? "Не удалось создать гостевой профиль.");
    if (typeof value.token !== "string" || !/^[a-f0-9]{64}$/.test(value.token))
      throw Error("Некорректный ответ гостевого входа.");
    transientToken = value.token;
    try {
      sessionStorage.setItem(storageKey, value.token);
    } catch {
      /* A restricted browser keeps this token only until reconnect. */
    }
    return value.token as string;
  };
  let token = getToken() ?? (await createGuest());
  let room: Room<NetworkState>;
  try {
    room = await new Client(endpoint).joinOrCreate<NetworkState>(ROOM_NAME, {
      guestToken: token,
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 410) throw error;
    token = await createGuest();
    room = await new Client(endpoint).joinOrCreate<NetworkState>(ROOM_NAME, {
      guestToken: token,
    });
  }
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

export function sendProgress(room: Room<NetworkState>, action: ProgressAction) {
  room.send("progress", action);
}
