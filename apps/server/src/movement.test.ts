import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, isMoveInput, MOVE_SPEED, TICK_RATE } from '@netcity/shared';
test('rejects malformed and nonfinite movement', () => {
  for (const input of [null, {}, { forward: 50, strafe: 0, yaw: 0 }, { forward: 0, strafe: 0, yaw: NaN }, { forward: '1', strafe: 0, yaw: 0 }]) assert.equal(isMoveInput(input), false);
});
test('diagonals and oversized time steps cannot exceed speed cap', () => {
  const next = advance({ x: 0, z: 0 }, { forward: 1, strafe: 1, yaw: 0 }, 10);
  assert.ok(Math.hypot(next.x, next.z) <= MOVE_SPEED / TICK_RATE + 1e-10);
});
test('world boundary and building collision block movement', () => {
  assert.equal(advance({ x: 45, z: 0 }, { forward: 0, strafe: 1, yaw: 0 }, 1).x, 45);
  assert.equal(advance({ x: 7.5, z: 0 }, { forward: 0, strafe: 1, yaw: 0 }, 1).x, 7.5);
});
