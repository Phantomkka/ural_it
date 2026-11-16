import {FIELD_COLLIDERS} from './fieldSites.js';
export * from './fieldSites.js';
import {SERVICE_FURNITURE,PARKED_CARS} from './furniture.js';
import {CITY_FENCES} from './worldGeometry.js';
export * from './worldGeometry.js';
export * from './diagnosticLab.js';
export * from './logistics.js';
export * from './enterprise.js';
import {CITY_BUILDINGS,CITY_WALLS,CITY_DOORS,DISTRICT_FURNITURE,doorLeaf,doorClosed} from './buildings.js';
import {upperColliders,OFFICE_REAR_FURNITURE,officeLiftWalls,insideOffice} from './officeFloors.js';
export * from './officeFloors.js';
export * from './buildings.js';
export * from './furniture.js';
export const ROOM_NAME = "street";
export const TICK_RATE = 30;
export const MOVE_SPEED = 5;
export const SPRINT_MULTIPLIER = 1.5;
export const WORLD_LIMIT = 45;
export const EYE_HEIGHT = 1.7;
export interface MoveInput {
  sprint?: boolean;
  forward: number;
  strafe: number;
  yaw: number;
}
export const BUILDINGS = CITY_BUILDINGS;
export function isMoveInput(value: unknown): value is MoveInput {
  if (!value || typeof value !== "object") return false;
  const v = value as MoveInput;
  return (
    (v.sprint === undefined || typeof v.sprint === "boolean") &&
    [v.forward, v.strafe, v.yaw].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) &&
    Math.abs(v.forward) <= 1 &&
    Math.abs(v.strafe) <= 1 &&
    Math.abs(v.yaw) <= Math.PI * 2
  );
}
export function advance(
  position: { x: number; z: number },
  input: MoveInput,
  dt: number,
  entryOpen = true,
  doors?:ReadonlyMap<string,{open:boolean}>,
  upperBuilding?:string,
) {
  const magnitude = Math.max(1, Math.hypot(input.forward, input.strafe));
  const distance = MOVE_SPEED * (input.sprint === true ? SPRINT_MULTIPLIER : 1) * Math.max(0, Math.min(dt, 1 / TICK_RATE));
  const dx =
    ((Math.sin(input.yaw) * input.forward +
      Math.cos(input.yaw) * input.strafe) /
      magnitude) *
    distance;
  const dz =
    ((Math.cos(input.yaw) * input.forward -
      Math.sin(input.yaw) * input.strafe) /
      magnitude) *
    distance;
  const blocked = (x: number, z: number) =>
    (upperBuilding?upperColliders(upperBuilding):movementColliders(entryOpen,doors)).some(
      (b) =>
        Math.abs(x - b.x) < b.width / 2 + 0.4 &&
        Math.abs(z - b.z) < b.depth / 2 + 0.4,
    );
  let x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, position.x + dx));
  if (blocked(x, position.z)) x = position.x;
  let z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, position.z + dz));
  if (blocked(x, z)) z = position.z;
  return { x, z };
}

