export const ROOM_NAME = 'street';
export const TICK_RATE = 30;
export const MOVE_SPEED = 5;
export const WORLD_LIMIT = 45;
export const EYE_HEIGHT = 1.7;
export interface MoveInput { forward: number; strafe: number; yaw: number }
export const BUILDINGS = [-1, 1].flatMap(side => Array.from({ length: 5 }, (_, i) => ({
  x: side * 14, z: (i - 2) * 17, width: 12, depth: 12, height: 7 + (i % 3) * 4,
})));
export function isMoveInput(value: unknown): value is MoveInput {
  if (!value || typeof value !== 'object') return false;
  const v = value as MoveInput;
  return [v.forward, v.strafe, v.yaw].every(n => typeof n === 'number' && Number.isFinite(n))
    && Math.abs(v.forward) <= 1 && Math.abs(v.strafe) <= 1 && Math.abs(v.yaw) <= Math.PI * 2;
}
export function advance(position: { x: number; z: number }, input: MoveInput, dt: number) {
  const magnitude = Math.max(1, Math.hypot(input.forward, input.strafe));
  const distance = MOVE_SPEED * Math.max(0, Math.min(dt, 1 / TICK_RATE));
  const dx = (Math.sin(input.yaw) * input.forward + Math.cos(input.yaw) * input.strafe) / magnitude * distance;
  const dz = (Math.cos(input.yaw) * input.forward - Math.sin(input.yaw) * input.strafe) / magnitude * distance;
  const blocked = (x: number, z: number) => BUILDINGS.some(b => Math.abs(x - b.x) < b.width / 2 + 0.4 && Math.abs(z - b.z) < b.depth / 2 + 0.4);
  let x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, position.x + dx));
  if (blocked(x, position.z)) x = position.x;
  let z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, position.z + dz));
  if (blocked(x, z)) z = position.z;
  return { x, z };
}
