import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPUTERS,
  GATEWAY,
  MASK,
  canReachComputer,
  type ComputerId,
} from "@netcity/shared";
import { Player, Equipment } from "./StreetRoom.js";
import { createDevices } from "./networkState.js";
import { handleComputer } from "./computerActions.js";
import { validConfig } from "./networkSimulator.js";
function fixture(id: ComputerId = "pc02") {
  const player = new Player(),
    devices = createDevices(),
    equipment = new Equipment();
  equipment.port3Connected = true;
  const pc = COMPUTERS.find((p) => p.id === id)!;
  player.x = pc.x - 0.8;
  player.z = pc.z;
  const act = (type: string, extra: object = {}) =>
    handleComputer(player, devices, equipment, { type, pcId: id, ...extra });
  const command = (command: string) => act("command", { command });
  return { player, devices, equipment, act, command };
}
function pc02(f: ReturnType<typeof fixture>) {
  f.act("open");
  f.act("terminal");
  f.command("ipconfig");
  f.act("inspectCable");
  f.act("connectCable");
  f.command("ping 192.168.10.1");
}
const config = (ip: string, dns = GATEWAY) => ({
  ip,
  mask: MASK,
  gateway: GATEWAY,
  dns,
});
test("PC02 cable diagnosis, repair, verification, manual closure and no repeated reward", () => {
  const f = fixture();
  assert.equal(f.command("ping 192.168.10.1").ok, false);
  assert.equal(f.act("closeTicket").ok, false);
  assert.equal(f.player.rewards, 0);
  pc02(f);
  assert.equal(f.player.jobs.get("002")!.stage, 6);
  assert.equal(f.player.jobs.get("002")!.status, "IN_PROGRESS");
  assert.equal(f.act("closeTicket").ok, true);
  assert.equal(f.player.rewards, 1);
  assert.equal(f.act("closeTicket").ok, false);
  assert.equal(f.player.rewards, 1);
});
test("PC03 diagnosis and correction require correct IP, mask and gateway followed by ping", () => {
  const f = fixture("pc03");
  f.act("open");
  f.act("terminal");
  assert.equal(f.command("ping 192.168.10.1").ok, false);
  assert.equal(f.player.jobs.get("003")!.stage, 2);
  assert.match(f.command("ipconfig").output!, /192.168.20.103/);
  f.act("settings");
  f.act("configure", { config: config("192.168.20.103") });
  assert.equal(f.player.jobs.get("003")!.stage, 4);
  f.act("configure", { config: config("192.168.10.103") });
  assert.equal(f.act("closeTicket").ok, false);
  assert.equal(f.command("ping 192.168.10.1").ok, true);
  assert.equal(f.act("closeTicket").ok, true);
});
test("PC01 requires gateway test, failed DNS lookup, settings correction and successful lookup", () => {
  const f = fixture("pc01");
  f.act("open");
  f.act("terminal");
  f.command("ping 192.168.10.1");
  assert.equal(f.command("nslookup intranet.netcity.local").ok, false);
  f.act("settings");
  f.act("configure", { config: config("192.168.10.101") });
  assert.equal(f.act("closeTicket").ok, false);
  assert.equal(f.command("nslookup intranet.netcity.local").ok, true);
  assert.equal(f.act("closeTicket").ok, true);
});
test("all computer actions validate distance, room walls, finite coordinates and device IDs", () => {
  const f = fixture();
  for (const pos of [
    { x: 0, z: 0 },
    { x: 12.4, z: 4 },
    { x: 15, z: 6.2 },
    { x: NaN, z: 4 },
    { x: Infinity, z: 4 },
  ]) {
    Object.assign(f.player, pos);
    assert.equal(
      f.act("configure", { config: config("192.168.10.102") }).ok,
      false,
    );
    assert.equal(f.act("connectCable").ok, false);
  }
  assert.equal(f.devices.get("pc02")!.interfaces.get("eth0")!.connected, false);
  assert.equal(
    handleComputer(f.player, f.devices, f.equipment, {
      type: "open",
      pcId: "__proto__",
    }).ok,
    false,
  );
  assert.equal(canReachComputer({ x: 7.9, z: -4 }, "pc01"), false);
});
test("malformed addresses, duplicate IPs, completion spoofing and shell text are rejected", () => {
  const f = fixture();
  for (const ip of [
    "999.1.1.1",
    "1.1.1",
    "192.168.10.0",
    "192.168.10.255",
    "01.1.1.1",
  ])
    assert.equal(validConfig(config(ip)), false);
  assert.equal(
    f.act("configure", { config: config("192.168.10.101") }).ok,
    false,
  );
  assert.equal(
    f.act("configure", {
      config: { ...config("192.168.10.102"), mask: "255.0.0.0" },
    }).ok,
    false,
  );
  assert.equal(f.act("complete", { rewards: 999, stage: 7 }).ok, false);
  for (const command of [
    "cat /etc/passwd",
    "ping 192.168.10.1; id",
    "$(whoami)",
    "a".repeat(129),
  ])
    assert.equal(f.command(command).ok, false);
  assert.equal(f.player.rewards, 0);
  assert.equal(f.player.jobs.get("002")!.stage, 0);
});
test("stale verification cannot close a ticket after shared configuration changes", () => {
  const f = fixture();
  pc02(f);
  f.act("configure", {
    config: { ...config("192.168.10.102"), dns: "192.168.10.254" },
  });
  assert.equal(f.act("closeTicket").ok, false);
  f.command("ping 192.168.10.1");
  assert.equal(f.act("closeTicket").ok, true);
});
test("another engineer can independently confirm an already repaired PC without another fault", () => {
  const f = fixture();
  pc02(f);
  f.act("closeTicket");
  const second = new Player();
  second.x = f.player.x;
  second.z = f.player.z;
  const act = (type: string, extra: object = {}) =>
    handleComputer(second, f.devices, f.equipment, {
      type,
      pcId: "pc02",
      ...extra,
    });
  act("open");
  act("terminal");
  act("command", { command: "ipconfig" });
  act("inspectCable");
  act("connectCable");
  act("command", { command: "ping 192.168.10.1" });
  assert.equal(act("closeTicket").ok, true);
  assert.equal(second.rewards, 1);
  assert.equal(f.player.rewards, 1);
  assert.equal(second.jobs.get("003")!.stage, 0);
});
test("ticket001 uplink, target power and physical connections affect virtual commands", () => {
  const f = fixture();
  f.act("connectCable");
  f.equipment.port3Connected = false;
  assert.equal(f.command("ping 192.168.10.1").ok, false);
  f.equipment.port3Connected = true;
  assert.equal(f.command("tracert 192.168.10.1").ok, true);
  f.devices.get("router")!.powered = false;
  assert.equal(f.command("ping 192.168.10.1").ok, false);
  f.devices.get("switch")!.powered = false;
  assert.equal(f.command("ping 192.168.10.102").ok, false);
  assert.equal(f.command("clear").clear, true);
  assert.match(f.command("help").output!, /учебный|Учебный/);
});

