import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  type Scene,
} from "./babylon";
/** One palette per scene. Frozen shared materials never accumulate across reconnects. */
export function createPalette(scene: Scene) {
  const cache = new Map<string, StandardMaterial>();
  return (name: string, color: string, glow = false) => {
    let material = cache.get(name);
    if (!material) {
      material = new StandardMaterial(name, scene);
      material.diffuseColor = Color3.FromHexString(color);
      material.specularColor = new Color3(0.08, 0.08, 0.08);
      if (glow) material.emissiveColor = material.diffuseColor.scale(0.7);
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
  const groups = new Map<StandardMaterial, Mesh[]>();
  for (const mesh of meshes) {
    const material = mesh.material as StandardMaterial;
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
