import {
  Color3,
  DynamicTexture,
  Texture,
  Mesh,
  MeshBuilder,
  Vector4,
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
    { width, height, sideOrientation: Mesh.DOUBLESIDE,backUVs:new Vector4(1,0,0,1) },
    scene,
  );
  const textureWidth=2**Math.ceil(Math.log2(Math.min(2048,Math.max(256,128*width/height))));
  const texture = new DynamicTexture(
    `${name}-text`,
    { width: textureWidth, height: 128 },
    scene,true,Texture.TRILINEAR_SAMPLINGMODE,
  );
  const context=texture.getContext() as CanvasRenderingContext2D;let fitted=Math.min(92,fontSize*2);
  context.font=`bold ${fitted}px sans-serif`;
  const aspectCorrection=(textureWidth/128)/(width/height),measured=context.measureText(text).width*aspectCorrection;
  if(measured>textureWidth-24)fitted=Math.max(1,Math.floor(fitted*(textureWidth-24)/measured));
  context.fillStyle='#142c36';context.fillRect(0,0,textureWidth,128);
  context.font=`bold ${fitted}px sans-serif`;context.textAlign='center';context.textBaseline='middle';context.fillStyle='#e5f9f5';context.save();context.translate(textureWidth/2,64);context.scale(aspectCorrection,1);context.fillText(text,0,0);context.restore();texture.update();
  mesh.metadata={signText:text,signFontSize:fitted,signTextWidth:context.measureText(text).width*aspectCorrection,signTextureWidth:textureWidth};
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
    // Transparent triangles need independent depth ordering; a city-wide merged
    // glass mesh cannot be sorted correctly as the camera moves between rooms.
    if(material.needAlphaBlendingForMesh(mesh)){
      // A depth prepass on frozen PBR glass can render black panes. Independent
      // meshes already provide the required back-to-front transparent ordering.
      material.unfreeze();material.needDepthPrePass=false;material.freeze();
      mesh.isPickable=false;if(!mesh.billboardMode)mesh.freezeWorldMatrix();continue;
    }
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
