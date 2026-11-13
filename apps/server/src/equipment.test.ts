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
