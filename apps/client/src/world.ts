import {CARRY_PROPS} from "@netcity/shared";
import {buildLivingCity} from "./livingCity";
import {buildCableObjects,createCableRoll} from "./cableObjects";
import {
  Engine,
  Scene,
  Vector3,
  FreeCamera,
  HemisphericLight,
  Color3,
  Color4,
  DirectionalLight,
  MeshBuilder,
} from "./babylon";
export { EngineStore } from "./babylon";
import {
  AssetLibrary,
  CHARACTER_FILES,
  appearanceVariant,
  type GraphicsProgress,
} from "./assets";
import { buildAssetDistrict } from "./assetDistrict";
import { configureGraphics, type Quality } from "./quality";
import { buildStreet } from "./street";
import { createPalette } from "./visuals";
import { createAvatar } from "./avatar";
import { buildComputers } from "./computers";
import { buildOffice } from "./office";
import type { TouchInput } from "./controls";
import { DEFAULT_SETTINGS, isEditing, type Settings } from "./settings";
import { buildDistrict, CONTACTS } from "./district";
import { playFootstep,playCityAmbience } from "./sound";
import {buildCaseObjects} from "./caseObjects";
import type {ClientCase} from "@netcity/shared";
export interface WorldView { x: number; z: number; yaw: number; moved: boolean; looked: boolean; locked: boolean; fps: number; activeMeshes: number; }
import { INTERACTION_RANGE, EYE_HEIGHT, TICK_RATE } from "@netcity/shared";
import type { Room } from "@colyseus/sdk";
import { sendComputer, sendEquipment, type NetworkState } from "./network";
export function createWorld(
  canvas: HTMLCanvasElement,
  room: Room<NetworkState>,
  touch: TouchInput,
  onTarget: (target: boolean, label?: string) => void,
  onGraphics: (progress: GraphicsProgress) => void = () => {},
  initialQuality: Quality = "medium",
  settings: () => Settings = () => DEFAULT_SETTINGS,
  onView: (view: WorldView) => void = () => {},
  onContact: (id: string) => void = () => {},
) {
  const mobile = matchMedia("(pointer: coarse)").matches;
  const engine = new Engine(canvas, !mobile && initialQuality !== "low", {
    stencil: false,
  });
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
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = 1;
    scene.imageProcessingConfiguration.exposure = 1.15;
    const graphics = configureGraphics(scene, engine, sun, initialQuality);
    const library = new AssetLibrary(scene, (progress) => {
      const loading = { ...progress, state: "loading" as const };
      scene.metadata = { ...scene.metadata, graphics: loading };
      onGraphics(loading);
    });
    const material = createPalette(scene);
    buildStreet(scene, material);
    const office = buildOffice(scene, material);
    const computers = buildComputers(scene, material);
    buildDistrict(scene,material);
    const caseObjects=buildCaseObjects(scene,material);
    const cableObjects=buildCableObjects(scene,material);
    const city=buildLivingCity(scene,material);
    const props=new Map(CARRY_PROPS.map(p=>{const mesh=MeshBuilder.CreateBox("carry-prop-"+p.id,{width:.5,height:p.id==="spare-pc"?.65:.35,depth:.5},scene);mesh.position.set(p.x,.3,p.z);mesh.material=material("prop-"+p.id,p.id==="toolbox"?"#497a93":"#b69570");mesh.metadata={propId:p.id,cityDynamic:true};return [p.id,mesh] as const;}));
    for (const mesh of scene.meshes)
      if (mesh.name !== "equipment-selection" && !mesh.billboardMode && !mesh.metadata?.entryDoor && !mesh.metadata?.cableDynamic && !mesh.metadata?.cityDynamic && mesh.metadata?.caseTarget!=="dropped") mesh.freezeWorldMatrix();
    const pickEquipment = () => {
      const hit = scene.pickWithRay(
        camera.getForwardRay(INTERACTION_RANGE),
        (mesh) => mesh.isPickable && !mesh.name.startsWith("player-"),
      );
      const id = hit?.pickedMesh?.metadata?.pcId;
      const npcId=hit?.pickedMesh?.metadata?.npcId;
      if(hit?.pickedMesh?.metadata?.propId){const id=hit.pickedMesh.metadata.propId;return {id:"prop:"+id,label:"Поднять: "+CARRY_PROPS.find(p=>p.id===id)?.name};}
      if(hit?.pickedMesh?.metadata?.heavy)return {id:"heavy",label:"Транспорт слишком тяжёлый"};
      if(hit?.pickedMesh?.metadata?.cableTarget)return {id:"contact:cable",label:"Бухта кабеля · инструменты"};
      if(hit?.pickedMesh?.metadata?.entryDoor)return {id:"entry-door",label:"Открыть / закрыть дверь"};
      if(hit?.pickedMesh?.metadata?.caseTarget)return {id:"contact:case-"+hit.pickedMesh.metadata.caseTarget,label:hit.pickedMesh.metadata.caseTarget==="dropped"?"Подобрать свою деталь":"Осмотреть CLIENT-PC04"};
      if(npcId) return {id:`contact:${npcId}`,label:`Поговорить: ${CONTACTS.find(n=>n.id===npcId)?.name??"инженер"}`};
      if (id)
        return {
          id,
          label: `Использовать ${id === "pc01" ? "OFFICE-PC01" : id === "pc02" ? "OFFICE-PC02" : "OFFICE-PC03"}`,
        };
      if (
        hit?.pickedMesh === office.switchMesh ||
        hit?.pickedMesh?.name.startsWith("port-")
      )
        return { id: "switch", label: "Осмотреть коммутатор" };
      return null;
    };
    const interact = () => {
      if (!active || touch.modal) return;
      const target = pickEquipment();
      if (!target) return;
      stop();
      if(target.id.startsWith("prop:"))room.send("interaction",{kind:"takeProp",id:target.id.slice(5)});
      else if(target.id==="entry-door")room.send("interaction",{kind:"door"});
      else if(target.id==="heavy")room.send("interaction",{kind:"liftHeavy"});
      else if(target.id.startsWith("contact:")) onContact(target.id.slice(8));
      else if (target.id === "switch") sendEquipment(room, { type: "inspect" });
      else sendComputer(room, { type: "open", pcId: target.id });
    };
    const avatars = new Map<string, ReturnType<typeof createAvatar>>();
    const roll=createCableRoll(scene,material,"held-roll");roll.parent=camera;roll.position.set(0.35,-0.45,0.85);roll.getChildMeshes().forEach(m=>m.isPickable=false);roll.setEnabled(false);
    const carried=MeshBuilder.CreateBox("held-cable",{width:0.25,height:0.12,depth:0.2},scene);carried.material=material("held-cable","#64dec1");carried.parent=camera;carried.position.set(0.3,-0.4,0.8);carried.isPickable=false;carried.setEnabled(false);
    const keys = new Set<string>();
    let yaw = 0,
      pitch = 0,
      active = true;
    let moved = false, looked = false, origin: {x:number;z:number} | undefined;
    let footstep: {x:number;z:number}|undefined;
    const keydown = (e: KeyboardEvent) => {
      if (!touch.modal && !isEditing(e.target) && (document.pointerLockElement === canvas || document.activeElement === canvas)) {
        const bindings = settings().bindings;
        if (e.code === bindings.interact && !e.repeat) interact();
        keys.add(e.code);
        if ([bindings.forward, bindings.back, bindings.left, bindings.right].includes(e.code))
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
      touch.sprint = false;
      if (hadInput && active && room.connection.isOpen)
        room.send("move", { forward: 0, strafe: 0, yaw });
    };
    let hadLock=false;
    const lock = () => {
      const locked=document.pointerLockElement===canvas;
      if (!locked) {
        stop();
        if(hadLock && !touch.modal && document.hasFocus()) window.dispatchEvent(new Event("netcity-unlock"));
      }
      hadLock=locked;
    };
    const mouse = (e: MouseEvent) => {
      if (!touch.modal && document.pointerLockElement === canvas) {
        const s = settings();
        yaw = (yaw + e.movementX * 0.002 * s.sensitivity) % (Math.PI * 2);
        pitch = Math.max(-1.45, Math.min(1.45, pitch + e.movementY * 0.002 * s.sensitivity * (s.invertY ? -1 : 1)));
        looked ||= Math.abs(e.movementX) + Math.abs(e.movementY) > 2;
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
      if (active) {
        const bindings = settings().bindings;
        room.send("move", {
          sprint: !touch.modal && (keys.has(bindings.sprint) || touch.sprint === true),
          forward: touch.modal
            ? 0
            : Math.max(
                -1,
                Math.min(
                  1,
                  Number(keys.has(bindings.forward)) - Number(keys.has(bindings.back)) + touch.y,
                ),
              ),
          strafe: touch.modal
            ? 0
            : Math.max(
                -1,
                Math.min(
                  1,
                  Number(keys.has(bindings.right)) - Number(keys.has(bindings.left)) + touch.x,
                ),
              ),
          yaw,
        });
      }
    }, 1000 / TICK_RATE);
    let disposed = false;
    void Promise.all([library.load(), graphics.environmentReady])
      .then(() => {
        if (disposed) return;
        if (!graphics.environmentLoaded)
          library.failed.push("potsdamer_platz_128.env");
        buildAssetDistrict(scene, library, material);
        graphics.refreshCasters();
        graphics.activate();
        const progress = {
          ...scene.metadata.graphics,
          state: library.failed.length ? "degraded" : "ready",
          failed: [...library.failed],
        } as GraphicsProgress;
        scene.metadata = { ...scene.metadata, graphics: progress };
        onGraphics(progress);
      })
      .catch((error) => {
        if (!disposed) {
          console.warn("Graphics fallback", error);
          const progress = {
            ...scene.metadata.graphics,
            state: "degraded",
            failed: [...library.failed, "scene"],
          } as GraphicsProgress;
          scene.metadata = { ...scene.metadata, graphics: progress };
          onGraphics(progress);
        }
      });
    let lastTarget = "",
      lastPick = 0,lastAmbience=0;
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    engine.runRenderLoop(() => {
      if (touch.modal || document.hidden || !active) stop();
      else {
        const s = settings();
        yaw = (yaw + touch.lookX * 0.004) % (Math.PI * 2);
        pitch = Math.max(-1.45, Math.min(1.45, pitch + touch.lookY * 0.004 * (s.invertY ? -1 : 1)));
        looked ||= Math.abs(touch.lookX) + Math.abs(touch.lookY) > 2;
      }
      touch.lookX = 0;
      touch.lookY = 0;
      camera.rotation.set(pitch, yaw, 0);
      const me = room.state.players?.get(room.sessionId);
      if(me&&!touch.modal&&!document.hidden&&performance.now()-lastAmbience>2500){playCityAmbience(me.x>8&&me.x<20&&Math.abs(me.z)<6,settings().volume);lastAmbience=performance.now();}
      for(const [id,mesh]of props){const p=room.state.props?.get(id),holder=p?.holder&&room.state.players?.get(p.holder);if(p){mesh.position.set(holder?holder.x+Math.sin(holder.yaw)*.7:p.x,holder?1:.3,holder?holder.z+Math.cos(holder.yaw)*.7:p.z);mesh.isPickable=!holder;}}
      carried.setEnabled(me?.heldItem==="patch_cord");roll.setEnabled(me?.heldItem==="cable_roll");
      if (me) {
        origin ??= {x:me.x,z:me.z};
        moved ||= Math.hypot(me.x-origin.x,me.z-origin.z)>1;
        footstep ??= {x:me.x,z:me.z};
        if(Math.hypot(me.x-footstep.x,me.z-footstep.z)>1.4) {
          if(!touch.modal && !document.hidden) playFootstep(settings().volume);
          footstep={x:me.x,z:me.z};
        }
        const blend = Math.hypot(me.x-camera.position.x,me.z-camera.position.z)>3 ? 1 : 1-Math.exp(-25*Math.min(engine.getDeltaTime()/1000,0.1));
        camera.position.x += (me.x-camera.position.x)*blend;
        camera.position.z += (me.z-camera.position.z)*blend;
        camera.position.y = EYE_HEIGHT;
      }
      const present = new Set<string>();
      room.state.players?.forEach((player, id) => {
        if (id === room.sessionId) return;
        present.add(id);
        if (
          !library.has(CHARACTER_FILES[appearanceVariant(id)]) &&
          !library.complete
        )
          return;
        let avatar = avatars.get(id);
        if (avatar && !avatar.loaded && library.has(avatar.asset)) {
          avatar.dispose();
          avatars.delete(id);
          avatar = undefined;
        }
        if (!avatar) {
          avatar = createAvatar(scene, id, player, material, library);
          avatars.set(id, avatar);
          graphics.refreshCasters();
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
          graphics.refreshCasters();
        }
      office.sync(
        room.state.equipment?.port3Connected ?? false,
        room.state.equipment?.rackServiced ?? false,
        room.state.equipment?.officeDoorOpen ?? true,
      );
      computers.sync(
        room.state.devices,
        room.state.equipment?.port3Connected ?? false,
      );
      if (performance.now() - lastPick > 100) {
        if(room.state.players)cableObjects.update(room.state.players);
        city.update(room.state.cars,room.state.trafficPhase??"DRIVE",room.state.worldClock??Date.now(),camera.position,0.1,library);
        const next = active && !touch.modal ? pickEquipment() : null;
        if ((next?.id ?? "") !== lastTarget) {
          onTarget(!!next, next?.label);
          computers.select(next?.id ?? "");
          office.switchMesh.renderOutline = next?.id === "switch";
          office.switchMesh.outlineColor = Color3.FromHexString("#62e3bd");
          office.switchMesh.outlineWidth = 0.03;
          lastTarget = next?.id ?? "";
        }
        lastPick = performance.now();
        onView({x:me?.x??0,z:me?.z??-10,yaw,moved,looked,locked:document.pointerLockElement===canvas,fps:engine.getFps(),activeMeshes:scene.getActiveMeshes().length});
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
      library.dispose();
      graphics.dispose();
      scene.dispose();
      engine.dispose();
    };
    room.onLeave(dispose);
    return { interact, dispose, setQuality: graphics.apply, setClientCase:caseObjects.sync,setCable:cableObjects.setTask };
  } catch (error) {
    engine.dispose();
    throw error;
  }
}
