import { MeshBuilder, PBRMaterial, Vector3, type Scene } from "./babylon";
import { OFFICE_WALLS, OFFICE_DOORS, SWITCH } from "@netcity/shared";
import { sign, batchStatic, type Palette } from "./visuals";
export function buildOffice(scene: Scene, mat: Palette) {
  const wall = mat("office-wall", "#aebac8"),
    dark = mat("rack-metal", "#172a3d"),
    panel = mat("patch-panel", "#62798a");
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    material: PBRMaterial,
  ) => {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    return mesh;
  };
  const floor = box(
    "building-office",
    14,
    -0.05,
    0,
    12,
    0.1,
    12,
    mat("office-floor", "#536677"),
  );
  OFFICE_WALLS.slice(0, -1).forEach((w, i) =>
    box(`office-wall-${i}`, w.x, 1.8, w.z, w.width, 3.6, w.depth, wall),
  );
  for (const z of [-3.6, 3.6])
    box(
      "office-brick-cladding",
      7.835,
      0.5,
      z,
      0.025,
      1,
      4.8,
      mat("brick", "#bca58f"),
    );
  // Open door leaf and lintels preserve a walkable entrance and server-room doorway.
  for (const x of [8, 13]) {
    box("door-lintel", x, 3, 0, 0.35, 0.6, 2.4, dark);
  }
  let entryDoor:ReturnType<typeof MeshBuilder.CreateBox>|undefined;
  for (const [i,door] of OFFICE_DOORS.entries()) {
    const leaf=box("open-door",door.x,1.3,door.z,door.width,2.6,door.depth,dark);
    if(i===0){entryDoor=leaf;leaf.setPivotPoint(new Vector3(-door.width/2,0,0));leaf.metadata={entryDoor:true};}
  }
  const accents = [];
  accents.push(
    box("office-canopy", 7.6, 3.65, 0, 1.2, 0.15, 4, mat("trim", "#247d86")),
  );
  accents.push(
    box("office-ceiling", 14, 3.7, 0, 12, 0.15, 12, mat("ceiling", "#dbe4df")),
  );
  for (const x of [10.5, 15.5]) {
    accents.push(
      box(
        "ceiling-light",
        x,
        3.58,
        0,
        0.12,
        0.03,
        5,
        mat("office-light", "#d2fff0", true),
      ),
    );
    for (const z of [-5.78, 5.78])
      accents.push(
        box("wall-stripe", x, 1, z, 4.8, 0.16, 0.05, mat("trim", "#247d86")),
      );
  }
  // Floor route makes the server-room entrance readable without additional HUD clutter.
  accents.push(
    box(
      "floor-route",
      11.5,
      0.015,
      0,
      6,
      0.012,
      0.08,
      mat("route", "#59c8bc", true),
    ),
  );
  batchStatic(scene, accents);
  box("rack", 18.5, 1.3, 0, 0.8, 2.6, 1.6, dark);
  const switchMesh = box(
    "switch",
    SWITCH.x,
    SWITCH.y,
    0,
    0.25,
    0.45,
    1.5,
    panel,
  );
  box("patch-panel", 18, 2.2, 0, 0.25, 0.25, 1.5, panel);
  const green = mat("port-online", "#2be29d"),
    red = mat("port-offline", "#eb6658");
  const ports = Array.from({ length: 8 }, (_, i) =>
    box(
      `port-${i + 1}`,
      17.85,
      1.7,
      (i - 3.5) * 0.16,
      0.05,
      0.12,
      0.1,
      i === 2 ? red : green,
    ),
  );
  for (let i = 0; i < 8; i++)
    if (i !== 2)
      MeshBuilder.CreateTube(
        `patch-cable-${i + 1}`,
        {
          path: [
            new Vector3(17.8, 2.2, (i - 3.5) * 0.16),
            new Vector3(17.5, 1.95, (i - 3.5) * 0.16),
            new Vector3(17.8, 1.7, (i - 3.5) * 0.16),
          ],
          radius: 0.025,
          tessellation: 6,
        },
        scene,
      ).material = green;
  const cable = MeshBuilder.CreateTube(
    "loose-patch-cord",
    {
      path: [
        new Vector3(17.8, 2.2, -0.24),
        new Vector3(17.2, 1.5, -0.24),
        new Vector3(17.3, 0.6, -0.24),
      ],
      radius: 0.035,
      tessellation: 6,
    },
    scene,
  );
  cable.material = red;
  const repairedCable = MeshBuilder.CreateTube(
    "patch-cable-3",
    {
      path: [
        new Vector3(17.8, 2.2, -0.24),
        new Vector3(17.5, 1.95, -0.24),
        new Vector3(17.8, 1.7, -0.24),
      ],
      radius: 0.025,
      tessellation: 6,
    },
    scene,
  );
  repairedCable.material = green;
  repairedCable.setEnabled(false);
  const label = (
    name: string,
    text: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const { mesh } = sign(scene, name, text, 3, 0.7);
    mesh.position.set(x, y, z);
    mesh.rotation.y = Math.PI / 2;
    mesh.isPickable = false;
  };
  label("office-sign", "ОФИС №001 →", 7.8, 3.5, 0);
  label("server-sign", "СЕРВЕРНАЯ", 12.8, 3.4, 0);
  label("switch-label", "SW-001 / 8 PORTS", 17.82, 2.55, 0);
  const serviceLED = box(
    "rack-service-led",
    18.02,
    2.35,
    0.64,
    0.03,
    0.1,
    0.1,
    red,
  );
  serviceLED.isPickable = false;
  let previousService: boolean | undefined;
  let previous: boolean | undefined;
  return {
    floor,
    switchMesh,
    sync(connected: boolean, serviced = false, entryOpen=true) {
      if(entryDoor)entryDoor.rotation.y+=((entryOpen?0:-Math.PI/2)-entryDoor.rotation.y)*0.2;
      if (previousService !== serviced) {
        serviceLED.material = serviced ? green : red;
        previousService = serviced;
      }
      if (previous === connected) return;
      previous = connected;
      ports[2].material = connected ? green : red;
      cable.setEnabled(!connected);
      repairedCable.setEnabled(connected);
    },
  };
}
