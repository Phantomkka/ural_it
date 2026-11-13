import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client, type Room } from "@colyseus/sdk";
import { matchMaker } from "@colyseus/core";
import {
  ROOM_NAME,
  type PrivateProfile,
  type ActionResult,
  type ProgressResult,
} from "@netcity/shared";
import { createGameServer } from "./server.js";
import { MemoryProgressStore } from "./progress/store.js";
import type { StreetRoom, StreetState } from "./StreetRoom.js";
const until = async (check: () => boolean) => {
  const end = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > end) throw Error("Replication timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
};
test("two clients share equipment; wallets remain private, claimed jobs cannot be stolen and disconnects release work", async () => {
  const store = new MemoryProgressStore(),
    server = createGameServer({ store });
  await server.listen(26793, "127.0.0.1");
  const rooms: Room<StreetState>[] = [];
  try {
    const ga = await store.register(),
      gb = await store.register(),
      client = new Client("ws://127.0.0.1:26793");
    const a = await client.joinOrCreate<StreetState>(ROOM_NAME, {
      guestToken: ga.token,
    });
    rooms.push(a);
    const b = await client.joinOrCreate<StreetState>(ROOM_NAME, {
      guestToken: gb.token,
    });
    rooms.push(b);
    const profilesA: PrivateProfile[] = [],
      profilesB: PrivateProfile[] = [],
      resultsA: ActionResult[] = [],
      resultsB: ActionResult[] = [],
      progressB: ProgressResult[] = [],
      progressA: ProgressResult[] = [];
    a.onMessage("profile", (p) => profilesA.push(p));
    b.onMessage("profile", (p) => profilesB.push(p));
    a.onMessage("actionResult", (r) => resultsA.push(r));
    b.onMessage("actionResult", (r) => resultsB.push(r));
    a.onMessage("progressResult", (r) => progressA.push(r));
    b.onMessage("progressResult", (r) => progressB.push(r));
    a.send("progress", { type: "refresh" });
    b.send("progress", { type: "refresh" });
    await until(
      () =>
        profilesA.length > 0 &&
        profilesB.length > 0 &&
        b.state.players.size === 2,
    );
    const world = matchMaker.getLocalRoomById(a.roomId) as StreetRoom;
    const pa = world.state.players.get(a.sessionId)!,
      pb = world.state.players.get(b.sessionId)!;
    pa.x = 16;
    pa.z = 0;
    pb.x = 16;
    pb.z = 1;
    a.send("equipment", { type: "inspect" });
    await until(() => resultsA.length === 1);
    assert.equal(resultsA[0].ok, true);
    b.send("equipment", { type: "inspect", playerId: ga.profileId });
    await until(() => resultsB.length === 1);
    assert.equal(resultsB[0].ok, false);
    b.send("equipment", {
      type: "connect",
      port: 3,
      jobId: profilesA.at(-1)!.jobs[0].id,
      completeJob: true,
    });
    await until(() => resultsB.length === 2);
    assert.equal(resultsB[1].ok, false);
    assert.equal((await store.read(gb.profileId)).credits, 0);
    a.send("equipment", { type: "connect", port: 3 });
    await until(
      () =>
        profilesA.at(-1)!.credits === 100 && b.state.equipment.port3Connected,
    );
    assert.equal(profilesB.at(-1)!.credits, 0);
    const publicState = JSON.stringify(b.state.toJSON());
    for (const key of ["credits", "inventory", "xp", ga.token, gb.token])
      assert.equal(publicState.includes(key), false);
    const buy = { type: "buy", itemId: "patch_cord", requestId: randomUUID() };
    for (let i = 0; i < 80; i++) a.send("progress", buy);
    await until(
      () =>
        progressA.some((r) => r.message.includes("Слишком много")) &&
        profilesA.at(-1)!.credits === 70,
    );
    assert.equal((await store.read(ga.profileId)).inventory.patch_cord, 1);
    const rack = profilesB.at(-1)!.jobs.find((j) => j.kind === "rack")!;
    b.send("progress", {
      type: "accept",
      jobId: rack.id,
      requestId: randomUUID(),
    });
    await until(() =>
      progressB.some((r) => r.ok && r.message.includes("принята")),
    );
    b.send("equipment", { type: "inspectRack" });
    await until(() => resultsB.length === 3);
    assert.equal(resultsB[2].ok, true);
    b.send("equipment", { type: "serviceRack" });
    await until(() => resultsB.length === 4);
    assert.equal(resultsB[3].ok, false);
    assert.equal(b.state.equipment.rackServiced, false);
    await b.leave();
    rooms.splice(rooms.indexOf(b), 1);
    await until(
      () => a.state.players.size === 1 && a.state.equipment.rackWorkId === "",
    );
    const reborn = await client.joinOrCreate<StreetState>(ROOM_NAME, {
      guestToken: ga.token,
    });
    rooms.push(reborn);
    assert.equal((await store.read(ga.profileId)).credits, 70);
    await assert.rejects(
      client.joinOrCreate(ROOM_NAME, { guestToken: "0".repeat(64) }),
    );
    const intruder = await client.joinOrCreate<StreetState>(ROOM_NAME, {
      playerId: ga.profileId,
    });
    rooms.push(intruder);
    await until(() => intruder.state.players?.has(intruder.sessionId));
    assert.notEqual(
      intruder.state.players.get(intruder.sessionId)!.nickname,
      pa.nickname,
    );
  } finally {
    for (const room of rooms) await room.leave();
    await server.gracefullyShutdown(false);
    await store.close();
  }
});
