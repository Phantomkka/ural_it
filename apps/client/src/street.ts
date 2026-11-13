import { MeshBuilder, type Mesh, type Scene } from "./babylon";
import { BUILDINGS, OFFICE, STREET_DETAILS } from "@netcity/shared";
import { batchStatic, sign, type Palette } from "./visuals";
export function buildStreet(scene: Scene, mat: Palette) {
  const details: Mesh[] = [];
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    palette = name,
  ) => {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = mat(palette, color);
    details.push(mesh);
    return mesh;
  };
  const grass = MeshBuilder.CreateGround(
    "ground",
    { width: 110, height: 110 },
    scene,
  );
  grass.material = mat("grass", "#6f9278");
  grass.isPickable = false;
  grass.freezeWorldMatrix();
  box("road", 0, -0.035, 0, 10, 0.08, 100, "#344452");
  for (const side of [-1, 1]) {
    box("pavement", side * 6, 0.015, 0, 2, 0.08, 100, "#abbab9");
    box("curb", side * 5.05, 0.06, 0, 0.12, 0.12, 100, "#dde1cf");
    box(
      "edge-line",
      side * 4.6,
      0.012,
      0,
      0.08,
      0.015,
      94,
      "#eee6c4",
      "road-paint",
    );
    for (let z = -45; z < 46; z += 2)
      box("paving-joint", side * 6, 0.058, z, 1.9, 0.005, 0.025, "#829597");
  }
  for (let z = -44; z < 45; z += 6)
    box("lane", 0, 0.012, z, 0.12, 0.015, 3, "#eee6c4", "road-paint");
  for (let x = -4.4; x < 4.5; x += 0.85)
    box("crosswalk", x, 0.015, 0, 0.5, 0.015, 2.2, "#eee6c4", "road-paint");
  BUILDINGS.forEach((b, i) => {
    if (b === OFFICE) return;
    const mesh = box(
      `building-${i}`,
      b.x,
      b.height / 2,
      b.z,
      b.width,
      b.height,
      b.depth,
      ["#c3b09a", "#a6b8b7", "#a6b0c5"][i % 3],
      `facade-${i % 3}`,
    );
    details.pop();
    mesh.freezeWorldMatrix();
    box("foundation", b.x, 0.3, b.z, 12.2, 0.6, 12.2, "#73858d");
    box("cornice", b.x, b.height - 0.15, b.z, 12.3, 0.35, 12.3, "#e1dac5");
    for (let y = 2; y < b.height; y += 3)
      for (let z = -3; z <= 3; z += 3) {
        box(
          "window-frame",
          b.x - Math.sign(b.x) * 6.03,
          y,
          b.z + z,
          0.08,
          1.65,
          1.75,
          "#e1dac5",
          "cornice",
        );
        box(
          "window-glass",
          b.x - Math.sign(b.x) * 6.09,
          y,
          b.z + z,
          0.04,
          1.35,
          1.45,
          "#476b7d",
        );
      }
    box(
      "front-door",
      b.x - Math.sign(b.x) * 6.08,
      1.1,
      b.z,
      0.06,
      2.2,
      1.2,
      "#314f60",
    );
  });
  for (const p of STREET_DETAILS) {
    const pole = MeshBuilder.CreateCylinder(
      "lamp-post",
      { height: 4.8, diameter: 0.12, tessellation: 6 },
      scene,
    );
    pole.position.set(p.x, 2.4, p.z);
    pole.material = mat("street-metal", "#324e5c");
    details.push(pole);
    box(
      "lamp-arm",
      p.x - Math.sign(p.x) * 0.45,
      4.7,
      p.z,
      1,
      0.1,
      0.12,
      "#324e5c",
      "street-metal",
    );
    const lamp = box(
      "lamp",
      p.x - Math.sign(p.x) * 0.9,
      4.65,
      p.z,
      0.5,
      0.08,
      0.4,
      "#ffe6ae",
    );
    lamp.material = mat("lamp", "#ffe6ae", true);
  }
  for (const side of [-1, 1])
    for (const z of [-22, 22]) {
      const x = side * 7;
      box("planter", x, 0.25, z, 1.5, 0.5, 2, "#73858d", "foundation");
      const trunk = MeshBuilder.CreateCylinder(
        "tree-trunk",
        { height: 2.6, diameter: 0.25, tessellation: 5 },
        scene,
      );
      trunk.position.set(x, 1.5, z);
      trunk.material = mat("wood", "#82674f");
      details.push(trunk);
      const crown = MeshBuilder.CreateSphere(
        "tree-crown",
        { diameter: 3.2, segments: 3 },
        scene,
      );
      crown.position.set(x, 3.6, z);
      crown.scaling.y = 1.2;
      crown.material = mat("leaves", "#426d57");
      details.push(crown);
      // Bench tucked beside the planter, outside the main walking route.
      box(
        "bench-seat",
        side * 9,
        0.5,
        z + 2.5,
        1.4,
        0.12,
        0.5,
        "#82674f",
        "wood",
      );
    }
  for (const z of [-9, 9]) {
    const cover = MeshBuilder.CreateCylinder(
      "manhole",
      { height: 0.015, diameter: 0.8, tessellation: 12 },
      scene,
    );
    cover.position.set(-2, 0.014, z);
    cover.material = mat("street-metal", "#324e5c");
    details.push(cover);
  }
  const district = sign(
    scene,
    "district-sign",
    "NETCITY / IT DISTRICT",
    4,
    0.7,
  );
  district.mesh.position.set(-7.8, 3.6, 0);
  district.mesh.rotation.y = -Math.PI / 2;
  district.mesh.isPickable = false;
  district.mesh.freezeWorldMatrix();
  batchStatic(scene, details);
}
