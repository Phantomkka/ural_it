import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  type Scene,
} from "./babylon";
/** One palette per scene. Frozen shared materials never accumulate across reconnects. */
export function createPalette(scene: Scene) {
  const cache = new Map<string, PBRMaterial>();
  return (name: string, color: string, glow = false) => {
    let material = cache.get(name);
    if (!material) {
      material = new PBRMaterial(name, scene);
      material.albedoColor = Color3.FromHexString(color).toLinearSpace();
      material.metallic =
        name.includes("metal") ||
        name.includes("rack") ||
        name.includes("patch-panel")
          ? 0.8
          : 0;
      material.roughness = name.includes("glass")
        ? 0.12
        : name.includes("metal")
          ? 0.3
          : 0.82;
      if (glow) material.emissiveColor = material.albedoColor.scale(0.7);
      material.freeze();
      cache.set(name, material);
    }
    return material;
  };
}
export type Palette = ReturnType<typeof createPalette>;
export function sign(
  scene: Scene,
  name: string,
  text: string,
  width: number,
  height: number,
  fontSize = 30,
) {
  const mesh = MeshBuilder.CreatePlane(
    name,
    { width, height, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  const texture = new DynamicTexture(
    `${name}-text`,
    { width: 512, height: 128 },
    scene,
  );
  texture.drawText(
    text,
    null,
    82,
    `bold ${fontSize}px sans-serif`,
    "#e5f9f5",
    "#142c36",
    true,
  );
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.emissiveColor = Color3.White();
  material.disableLighting = true;
  material.freeze();
  mesh.material = material;
  return {
    mesh,
    dispose: () => {
      mesh.dispose();
      material.dispose(false, true);
    },
  };
}
/** Merge static meshes sharing a material. Keep gameplay hit targets and building identifiers separate. */
export function batchStatic(scene: Scene, meshes: Mesh[]) {
  const groups = new Map<StandardMaterial | PBRMaterial, Mesh[]>();
  for (const mesh of meshes) {
    const material = mesh.material as StandardMaterial | PBRMaterial;
    const group = groups.get(material) ?? [];
    group.push(mesh);
    groups.set(material, group);
  }
  for (const [material, group] of groups) {
    const mesh =
      group.length === 1
        ? group[0]
        : Mesh.MergeMeshes(group, true, true, undefined, false, false)!;
    mesh.name = `detail-batch-${material.name}`;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
  }
}
