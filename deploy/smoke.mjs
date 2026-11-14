import { Client } from "@colyseus/sdk";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = (process.env.NETCITY_URL ?? "http://127.0.0.1:18080").replace(
  /\/$/,
  "",
);
const endpoint = base.replace(/^http/, "ws") + "/game";
const until = async (check, label = "condition") => {
  const end = Date.now() + 12000;
  while (!check()) {
    if (Date.now() > end) throw Error(`Timed out: ${label}`);
    await new Promise((r) => setTimeout(r, 20));
  }
};
const rooms = [];
async function connect(token) {
  const room = await new Client(endpoint).joinOrCreate("street", {
    guestToken: token,
  });
  room.reconnection.enabled = false;
  rooms.push(room);
  let profile = null;
  const actions = [],
    operations = [];
  room.onMessage("profile", (p) => (profile = p));
  room.onMessage("actionResult", (r) => actions.push(r));
  room.onMessage("progressResult", (r) => operations.push(r));
  room.send("progress", { type: "refresh" });
  await until(() => profile, "private profile");
  return {
    room,
    get profile() {
      return profile;
    },
    actions,
    operations,
  };
}
async function guest() {
  const r = await fetch(base + "/game/guest", { method: "POST" });
  assert.equal(r.status, 200);
  return (await r.json()).token;
}
try {
  const health = await fetch(base + "/game/health");
  assert.equal(health.status, 200);
  const healthData = await health.json();
  assert.equal(healthData.persistence, "postgres");
  const index = await fetch(base + "/");
  assert.match(await index.text(), /\/assets\/index-[^" ]+\.js/);
  const versionResponse = await fetch(base + "/version.json");
  assert.equal(versionResponse.status, 200);
  assert.equal((await versionResponse.json()).revision, healthData.revision);
  if (process.argv[2] === "--verify") {
    const proof = JSON.parse(await readFile(process.argv[3], "utf8"));
    const a = await connect(proof.token);
    for (const key of ["credits", "xp", "inventory"])
      assert.deepEqual(a.profile[key], proof.profile[key]);
    assert.ok(proof.purchase, "Proof must include the original purchase key");
    if (proof.purchase) {
      a.room.send("progress", proof.purchase);
      await until(
        () => a.operations.some((r) => r.replayed),
        "persistent operation ledger",
      );
      for (const key of ["credits", "xp", "inventory"])
        assert.deepEqual(a.profile[key], proof.profile[key]);
    }
    console.log(
      JSON.stringify({
        persistence: "verified after restart",
        credits: a.profile.credits,
        xp: a.profile.xp,
        inventory: a.profile.inventory,
      }),
    );
  } else {
    const token = await guest(),
      a = await connect(token),
      b = await connect(await guest());
    await until(
      () => a.room.state.players.size === 2 && b.room.state.players.size === 2,
      "two players",
    );
    const me = () => a.room.state.players.get(a.room.sessionId);
    async function move(axis, goal) {
      const direction = Math.sign(goal - me()[axis]);
      if (!direction) return;
      const yaw =
        axis === "x" ? (direction * Math.PI) / 2 : direction > 0 ? 0 : Math.PI;
      const send = () => a.room.send("move", { forward: 1, strafe: 0, yaw });
      send();
      const timer = setInterval(send, 33);
      try {
        await until(
          () => direction * (me()[axis] - goal) >= 0,
          "movement " + axis,
        );
      } finally {
        clearInterval(timer);
        a.room.send("move", { forward: 0, strafe: 0, yaw });
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    await move("z", -0.25);
    for (let i = 0; i < 8 && (me().z < -0.6 || me().z > 0.7); i++) {
      const yaw = me().z > 0 ? Math.PI : 0;
      a.room.send("move", { forward: 1, strafe: 0, yaw });
      await new Promise((r) => setTimeout(r, 60));
      a.room.send("move", { forward: 0, strafe: 0, yaw });
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(me().z >= -0.6 && me().z <= 0.7);
    await move("x", 16);
    await until(
      () => b.room.state.players.get(a.room.sessionId).x >= 16,
      "replicated movement",
    );
    const initialB = b.room.state.players.get(b.room.sessionId).x;
    b.room.send("move", { forward: 0, strafe: 1, yaw: 0 });
    await until(
      () => a.room.state.players.get(b.room.sessionId).x > initialB + 0.3,
      "reverse replicated movement",
    );
    b.room.send("move", { forward: 0, strafe: 0, yaw: 0 });
    const act = async (value) => {
      const n = a.actions.length;
      a.room.send("equipment", value);
      await until(() => a.actions.length > n, "equipment action");
      return a.actions.at(-1);
    };
    assert.equal((await act({ type: "inspect" })).ok, true);
    assert.equal((await act({ type: "connect", port: 2 })).ok, false);
    assert.equal((await act({ type: "connect", port: 3 })).ok, true);
    await until(
      () => a.profile.credits === 100 && b.room.state.equipment.port3Connected,
      "reward and shared repair",
    );
    assert.equal((await act({ type: "connect", port: 3 })).ok, false);
    assert.equal(a.profile.credits, 100);
    assert.equal(b.profile.credits, 0);
    const purchase = {
      type: "buy",
      itemId: "patch_cord",
      requestId: randomUUID(),
    };
    a.room.send("progress", purchase);
    await until(() => a.profile.credits === 70, "purchase");
    a.room.send("progress", purchase);
    await until(() => a.operations.some((r) => r.replayed), "idempotent retry");
    assert.equal(a.profile.inventory.patch_cord, 1);
    for (const key of ["credits", "inventory", "xp"])
      assert.equal(
        JSON.stringify(b.room.state.toJSON()).includes(`"${key}":`),
        false,
      );
    const proof = {
      token,
      purchase,
      profile: {
        credits: a.profile.credits,
        xp: a.profile.xp,
        inventory: a.profile.inventory,
      },
    };
    if (process.env.NETCITY_PROOF_FILE)
      await writeFile(process.env.NETCITY_PROOF_FILE, JSON.stringify(proof), {
        mode: 0o600,
        flag: "wx",
      });
    console.log(
      JSON.stringify({
        players: 2,
        movement: "synchronized",
        repair: "verified",
        duplicateReward: "rejected",
        purchaseRetry: "idempotent",
        privateBalances: true,
        credits: a.profile.credits,
        xp: a.profile.xp,
        inventory: a.profile.inventory,
      }),
    );
  }
} finally {
  await Promise.all(rooms.map((room) => room.leave().catch(() => {})));
}
