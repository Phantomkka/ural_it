import { Client } from '@colyseus/sdk';
import { ROOM_NAME } from '@netcity/shared';
export interface NetworkPlayer { x: number; z: number; yaw: number }
export interface NetworkState { players: Map<string, NetworkPlayer> }
export function connect() {
  const endpoint = import.meta.env.VITE_SERVER_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/game`;
  return new Client(endpoint).joinOrCreate<NetworkState>(ROOM_NAME);
}
