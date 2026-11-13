import {
  Engine,
  Scene,
  Vector3,
  FreeCamera,
  HemisphericLight,
  Color3,
  Color4,
  DirectionalLight,
} from "./babylon";
export { EngineStore } from "./babylon";
import { buildStreet } from "./street";
import { createPalette } from "./visuals";
import { createAvatar } from "./avatar";
import { buildOffice } from "./office";
import type { TouchInput } from "./controls";
import { INTERACTION_RANGE, EYE_HEIGHT, TICK_RATE } from "@netcity/shared";
import type { Room } from "@colyseus/sdk";
import { sendEquipment, type NetworkState } from "./network";
export function createWorld(
  canvas: HTMLCanvasElement,
  room: Room<NetworkState>,
  touch: TouchInput,
  onTarget: (target: boolean) => void,
) {
  const mobile = matchMedia("(pointer: coarse)").matches;
  const engine = new Engine(canvas, !mobile, { stencil: false });
  try {
    engine.setHardwareScalingLevel(mobile ? 1.25 : 1);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.72, 0.83, 0.87, 1);
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = 35;
    scene.fogEnd = 85;
    scene.fogColor = new Color3(0.72, 0.83, 0.87);
    scene.skipPointerMovePicking = true;
    const camera = new FreeCamera(
      "eyes",
      new Vector3(0, EYE_HEIGHT, -10),
      scene,
    );
    camera.minZ = 0.1;
    camera.fov = 1.2;
    const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
    sky.intensity = 0.85;
    sky.groundColor = new Color3(0.34, 0.42, 0.46);
    const sun = new DirectionalLight("sun", new Vector3(-0.6, -1, 0.4), scene);
    sun.intensity = 0.75;
    sun.diffuse = new Color3(1, 0.91, 0.77);
    const material = createPalette(scene);
    buildStreet(scene, material);
    const office = buildOffice(scene, material);
    for (const mesh of scene.meshes) mesh.freezeWorldMatrix();
    const targetSwitch = () => {
      const hit = scene.pickWithRay(
        camera.getForwardRay(INTERACTION_RANGE),
        (mesh) => mesh.isPickable && !mesh.name.startsWith("player-"),
      );
      return (
        hit?.pickedMesh === office.switchMesh ||
        !!hit?.pickedMesh?.name.startsWith("port-")
      );
    };
    const interact = () => {
      if (!active || touch.modal || !targetSwitch()) return;
      stop();
      sendEquipment(room, { type: "inspect" });
    };
    const avatars = new Map<string, ReturnType<typeof createAvatar>>();
    const keys = new Set<string>();
    let yaw = 0,
      pitch = 0,
      active = true;
    const keydown = (e: KeyboardEvent) => {
      if (!touch.modal && document.pointerLockElement === canvas) {
        if (e.code === "KeyE" && !e.repeat) interact();
        keys.add(e.code);
        if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code))
          e.preventDefault();
      }
    };
    const keyup = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };
    const stop = () => {
      const hadInput = keys.size > 0 || touch.x !== 0 || touch.y !== 0;
      keys.clear();
      touch.x = 0;
      touch.y = 0;
      touch.lookX = 0;
      touch.lookY = 0;
      if (hadInput && active && room.connection.isOpen)
        room.send("move", { forward: 0, strafe: 0, yaw });
    };
    const lock = () => {
      if (document.pointerLockElement !== canvas) stop();
    };
    const mouse = (e: MouseEvent) => {
      if (!touch.modal && document.pointerLockElement === canvas) {
        yaw = (yaw + e.movementX * 0.002) % (Math.PI * 2);
        pitch = Math.max(-1.45, Math.min(1.45, pitch + e.movementY * 0.002));
      }
    };
    const click = () => {
      if (!touch.modal && !matchMedia("(pointer: coarse)").matches)
        void canvas.requestPointerLock()?.catch(() => {
          /* Some browsers deny pointer lock until the next gesture. */
        });
    };
    canvas.addEventListener("click", click);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", stop);
    document.addEventListener("pointerlockchange", lock);
    document.addEventListener("mousemove", mouse);
    const timer = window.setInterval(() => {
      if (active)
        room.send("move", {
          forward: touch.modal
            ? 0
            : Math.max(
                -1,
                Math.min(
                  1,
                  Number(keys.has("KeyW")) - Number(keys.has("KeyS")) + touch.y,
                ),
              ),
          strafe: touch.modal
            ? 0
            : Math.max(
                -1,
                Math.min(
                  1,
                  Number(keys.has("KeyD")) - Number(keys.has("KeyA")) + touch.x,
                ),
              ),
          yaw,
        });
    }, 1000 / TICK_RATE);
    let disposed = false;
    let lastTarget = false,
      lastPick = 0;
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    engine.runRenderLoop(() => {
      if (touch.modal || document.hidden || !active) stop();
      else {
        yaw = (yaw + touch.lookX * 0.004) % (Math.PI * 2);
        pitch = Math.max(-1.45, Math.min(1.45, pitch + touch.lookY * 0.004));
      }
      touch.lookX = 0;
      touch.lookY = 0;
      camera.rotation.set(pitch, yaw, 0);
      const me = room.state.players?.get(room.sessionId);
      if (me) camera.position.set(me.x, EYE_HEIGHT, me.z);
      const present = new Set<string>();
      room.state.players?.forEach((player, id) => {
        if (id === room.sessionId) return;
        present.add(id);
        let avatar = avatars.get(id);
        if (!avatar) {
          avatar = createAvatar(scene, id, player, material);
          avatars.set(id, avatar);
        }
        avatar.update(
          player,
          Math.min(engine.getDeltaTime() / 1000, 0.1),
          Math.hypot(
            player.x - camera.position.x,
            player.z - camera.position.z,
          ),
        );
      });
      for (const [id, avatar] of avatars)
        if (!present.has(id)) {
          avatar.dispose();
          avatars.delete(id);
        }
      office.sync(room.state.equipment?.port3Connected ?? false);
      if (performance.now() - lastPick > 100) {
        const next = active && !touch.modal && targetSwitch();
        if (next !== lastTarget) {
          onTarget(next);
          lastTarget = next;
        }
        lastPick = performance.now();
      }
      scene.render();
    });
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      active = false;
      clearInterval(timer);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", click);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", stop);
      document.removeEventListener("pointerlockchange", lock);
      document.removeEventListener("mousemove", mouse);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      for (const avatar of avatars.values()) avatar.dispose();
      avatars.clear();
      onTarget(false);
      scene.dispose();
      engine.dispose();
    };
    room.onLeave(dispose);
    return { interact, dispose };
  } catch (error) {
    engine.dispose();
    throw error;
  }
}
