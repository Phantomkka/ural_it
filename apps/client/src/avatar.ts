import { TransformNode, Vector3, Mesh, type Scene } from "./babylon";
import {
  AssetLibrary,
  CHARACTER_FILES,
  appearanceVariant,
  fitModel,
} from "./assets";
import { sign, type Palette } from "./visuals";
import { createFallbackAvatar } from "./fallbackAvatar";
import type { PlayerView } from "@netcity/shared";
export function createAvatar(
  scene: Scene,
  id: string,
  player: PlayerView,
  mat: Palette,
  library: AssetLibrary,
) {
  const file = CHARACTER_FILES[appearanceVariant(id)];
  const model = library.instantiate(file, `skin-${id}`, true);
  if (!model) {
    const fallback = createFallbackAvatar(scene, id, player, mat);
    fallback.root.metadata = { ...fallback.root.metadata, fallback: true };
    return { ...fallback, asset: file, loaded: false };
  }
  const root = new TransformNode(`player-${id}`, scene);
  model.root.parent = root;
  fitModel(model.root, undefined, 1.8, undefined);
  root.position.set(player.x, 0, player.z);
  const idle = model.entries.animationGroups.find((group) =>
    group.name.endsWith("/Idle"),
  );
  const walk = model.entries.animationGroups.find((group) =>
    group.name.endsWith("/Walk"),
  );
  for (const group of [idle, walk]) {
    group?.start(true, 1);
    group?.setWeightForAllAnimatables(group === idle ? 1 : 0);
  }
  const tag = sign(scene, `nickname-${id}`, player.nickname, 2, 0.35, 48);
  tag.mesh.parent = root;
  tag.mesh.position.y = 2.18;
  tag.mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
  tag.mesh.isPickable = false;
  root.metadata = {
    nickname: player.nickname,
    asset: file,
    animation: "Idle",
    walkWeight: 0,
  };
  let blend = 0;
  return {
    root,
    asset: file,
    loaded: true,
    update(next: PlayerView, dt: number, distance: number) {
      const moving =
        Math.hypot(next.x - root.position.x, next.z - root.position.z) > 0.025;
      blend += (Number(moving) - blend) * Math.min(1, dt * 8);
      walk?.setWeightForAllAnimatables(blend);
      idle?.setWeightForAllAnimatables(1 - blend);
      root.metadata.walkWeight = blend;
      root.metadata.animation = moving ? "Walk" : "Idle";
      root.position = Vector3.Lerp(
        root.position,
        new Vector3(next.x, 0, next.z),
        Math.min(1, dt / 0.07),
      );
      root.rotation.y +=
        Math.atan2(
          Math.sin(next.yaw - root.rotation.y),
          Math.cos(next.yaw - root.rotation.y),
        ) * Math.min(1, dt * 15);
      root.setEnabled(distance < 45 && distance > 0.5);
      tag.mesh.setEnabled(distance < 20 && distance > 0.8);
      tag.mesh.scaling.setAll(Math.min(1, distance / 5));
    },
    dispose() {
      tag.dispose();
      model.entries.dispose();
      root.dispose();
    },
  };
}
