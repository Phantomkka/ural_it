import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  DynamicTexture,
  type Scene,
} from "@babylonjs/core";
import { OFFICE_WALLS, SWITCH } from "@netcity/shared";
export function buildOffice(scene: Scene) {
  const mat = (name: string, color: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(color);
    return m;
  };
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
    material: StandardMaterial,
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
  // Open door leaf and lintels preserve a walkable entrance and server-room doorway.
  for (const x of [8, 13]) {
    box("door-lintel", x, 3, 0, 0.35, 0.6, 2.4, dark);
    box("open-door", x + 0.8, 1.3, -1.15, 1.6, 2.6, 0.12, dark);
  }
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
    const mesh = MeshBuilder.CreatePlane(
      name,
      { width: 3, height: 0.7, sideOrientation: 2 },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = -Math.PI / 2;
    const texture = new DynamicTexture(
      `${name}-text`,
      { width: 1024, height: 256 },
      scene,
    );
    texture.drawText(
      text,
      null,
      165,
      "bold 64px sans-serif",
      "white",
      "#172a3d",
      true,
    );
    const material = new StandardMaterial(name, scene);
    material.diffuseTexture = texture;
    material.emissiveColor = Color3.White();
    mesh.material = material;
  };
  label("office-sign", "ОФИС №001 →", 7.8, 3.5, 0);
  label("server-sign", "СЕРВЕРНАЯ", 12.8, 3.4, 0);
  return {
    floor,
    switchMesh,
    sync(connected: boolean) {
      ports[2].material = connected ? green : red;
      cable.setEnabled(!connected);
      repairedCable.setEnabled(connected);
    },
  };
}
