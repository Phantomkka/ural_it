import { MeshBuilder, Vector3, Color3, type Scene } from "./babylon";
import { COMPUTERS, type DeviceView } from "@netcity/shared";
import { sign, batchStatic, type Palette } from "./visuals";
/** Small authored hardware supplements the existing local GLB office furniture. */
export function buildComputers(scene: Scene, mat: Palette) {
  const trim = [];
  const screens = new Map<string, ReturnType<typeof MeshBuilder.CreateBox>>();
  const black = mat("pc-case", "#162633"),
    metal = mat("pc-metal", "#687c8b");
  const good = mat("pc-screen-online", "#127d84", true),
    bad = mat("pc-screen-offline", "#b04e50", true);
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.material = black;
    mesh.isPickable = false;
    return mesh;
  };
  for (const pc of COMPUTERS) {
    trim.push(box("pc-frame", pc.x, 1.38, pc.z, 0.12, 0.8, 1.15));
    const screen = box(
      `pc-monitor-${pc.id}`,
      pc.x - 0.07,
      1.38,
      pc.z,
      0.02,
      0.68,
      1.02,
    );
    screen.metadata = { pcId: pc.id };
    screen.isPickable = true;
    screen.material = good;
    screens.set(pc.id, screen);
    const stand = box("pc-stand", pc.x, 1, pc.z, 0.08, 0.35, 0.08);
    stand.material = metal;
    trim.push(stand);
    trim.push(box("pc-tower", pc.x + 0.2, 0.4, pc.z + 0.7, 0.5, 0.8, 0.25));
    trim.push(box("pc-keyboard", pc.x - 0.38, 0.83, pc.z, 0.25, 0.035, 0.6));
    // Low-poly desk also works while GLB furniture is loading or unavailable.
    trim.push(box("pc-desk-support", pc.x, 0.79, pc.z, 0.85, 0.05, 1.65));
    const cable = MeshBuilder.CreateTube(
      `pc-cable-${pc.id}`,
      {
        path: [
          new Vector3(pc.x + 0.2, 0.3, pc.z + 0.7),
          new Vector3(pc.x + 0.4, 0.05, pc.z + 0.9),
          new Vector3(pc.x + 0.5, 0.05, pc.z + 1.2),
        ],
        radius: 0.015,
        tessellation: 4,
      },
      scene,
    );
    cable.material = mat("pc-cable-blue", "#418ac0");
    cable.isPickable = false;
    const label = sign(scene, `label-${pc.id}`, pc.name, 0.95, 0.21).mesh;
    label.position.set(pc.x - 0.086, 1.37, pc.z);
    label.rotation.y = -Math.PI / 2;
    label.isPickable = false;
  }
  batchStatic(scene, trim);
  const selection = MeshBuilder.CreateBox(
    "equipment-selection",
    { width: 0.015, height: 0.9, depth: 1.22 },
    scene,
  );
  const glow = mat("pc-selection", "#6fffd0", true);
  glow.wireframe = true;
  glow.emissiveColor = Color3.FromHexString("#6fffd0");
  selection.material = glow;
  selection.isPickable = false;
  selection.setEnabled(false);
  return {
    select(id: string) {
      const pc = COMPUTERS.find((p) => p.id === id);
      selection.setEnabled(!!pc);
      if (pc) selection.position.set(pc.x - 0.09, 1.38, pc.z);
    },
    sync(devices: Map<string, DeviceView> | undefined, uplink: boolean) {
      for (const pc of COMPUTERS) {
        const device = devices?.get(pc.id),
          nic = device?.interfaces.get("eth0");
        screens.get(pc.id)!.material =
          device?.powered &&
          nic?.connected &&
          nic.ip.startsWith("192.168.10.") &&
          nic.gateway === "192.168.10.1" &&
          nic.dns === "192.168.10.1" &&
          uplink
            ? good
            : bad;
        scene
          .getMeshByName(`pc-cable-${pc.id}`)
          ?.setEnabled(nic?.connected ?? true);
      }
    },
  };
}