export const INTERACTION_RANGE = 2.5;
export const SWITCH = { x: 18, y: 1.7, z: 0 };
export const OFFICE = BUILDINGS.find((b) => b.x === 14 && b.z === 0)!;
export const OFFICE_WALLS = [
  { x: 8, z: -3.6, width: 0.3, depth: 4.8 },
  { x: 8, z: 3.6, width: 0.3, depth: 4.8 },
  { x: 28, z: 0, width: 0.3, depth: 12 },
  { x: 18, z: -6, width: 20, depth: 0.3 },
  { x: 18, z: 6, width: 20, depth: 0.3 },
  { x: 13, z: -3.6, width: 0.3, depth: 4.8 },
  { x: 13, z: 3.6, width: 0.3, depth: 4.8 },
  { x: 18.5, z: 0, width: 0.8, depth: 1.6 },
];
// The open leaves occupy the same footprint used by the scene.
export const OFFICE_DOORS = [8, 13].map((x) => ({
  x: x + 0.8,
  z: -1.15,
  width: 1.6,
  depth: 0.12,
}));
export const ENTRY_DOOR_CLOSED={x:8,z:-0.35,width:0.12,depth:1.6};
export const STREET_DETAILS = [-1, 1].flatMap((side) =>
  [-28, -12, 12, 28].map((z) => ({ x: side * 6.8, z })),
);
export const WORLD_COLLIDERS = [
  ...FIELD_COLLIDERS,
  ...CITY_FENCES,
  ...OFFICE_REAR_FURNITURE,...CITY_BUILDINGS.flatMap(officeLiftWalls),
  ...SERVICE_FURNITURE,
  ...PARKED_CARS,
  ...CITY_WALLS,
  ...DISTRICT_FURNITURE,
  ...CITY_DOORS.filter(d=>d.id!=='hq-server').map(doorLeaf),
  ...OFFICE_WALLS,
  ...OFFICE_DOORS,
  ...STREET_DETAILS.map((p) => ({ ...p, width: 0.25, depth: 0.25 })),
  ...[-1, 1].flatMap((side) =>
    [-22, 22].map((z) => ({ x: side * 7, z, width: 1.5, depth: 2 })),
  ),
];
export function movementColliders(entryOpen=true,doors?:ReadonlyMap<string,{open:boolean}>){
 const closed=CITY_DOORS.filter(d=>doors?.get(d.id)?.open===false);
 if(entryOpen&&!closed.length)return WORLD_COLLIDERS;
 return [...WORLD_COLLIDERS.filter(c=>!(c===OFFICE_DOORS[0]&&!entryOpen)&&!closed.some(d=>Math.abs(c.x-(d.x+d.side*.8))<.01&&Math.abs(c.z-(d.z-1.15))<.01&&c.width===1.6)),...(!entryOpen?[ENTRY_DOOR_CLOSED]:[]),...closed.map(doorClosed)];
}
export const TICKET_STEPS = [
  "Получить заявку",
  "Найти офис №001 (справа, вход напротив центра улицы)",
  "Зайти в серверную",
  "Осмотреть коммутатор",
  "Обнаружить отключённый патч-корд",
  "Подключить кабель в порт №3",
  "Сеть восстановлена",
];
export type EquipmentAction =
  | { type: "inspect" | "inspectRack" | "serviceRack" }
  | { type: "connect"; port: number };
export interface ActionResult {
  ok: boolean;
  message: string;
  inspected?: boolean;
}
export interface PlayerView {
  vehicleId?:string;
  liftTarget?:number;liftStarted?:number;liftUntil?:number;
  floor?:number;buildingId?:string;
  cablePath?:string;
  heldItem?:string;
  nickname: string;
  x: number;
  z: number;
  yaw: number;
  ticketStep: number;
  rewards: number;
}
export interface EquipmentView {
  officeDoorOpen?:boolean;
  port3Connected: boolean;
  rackServiced?: boolean;
  patchWorkId?: string;
  rackWorkId?: string;
}
export function canReachSwitch(player: { x: number; z: number }) {
  return (
    Number.isFinite(player.x) &&
    Number.isFinite(player.z) &&
    player.x > 13.5 &&
    insideOffice(player,OFFICE) &&
    Math.abs(player.z) < 5.45 &&
    Math.hypot(player.x - SWITCH.x, player.z - SWITCH.z) <= INTERACTION_RANGE
  );
}
export * from "./progression.js";
export * from "./officeNetwork.js";
export * from "./company.js";
export * from "./clientCases.js";
export * from './cable.js';
export * from './city.js';
export * from './caseCatalog.js';
export * from './business.js';

export * from "./props.js";

export {CASE_KIND_NAMES} from './betaCatalog.js';
export * from './crew.js';
