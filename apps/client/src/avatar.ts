import {
  MeshBuilder,
  TransformNode,
  Vector3,
  Mesh,
  type Scene,
} from "./babylon";
import { sign, type Palette } from "./visuals";
import type { PlayerView } from "@netcity/shared";
export function createAvatar(
  scene: Scene,
  id: string,
  player: PlayerView,
  mat: Palette,
) {
  const root = new TransformNode(`player-${id}`, scene);
  root.position.set(player.x, 0, player.z);
  const part = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) => {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    mesh.parent = root;
    mesh.position.set(x, y, z);
    mesh.material = mat(`human-${color}`, color);
    mesh.isPickable = false;
    return mesh;
  };
  part("jacket", 0, 1.15, 0, 0.52, 0.64, 0.28, "#247d86");
  part("head", 0, 1.68, 0, 0.32, 0.34, 0.3, "#d6ae87");
  part("visor", 0, 1.72, 0.16, 0.26, 0.06, 0.025, "#263d50");
  part("hair", 0, 1.87, 0, 0.34, 0.08, 0.32, "#283e54");
  const armL = part("arm-left", -0.35, 1.13, 0, 0.16, 0.6, 0.18, "#247d86");
  const armR = part("arm-right", 0.35, 1.13, 0, 0.16, 0.6, 0.18, "#247d86");
  const legL = part("leg-left", -0.15, 0.42, 0, 0.21, 0.82, 0.23, "#283e54");
  const legR = part("leg-right", 0.15, 0.42, 0, 0.21, 0.82, 0.23, "#283e54");
  const tag = sign(scene, `nickname-${id}`, player.nickname, 2, 0.35, 48);
  tag.mesh.parent = root;
  tag.mesh.position.y = 2.18;
  tag.mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
  tag.mesh.isPickable = false;
  root.metadata = { nickname: player.nickname };
  let phase = 0;
  return {
    root,
    update(next: PlayerView, dt: number, distance: number) {
      const dx = next.x - root.position.x,
        dz = next.z - root.position.z;
      const moving = Math.hypot(dx, dz) > 0.025;
      phase += moving ? dt * 9 : 0;
      const swing = moving ? Math.sin(phase) * 0.45 : 0;
      armL.rotation.x = -swing;
      armR.rotation.x = swing;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      root.position = Vector3.Lerp(
        root.position,
        new Vector3(next.x, 0, next.z),
        Math.min(1, dt / 0.07),
      );
      // Smooth across the -PI/PI wrap instead of rotating the long way round.
      root.rotation.y +=
        Math.atan2(
          Math.sin(next.yaw - root.rotation.y),
          Math.cos(next.yaw - root.rotation.y),
        ) * Math.min(1, dt * 15);
      if (root.isEnabled() !== (distance < 45 && distance > 0.5))
        root.setEnabled(distance < 45 && distance > 0.5);
      tag.mesh.setEnabled(distance < 20 && distance > 0.8);
      tag.mesh.scaling.setAll(Math.min(1, distance / 5));
    },
    dispose() {
      tag.dispose();
      root.dispose();
    },
  };
}
