export const ROOM_NAME = "street";
export const TICK_RATE = 30;
export const MOVE_SPEED = 5;
export const WORLD_LIMIT = 45;
export const EYE_HEIGHT = 1.7;
export interface MoveInput {
  forward: number;
  strafe: number;
  yaw: number;
}
export const BUILDINGS = [-1, 1].flatMap((side) =>
  Array.from({ length: 5 }, (_, i) => ({
    x: side * 14,
    z: (i - 2) * 17,
    width: 12,
    depth: 12,
    height: 7 + (i % 3) * 4,
  })),
);
export function isMoveInput(value: unknown): value is MoveInput {
  if (!value || typeof value !== "object") return false;
  const v = value as MoveInput;
  return (
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
) {
  const magnitude = Math.max(1, Math.hypot(input.forward, input.strafe));
  const distance = MOVE_SPEED * Math.max(0, Math.min(dt, 1 / TICK_RATE));
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
    [...BUILDINGS.filter((b) => b !== OFFICE), ...OFFICE_WALLS].some(
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
  { x: 20, z: 0, width: 0.3, depth: 12 },
  { x: 14, z: -6, width: 12, depth: 0.3 },
  { x: 14, z: 6, width: 12, depth: 0.3 },
  { x: 13, z: -3.6, width: 0.3, depth: 4.8 },
  { x: 13, z: 3.6, width: 0.3, depth: 4.8 },
  { x: 18.5, z: 0, width: 0.8, depth: 1.6 },
];
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
  { type: "inspect" } | { type: "connect"; port: number };
export interface ActionResult {
  ok: boolean;
  message: string;
  inspected?: boolean;
}
export interface PlayerView {
  x: number;
  z: number;
  yaw: number;
  ticketStep: number;
  rewards: number;
}
export interface EquipmentView {
  port3Connected: boolean;
}
export function canReachSwitch(player: { x: number; z: number }) {
  return (
    Number.isFinite(player.x) &&
    Number.isFinite(player.z) &&
    player.x > 13.5 &&
    Math.hypot(player.x - SWITCH.x, player.z - SWITCH.z) <= INTERACTION_RANGE
  );
}
