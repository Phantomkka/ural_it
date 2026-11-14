import "@babylonjs/loaders/glTF/2.0/glTFLoader.js";
import "@babylonjs/loaders/glTF/glTFFileLoader.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import type {
  AssetContainer,
  InstantiatedEntries,
} from "@babylonjs/core/assetContainer.js";
import { TransformNode, Vector3, type Scene } from "./babylon";
import manifest from "../public/assets/manifest.json";
export const MODEL_COUNT = manifest.length;
export interface GraphicsProgress {
  state: "loading" | "ready" | "degraded";
  loaded: number;
  total: number;
  failed: string[];
}
export class AssetLibrary {
  private containers = new Map<string, AssetContainer>();
  private abort = new AbortController();
  private disposed = false;
  private loaded = 0;
  readonly failed: string[] = [];
  constructor(
    private scene: Scene,
    private report: (value: GraphicsProgress) => void,
  ) {}
  async load() {
    let cursor = 0;
    const worker = async () => {
      while (cursor < manifest.length && !this.disposed) {
        const entry = manifest[cursor++];
        try {
          const request = new AbortController();
          const cancel = () => request.abort();
          this.abort.signal.addEventListener("abort", cancel, { once: true });
          const timeout = setTimeout(cancel, 15000);
          let bytes: Uint8Array;
          try {
            const response = await fetch(`/assets/models/${entry.file}`, {
              signal: request.signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            bytes = new Uint8Array(await response.arrayBuffer());
          } finally {
            clearTimeout(timeout);
            this.abort.signal.removeEventListener("abort", cancel);
          }

          if (this.disposed) break;
          const container = await LoadAssetContainerAsync(bytes, this.scene, {
            pluginExtension: ".glb",
            name: entry.file,
          });
          if (this.disposed) {
            container.dispose();
            break;
          }
          // Rest poses are the asset's authored poses, not a randomly playing action clip.
          container.animationGroups.forEach((group) => group.stop());
          this.containers.set(entry.file, container);
        } catch (error) {
          if (!this.disposed) {
            this.failed.push(entry.file);
            console.warn(`Asset fallback: ${entry.file}`, error);
          }
        }
        if (!this.disposed) {
          this.loaded++;
          this.emit("loading");
        }
      }
    };
    this.emit("loading");
    await Promise.all([worker(), worker(), worker()]);
    if (!this.disposed) this.emit(this.failed.length ? "degraded" : "ready");
  }
  private emit(state: GraphicsProgress["state"]) {
    const value = {
      state,
      loaded: this.loaded,
      total: manifest.length,
      failed: [...this.failed],
    };
    this.scene.metadata = { ...this.scene.metadata, graphics: value };
    this.report(value);
  }
  get complete() {
    return this.loaded === manifest.length;
  }
  has(file: string) {
    return this.containers.has(file);
  }
  instantiate(
    file: string,
    name: string,
    animated = false,
  ): { root: TransformNode; entries: InstantiatedEntries } | undefined {
    const container = this.containers.get(file);
    if (!container || this.disposed) return;
    const entries = container.instantiateModelsToScene(
      (source) => `${name}/${source}`,
      false,
      { doNotInstantiate: animated },
    );
    const root = new TransformNode(name, this.scene);
    for (const node of entries.rootNodes) node.parent = root;
    root.getChildMeshes().forEach((mesh) => {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
    });
    root.metadata = { asset: file };
    return { root, entries };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    for (const container of this.containers.values()) container.dispose();
    this.containers.clear();
  }
}
/** Fit visuals inside the existing footprint. No simulation/collision coordinates change. */
export function fitModel(
  root: TransformNode,
  width: number | undefined,
  height: number,
  depth: number | undefined,
) {
  root.computeWorldMatrix(true);
  root.getChildMeshes().forEach((m) => m.computeWorldMatrix(true));
  const { min, max } = root.getHierarchyBoundingVectors(true);
  const size = max.subtract(min);
  const uniform = height / Math.max(size.y, 0.001);
  const scale = new Vector3(
    width === undefined ? uniform : width / Math.max(size.x, 0.001),
    uniform,
    depth === undefined ? uniform : depth / Math.max(size.z, 0.001),
  );
  // Put a normalized container above the imported model so animation channels never overwrite fit transforms.
  root.scaling.copyFrom(scale);
  root.position.set(
    (-(min.x + max.x) / 2) * scale.x,
    -min.y * scale.y,
    (-(min.z + max.z) / 2) * scale.z,
  );
}
export function appearanceVariant(id: string) {
  return [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 3;
}
export const CHARACTER_FILES = [
  "Worker_Male.glb",
  "Worker_Female.glb",
  "Casual_Male.glb",
];
