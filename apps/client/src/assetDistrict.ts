import { COMPUTERS } from "@netcity/shared";
import { TransformNode, MeshBuilder, type Scene } from "./babylon";
import { BUILDINGS, OFFICE, STREET_DETAILS } from "@netcity/shared";
import { AssetLibrary, fitModel } from "./assets";
import { sign, type Palette, batchStatic } from "./visuals";
export function buildAssetDistrict(
  scene: Scene,
  library: AssetLibrary,
  mat: Palette,
) {
  let placements = 0;
  const place = (
    file: string,
    name: string,
    x: number,
    z: number,
    height: number,
    width?: number,
    depth?: number,
    yaw = 0,
    elevation = 0,
  ) => {
    const model = library.instantiate(file, name);
    if (!model) return;
    const pivot = new TransformNode(`${name}-placement`, scene);
    model.root.parent = pivot;
    const orientation = new TransformNode(`${name}-orientation`, scene);
    orientation.parent = model.root;
    orientation.rotation.y = yaw;
    for (const node of model.entries.rootNodes) node.parent = orientation;
    fitModel(model.root, width, height, depth);
    pivot.position.set(x, elevation, z);
    pivot.getChildMeshes().forEach((m) => {
      m.computeWorldMatrix(true);
      m.freezeWorldMatrix();
    });
    placements++;
    return pivot;
  };
  const buildings = [
    "building_A_withoutBase.glb",
    "building_C_withoutBase.glb",
    "building_E_withoutBase.glb",
    "building_H_withoutBase.glb",
  ];
  BUILDINGS.forEach((b, i) => {
    if (b === OFFICE) return;
    const pivot = place(
      buildings[i % 4],
      `architecture-${i}`,
      b.x,
      b.z,
      b.height,
      b.width,
      b.depth,
      (Math.sign(b.x) * Math.PI) / 2,
    );
    if (!pivot) return;
    scene.getMeshByName(`building-${i}`)?.setEnabled(false);
    const label = sign(
      scene,
      `shop-sign-${i}`,
      [
        "NETCITY / WORKSPACE",
        "COFFEE & CODE",
        "DATA / OFFICE",
        "CITY SERVICES",
      ][i % 4],
      3.2,
      0.55,
    );
    label.mesh.position.set(b.x - Math.sign(b.x) * 6.08, 2.7, b.z);
    label.mesh.rotation.y = (Math.sign(b.x) * Math.PI) / 2;
    label.mesh.isPickable = false;
    label.mesh.freezeWorldMatrix();
    const glass = mat("architectural-glass", "#a5c9d3");
    glass.unfreeze();
    glass.metallic = 0.15;
    glass.roughness = 0.08;
    glass.alpha = 0.55;
    glass.freeze();
    const pane = MeshBuilder.CreateBox(
      `storefront-glass-${i}`,
      { width: 0.025, height: 1.8, depth: 2.4 },
      scene,
    );
    pane.position.set(b.x - Math.sign(b.x) * 6.04, 1.25, b.z);
    pane.material = glass;
    pane.isPickable = false;
    pane.freezeWorldMatrix();
  });
  const office = place(
    "office_facade.glb",
    "office-exterior",
    OFFICE.x,
    OFFICE.z,
    7.4,
    12,
    12,
  );
  if (office) {
    for (let i = 0; i < 5; i++)
      scene.getMeshByName(`office-wall-${i}`)?.setEnabled(false);
    office.getChildMeshes().forEach((mesh) => {
      if (mesh.material) mesh.material.backFaceCulling = false;
    });
  }
  // Fallback details are only removed when replacements for that family loaded successfully.
  const hide = (names: string[]) =>
    names.forEach((name) =>
      scene.getMeshByName(`detail-batch-${name}`)?.setEnabled(false),
    );
  if (buildings.every((file) => library.has(file)))
    hide(["cornice", "window-glass", "foundation", "front-door"]);
  if (library.has("streetlight.glb")) {
    hide(["street-metal", "lamp"]);
    for (const p of STREET_DETAILS)
      place(
        "streetlight.glb",
        `street-lamp-${placements}`,
        p.x,
        p.z,
        4.8,
        undefined,
        undefined,
        (Math.sign(p.x) * Math.PI) / 2,
      );
  }
  if (library.has("grass-trees-tall.glb")) {
    hide(["leaves", "wood"]);
    for (const side of [-1, 1])
      for (const z of [-22, 22])
        place(
          z > 0 ? "grass-trees.glb" : "grass-trees-tall.glb",
          `trees-${placements}`,
          side * 7,
          z,
          4,
          3.5,
          2.5,
        );
  }
  for (const side of [-1, 1]) {
    for (const z of [-24, 24])
      place(
        "bench.glb",
        `bench-${placements}`,
        side * 6.6,
        z,
        0.85,
        1.8,
        0.6,
        (side * Math.PI) / 2,
      );
    for (const z of [-18, 18])
      place("trash_B.glb", `bin-${placements}`, side * 6.6, z, 0.9);
    for (const z of [-35, 35])
      place(
        side === 1 ? "car_sedan.glb" : "car_hatchback.glb",
        `car-${placements}`,
        side * 3.6,
        z,
        1.5,
        1.8,
        4,
        side === 1 ? Math.PI : 0,
      );
    place(
      "trafficlight_A.glb",
      `traffic-signal-${placements}`,
      side * 5.5,
      side * 3,
      3,
    );
  }
  for (const { x, z } of COMPUTERS) {
    place("table_medium.glb", `desk-${placements}`, x, z, 0.8, 2, 0.9);
    place(
      "book_set.glb",
      `books-${placements}`,
      x,
      z + 0.3,
      0.16,
      0.3,
      0.25,
      0,
      0.82,
    );
    place(
      "chair_B.glb",
      `chair-${placements}`,
      x - 0.9,
      z,
      1.1,
      0.65,
      0.65,
      Math.PI / 2,
    );
  }
  place("cabinet_medium.glb", "office-storage", 19, 4.5, 1.6, 0.8, 1.8);
  const trim: ReturnType<typeof MeshBuilder.CreateBox>[] = [];
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: ReturnType<Palette>,
  ) => {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.isPickable = false;
    trim.push(mesh);
    return mesh;
  };
  const metal = mat("rack-metal", "#24333d"),
    black = mat("screen-frame", "#15232d");
  // Authored server hardware: keep all gameplay hit targets and shared footprints intact.
  scene.getMeshByName("rack")?.setEnabled(false);
  for (const x of [18.15, 18.85])
    for (const z of [-0.77, 0.77])
      box("rack-post", x, 1.3, z, 0.055, 2.6, 0.055, metal);
  for (const y of [0.1, 0.65, 1.1, 1.45, 2.05, 2.6])
    box("rack-shelf", 18.5, y, 0, 0.8, 0.04, 1.6, metal);
  for (const y of [0.4, 0.85, 1.25]) {
    box("server-unit", 18.4, y, 0, 0.6, 0.25, 1.45, black);
    for (let z = -0.6; z < 0.65; z += 0.15) {
      box("server-vent", 18.08, y, z, 0.018, 0.12, 0.035, metal);
    }
    box(
      "server-status",
      18.065,
      y,
      0.64,
      0.01,
      0.05,
      0.035,
      mat("server-led", "#2be29d", true),
    );
  }
  const glass = mat("shelter-glass", "#b0d9dc");
  glass.unfreeze();
  glass.metallic = 0;
  glass.roughness = 0.1;
  glass.alpha = 0.3;
  glass.freeze();
  // Bespoke shelter and fences, not mislabelled as downloaded third-party models.
  for (const side of [-1, 1]) {
    const x = side * 6.8,
      z = 43;
    for (const dz of [-1.5, 1.5])
      box("bus-stop-post", x, 1.4, z + dz, 0.08, 2.8, 0.08, metal);
    box("bus-stop-roof", x, 2.8, z, 1.8, 0.12, 3.3, metal);
    box("bus-stop-glass", x + side * 0.65, 1.4, z, 0.03, 2.6, 3, glass);
    place(
      "bench.glb",
      `stop-bench-${placements}`,
      x,
      z,
      0.85,
      1.4,
      0.6,
      Math.PI / 2,
    );
    const label = sign(
      scene,
      `bus-stop-sign-${side}`,
      "BUS / NETCITY",
      2,
      0.45,
    );
    label.mesh.position.set(x, 2.5, z - 1.6);
    label.mesh.isPickable = false;
    for (let dz = -40; dz <= 40; dz += 4)
      box("fence-post", side * 23, 0.8, dz, 0.08, 1.6, 0.08, metal);
    for (const y of [0.5, 1.25])
      box("fence-rail", side * 23, y, 0, 0.05, 0.06, 80, metal);
  }
  batchStatic(scene, trim);
  scene.metadata = { ...scene.metadata, assetPlacements: placements };
}
