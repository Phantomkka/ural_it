import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = new URL("../../client/public/assets/", import.meta.url);
test("bundled GLBs match provenance hashes, have embedded resources and valid accessor ranges", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", directory), "utf8"),
  );
  assert.ok(manifest.length >= 15);
  let total = 0;
  for (const entry of manifest) {
    assert.equal(entry.license, "CC0-1.0");
    assert.ok(entry.author && entry.source);
    const file = await readFile(new URL("models/" + entry.file, directory));
    total += file.length;
    assert.equal(
      createHash("sha256").update(file).digest("hex"),
      entry.sha256,
      entry.file,
    );
    assert.equal(file.readUInt32LE(0), 0x46546c67);
    assert.equal(file.readUInt32LE(4), 2);
    assert.equal(file.readUInt32LE(8), file.length);
    const size = file.readUInt32LE(12),
      doc = JSON.parse(file.subarray(20, 20 + size).toString());
    assert.equal(doc.buffers.length, 1);
    assert.equal(doc.buffers[0].uri, undefined);
    assert.ok(doc.buffers[0].byteLength <= file.readUInt32LE(20 + size));
    for (const view of doc.bufferViews)
      assert.ok(
        (view.byteOffset ?? 0) + view.byteLength <= doc.buffers[0].byteLength,
        entry.file,
      );
    for (const accessor of doc.accessors) {
      if (accessor.bufferView !== undefined)
        assert.ok(doc.bufferViews[accessor.bufferView]);
    }
    for (const image of doc.images ?? []) {
      assert.equal(image.uri, undefined);
      assert.ok(doc.bufferViews[image.bufferView]);
    }
    if (entry.file.includes("Worker_") || entry.file === "Casual_Male.glb") {
      assert.ok(doc.skins.length > 0);
      assert.deepEqual(
        doc.animations.map((a: { name: string }) => a.name).sort(),
        ["Idle", "Walk"],
      );
      for (const animation of doc.animations)
        for (const sampler of animation.samplers) {
          assert.ok(doc.accessors[sampler.input]);
          assert.ok(doc.accessors[sampler.output]);
        }
    }
  }
  assert.ok(
    total < 4 * 1024 * 1024,
    "keep models within the documented initial budget",
  );
});
test("HDR environment is local, licensed and checksum verified", async () => {
  const entry = JSON.parse(
    await readFile(new URL("environment/metadata.json", directory), "utf8"),
  );
  const file = await readFile(new URL("environment/" + entry.file, directory));
  assert.equal(createHash("sha256").update(file).digest("hex"), entry.sha256);
  assert.equal(entry.license, "CC0-1.0");
  assert.match(file.subarray(0, 32).toString(), /#\?RADIANCE/);
  const license = await readFile(
    new URL("licenses/CC0-1.0.txt", directory),
    "utf8",
  );
  assert.match(license, /CC0 1.0 Universal/);
});

test("prefiltered environment checksum and 128px cubemap header are valid", async () => {
  const entry = JSON.parse(
    await readFile(
      new URL("environment/prefiltered-metadata.json", directory),
      "utf8",
    ),
  );
  const file = await readFile(new URL("environment/" + entry.file, directory));
  assert.equal(createHash("sha256").update(file).digest("hex"), entry.sha256);
  assert.equal(file.subarray(0, 8).toString("hex"), "86168796f6d69636");
  const end = file.indexOf(0, 8),
    header = JSON.parse(file.subarray(8, end).toString());
  assert.equal(header.width, 128);
  assert.ok(header.irradiance);
  assert.ok(header.specular.mipmaps.length >= 6);
  for (const mip of header.specular.mipmaps)
    assert.ok(end + 1 + mip.position + mip.length <= file.length);
});
test("adapted office facade keeps a clear entrance instead of covering the doorway", async () => {
  const file = await readFile(new URL("models/office_facade.glb", directory)),
    size = file.readUInt32LE(12),
    doc = JSON.parse(file.subarray(20, 20 + size).toString()),
    bin = file.subarray(28 + size);
  assert.ok(doc.asset.extras.doorway);
  const a = doc.accessors[0],
    v = doc.bufferViews[a.bufferView];
  // The adaptation writes sequential triangle vertices. No triangle centroid is inside the removed doorway box.
  for (let i = 0; i < a.count; i += 3) {
    const center = [0, 0, 0];
    for (let j = 0; j < 3; j++)
      for (let axis = 0; axis < 3; axis++)
        center[axis] +=
          bin.readFloatLE(v.byteOffset + (i + j) * 12 + axis * 4) / 3;
    const inside =
      center[0] > -7 + 1e-5 &&
      center[0] < -1e-5 &&
      center[1] > -0.1 + 1e-5 &&
      center[1] < 2.7 - 1e-5 &&
      Math.abs(center[2]) < 1.2 - 1e-5;
    assert.equal(
      inside,
      false,
      "facade triangle blocks the authored entrance cut",
    );
  }
});