test("real Colyseus clients share cables and configuration but never another player progress", async () => {
  const { Client } = await import("@colyseus/sdk");
  const { matchMaker } = await import("@colyseus/core");
  const { createGameServer } = await import("./server.js");
  const { ROOM_NAME } = await import("@netcity/shared");
  const server = createGameServer();
  await server.listen(26790, "127.0.0.1");
  const client = new Client("ws://127.0.0.1:26790");
  const rooms: import("@colyseus/sdk").Room<
    import("./StreetRoom.js").StreetState
  >[] = [];
  const until = async (check: () => boolean) => {
    const end = Date.now() + 5000;
    while (!check()) {
      if (Date.now() > end) throw Error("Replication timeout");
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  try {
    const a =
      await client.joinOrCreate<import("./StreetRoom.js").StreetState>(
        ROOM_NAME,
      );
    rooms.push(a);
    const b =
      await client.joinOrCreate<import("./StreetRoom.js").StreetState>(
        ROOM_NAME,
      );
    rooms.push(b);
    await until(
      () => b.state.players?.size === 2 && a.state.devices?.size === 6,
    );
    const authority = matchMaker.getLocalRoomById(
      a.roomId,
    ) as import("./StreetRoom.js").StreetRoom;
    const pa = authority.state.players.get(a.sessionId)!,
      pb = authority.state.players.get(b.sessionId)!;
    authority.state.equipment.port3Connected = true;
    pa.x = 14.2;
    pa.z = 4;
    pb.x = 14.2;
    pb.z = 4;
    const results: import("@netcity/shared").ComputerResult[] = [];
    a.onMessage("computerResult", (r) => results.push(r));
    const act = async (type: string, extra: object = {}) => {
      const n = results.length;
      a.send("computer", { type, pcId: "pc02", ...extra });
      await until(() => results.length > n);
      return results.at(-1)!;
    };
    for (const type of ["open", "terminal"])
      assert.equal((await act(type)).ok, true);
    await act("command", { command: "ipconfig" });
    await act("inspectCable");
    await act("connectCable");
    await until(
      () => b.state.devices.get("pc02")!.interfaces.get("eth0")!.connected,
    );
    await act("command", { command: "ping 192.168.10.1" });
    assert.equal((await act("closeTicket")).ok, true);
    await until(() => a.state.players.get(a.sessionId)!.rewards === 1);
    assert.equal(b.state.players.get(b.sessionId)!.jobs.get("002")!.stage, 0);
    pa.x = 9.2;
    pa.z = 4;
    await act("configure", { pcId: "pc03", config: config("192.168.10.103") });
    await until(
      () =>
        b.state.devices.get("pc03")!.interfaces.get("eth0")!.ip ===
        "192.168.10.103",
    );
    assert.equal(pb.jobs.get("003")!.stage, 0);
    const before = pa.rewards;
    for (let i = 0; i < 80; i++)
      a.send("computer", { type: "closeTicket", pcId: "pc02", rewards: 999 });
    await until(() => results.some((r) => r.message.includes("Слишком много")));
    assert.equal(pa.rewards, before);
    await a.leave();
    rooms.shift();
    await until(() => b.state.players.size === 1);
    const c =
      await client.joinOrCreate<import("./StreetRoom.js").StreetState>(
        ROOM_NAME,
      );
    rooms.push(c);
    await until(
      () =>
        c.state.devices?.get("pc02")?.interfaces.get("eth0")?.connected ===
        true,
    );
    assert.equal(
      c.state.devices.get("pc03")!.interfaces.get("eth0")!.ip,
      "192.168.10.103",
    );
    assert.equal(c.state.players.get(c.sessionId)!.rewards, 0);
  } finally {
    for (const room of rooms) await room.leave();
    await server.gracefullyShutdown(false);
  }
});

test("unsupported terminal text cannot count as a diagnostic step", () => {
  const f = fixture();
  f.act("open");
  f.act("terminal");
  f.command("ping 192.168.10.1; id");
  f.command("ping 8.8.8.8");
  assert.equal(f.player.jobs.get("002")!.stage, 2);
  f.command("ping 192.168.10.1");
  assert.equal(f.player.jobs.get("002")!.stage, 3);
});
