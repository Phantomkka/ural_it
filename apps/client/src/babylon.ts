// Import only the Babylon features used by the game (no inspector/loaders/postprocessing).
import "@babylonjs/core/Culling/ray.js";
export { Engine } from "@babylonjs/core/Engines/engine.js";
export { EngineStore } from "@babylonjs/core/Engines/engineStore.js";
export { Scene } from "@babylonjs/core/scene.js";
export { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
export { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
export { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
export { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
export { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
export { Mesh } from "@babylonjs/core/Meshes/mesh.js";
export { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
export { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
export { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder.js";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder.js";
export const MeshBuilder = {
  CreateBox,
  CreateGround,
  CreatePlane,
  CreateCylinder,
  CreateSphere,
  CreateTube,
};
export { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
export { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
export { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture.js";
export { BackgroundMaterial } from "@babylonjs/core/Materials/Background/backgroundMaterial.js";
export { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
export { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture.js";
