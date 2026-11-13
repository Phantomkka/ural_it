import { test } from "node:test";
import assert from "node:assert/strict";
import { handleEquipment } from "./equipment.js";
import { canReachSwitch, advance } from "@netcity/shared";
const player = () => ({ x: 16, z: 0, yaw: 0, ticketStep: 3, rewards: 0 });
test("distance boundary, invalid actions and inspection are enforced on the server", () => {
  const p = player(),
    equipment = { port3Connected: false };
  assert.equal(canReachSwitch({ ...p, x: 15.5 }), true);
  assert.equal(canReachSwitch({ ...p, x: 15.49 }), false);
  assert.equal(canReachSwitch({ ...p, x: 20.3 }), false); // behind the outside wall, still within 2.5m
  assert.equal(
    handleEquipment({ ...p, x: 0 }, equipment, {
      type: "connect",
      port: 3,
      x: 18,
      z: 0,
    }).ok,
    false,
  );
  assert.equal(
    handleEquipment(p, equipment, { type: "connect", port: 3 }).ok,
    false,
  );
  assert.equal(handleEquipment(p, equipment, { type: "inspect" }).ok, true);
  for (const port of [1, 2, 4, 5, 6, 7, 8, "3", null, NaN])
    assert.equal(
      handleEquipment(p, equipment, { type: "connect", port }).ok,
      false,
    );
  assert.equal(equipment.port3Connected, false);
  assert.equal(p.rewards, 0);
  assert.equal(p.ticketStep, 5);
});
test("only port 3 completes a ticket and duplicate or concurrent actions cannot award twice", () => {
  const p = player(),
    equipment = { port3Connected: false };
  handleEquipment(p, equipment, { type: "inspect" });
  for (let i = 0; i < 100; i++)
    handleEquipment(p, equipment, { type: "connect", port: 3 });
  assert.equal(equipment.port3Connected, true);
  assert.equal(p.rewards, 1);
  assert.equal(p.ticketStep, 6);
  handleEquipment(p, equipment, { type: "inspect" });
  handleEquipment(p, equipment, { type: "connect", port: 3 });
  assert.equal(p.rewards, 1);
});
test("office walls block movement but both doorways remain walkable", () => {
  const right = { forward: 0, strafe: 1, yaw: 0 };
  assert.equal(advance({ x: 7.4, z: 3 }, right, 1).x, 7.4);
  assert.ok(advance({ x: 7.4, z: 0 }, right, 1).x > 7.4);
  assert.equal(advance({ x: 12.4, z: 3 }, right, 1).x, 12.4);
  assert.ok(advance({ x: 12.4, z: 0 }, right, 1).x > 12.4);
});

test("open door leaves have server collision but the center passage stays open", () => {
  assert.equal(
    advance({ x: 8.8, z: -0.6 }, { forward: -1, strafe: 0, yaw: 0 }, 1).z,
    -0.6,
  );
  assert.ok(
    advance({ x: 8.8, z: 0 }, { forward: 0, strafe: 1, yaw: 0 }, 1).x > 8.8,
  );
  assert.equal(
    advance({ x: 13.8, z: -0.6 }, { forward: -1, strafe: 0, yaw: 0 }, 1).z,
    -0.6,
  );
});

test("both office doors can be traversed in both directions without clipping walls", () => {
  let p = { x: 6, z: 0 };
  for (let i = 0; i < 70; i++)
    p = advance(p, { forward: 0, strafe: 1, yaw: 0 }, 1 / 30);
  assert.ok(p.x > 15.5 && p.x < 18);
  for (let i = 0; i < 70; i++)
    p = advance(p, { forward: 0, strafe: -1, yaw: 0 }, 1 / 30);
  assert.ok(Math.abs(p.x - 6) < 1e-8);
  assert.equal(p.z, 0);
});

test("door-safe browser navigation interval clears both doors with player radius", () => {
  for (const z of [-0.6, 0.7]) {
    let p = { x: 6, z };
    for (let i = 0; i < 70; i++)
      p = advance(p, { forward: 0, strafe: 1, yaw: 0 }, 1 / 30);
    assert.ok(p.x > 15.5, `door blocked at z=${z}`);
  }
});
