import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, type Room } from '@colyseus/sdk';
import { createGameServer } from './server.js';
import { ROOM_NAME, MOVE_SPEED } from '@netcity/shared';
import type { StreetState } from './StreetRoom.js';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 4000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Timed out waiting for synchronized state'); await sleep(20); }
}
test('two players share server movement, resist message flooding and leave cleanly', async () => {
  const server = createGameServer();
  await server.listen(26789, '127.0.0.1');
  const rooms: Room<StreetState>[] = [];
  try {
    const client = new Client('ws://127.0.0.1:26789');
    const a = await client.joinOrCreate<StreetState>(ROOM_NAME); rooms.push(a);
    const b = await client.joinOrCreate<StreetState>(ROOM_NAME); rooms.push(b);
    assert.equal(a.roomId, b.roomId);
    await until(() => a.state.players?.size === 2 && b.state.players?.size === 2);
    const initial = a.state.players.get(a.sessionId)!.z;
    const start = performance.now();
    for (let i = 0; i < 500; i++) a.send('move', { forward: 1, strafe: 0, yaw: 0 });
    await until(() => b.state.players.get(a.sessionId)!.z > initial + 0.1);
    await sleep(400);
    const observed = b.state.players.get(a.sessionId)!;
    assert.ok(observed.z - initial <= MOVE_SPEED * ((performance.now() - start) / 1000 + 0.1));
    assert.ok(Math.abs(observed.z - a.state.players.get(a.sessionId)!.z) < 0.2);
    const stopped = observed.z;
    a.send('move', { forward: 1000, strafe: 0, yaw: 0 });
    await sleep(200); assert.equal(b.state.players.get(a.sessionId)!.z, stopped);
    await a.leave(); rooms.splice(rooms.indexOf(a), 1);
    await until(() => b.state.players.size === 1 && !b.state.players.has(a.sessionId));
  } finally { for (const room of rooms) await room.leave(); await server.gracefullyShutdown(false); }
});
