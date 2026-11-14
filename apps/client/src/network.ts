import { Client, type Room } from "@colyseus/sdk";
import { acquireIdentity, replaceExpiredIdentity } from "./identity";
import {gameEndpoint} from './endpoint';
import {accountSession,accountExpected} from './auth';
import {
  ROOM_NAME,
  type PlayerView,
  type DeviceView,
  type ProgressView,
  type ComputerAction,
  type EquipmentView,
  type EquipmentAction,
  type ProgressAction,
} from "@netcity/shared";
export type NetworkPlayer = PlayerView & { jobs: Map<string, ProgressView> };
export interface NetworkState {
  players: Map<string, NetworkPlayer>;
  equipment: EquipmentView;
  devices: Map<string, DeviceView>;
}
export async function connect() {
  const endpoint=gameEndpoint();
  const account=await accountSession();
  if(account.login){
    const room=await new Client(endpoint).joinOrCreate<NetworkState>(ROOM_NAME,{account:true});
    room.reconnection.enabled=false;return room;
  }
  if(accountExpected())throw Object.assign(Error('Сессия завершена. Войдите в аккаунт; прогресс не заменён гостем.'),{code:'ACCOUNT_REQUIRED'});
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
    return value.token as string;
  };
  let token = await acquireIdentity(createGuest);
  let room: Room<NetworkState>;
  try {
    room = await new Client(endpoint).joinOrCreate<NetworkState>(ROOM_NAME, {
      guestToken: token,
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 410) throw error;
    token = await replaceExpiredIdentity(token,createGuest);
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

export function sendComputer(room: Room<NetworkState>, action: ComputerAction) {
  room.send("computer", action);
}
