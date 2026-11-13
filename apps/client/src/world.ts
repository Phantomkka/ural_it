import {
  Engine,
  Scene,
  Vector3,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  type Mesh,
} from "@babylonjs/core";
import { buildOffice } from "./office";
import type { TouchInput } from "./controls";
import {
  OFFICE,
  INTERACTION_RANGE,
  BUILDINGS,
  EYE_HEIGHT,
  TICK_RATE,
} from "@netcity/shared";
import type { Room } from "@colyseus/sdk";
import { sendEquipment, type NetworkState } from "./network";
export function createWorld(
  canvas: HTMLCanvasElement,
  room: Room<NetworkState>,
  touch: TouchInput,
  onTarget: (target: boolean) => void,
) {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.54, 0.72, 0.85, 1);
  const camera = new FreeCamera("eyes", new Vector3(0, EYE_HEIGHT, -10), scene);
  camera.minZ = 0.1;
  camera.fov = 1.2;
  new HemisphericLight("sun", new Vector3(0.4, 1, 0.2), scene);
  const material = (name: string, color: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(color);
    return m;
  };
  const grass = material("grass", "#64866b"),
    asphalt = material("asphalt", "#303b4a");
  const sidewalk = material("sidewalk", "#b0bac3"),
    stripe = material("stripe", "#f1d28b");
  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 100, height: 100 },
    scene,
  );
  ground.material = grass;
  const road = MeshBuilder.CreateGround(
    "road",
    { width: 10, height: 94 },
    scene,
  );
  road.position.y = 0.01;
  road.material = asphalt;
  for (const x of [-6, 6]) {
    const walk = MeshBuilder.CreateBox(
      "sidewalk",
      { width: 2, height: 0.15, depth: 94 },
      scene,
    );
    walk.position.set(x, 0, 0);
    walk.material = sidewalk;
  }
  for (let z = -44; z < 45; z += 6) {
    const line = MeshBuilder.CreateGround(
      "lane",
      { width: 0.15, height: 3 },
      scene,
    );
    line.position.set(0, 0.02, z);
    line.material = stripe;
  }
  BUILDINGS.forEach((b, i) => {
    if (b === OFFICE) return;
    const box = MeshBuilder.CreateBox(
      `building-${i}`,
      { width: b.width, height: b.height, depth: b.depth },
      scene,
    );
    box.position.set(b.x, b.height / 2, b.z);
    box.material = material(
      `facade-${i}`,
      ["#7892aa", "#d4b18e", "#8d9d93"][i % 3],
    );
    for (let y = 2; y < b.height; y += 3)
      for (let z = -3; z <= 3; z += 3) {
        const window = MeshBuilder.CreateBox(
          "window",
          { width: 0.04, height: 1.4, depth: 1.5 },
          scene,
        );
        window.position.set(
          b.x - Math.sign(b.x) * (b.width / 2 + 0.03),
          y,
          b.z + z,
        );
        window.material = stripe;
      }
  });
  const office = buildOffice(scene);
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
  const avatarMaterial = material("citizens", "#33d6d0");
  const avatars = new Map<string, Mesh>();
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
    keys.clear();
    touch.x = 0;
    touch.y = 0;
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
      void canvas.requestPointerLock();
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
  room.onLeave(() => {
    active = false;
    stop();
  });
  engine.runRenderLoop(() => {
    if (touch.modal) stop();
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
      let mesh = avatars.get(id);
      if (!mesh) {
        mesh = MeshBuilder.CreateCapsule(
          `player-${id}`,
          { height: 1.8, radius: 0.35 },
          scene,
        );
        mesh.material = avatarMaterial;
        avatars.set(id, mesh);
      }
      mesh.position = Vector3.Lerp(
        mesh.position,
        new Vector3(player.x, 0.9, player.z),
        Math.min(1, engine.getDeltaTime() / 70),
      );
      mesh.rotation.y = player.yaw;
    });
    for (const [id, mesh] of avatars)
      if (!present.has(id)) {
        mesh.dispose();
        avatars.delete(id);
      }
    office.sync(room.state.equipment?.port3Connected ?? false);
    onTarget(!touch.modal && targetSwitch());
    scene.render();
  });
  const resize = () => engine.resize();
  window.addEventListener("resize", resize);
  return {
    interact,
    dispose: () => {
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
      scene.dispose();
      engine.dispose();
    },
  };
}
