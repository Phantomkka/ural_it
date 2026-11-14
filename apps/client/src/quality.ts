import {
  ShadowGenerator,
  CubeTexture,
  type DirectionalLight,
  type Engine,
  type Scene,
} from "./babylon";
export type Quality = "low" | "medium" | "high";
export function defaultQuality(): Quality {
  try {
    const value = localStorage.getItem("netcity-quality");
    if (value === "low" || value === "medium" || value === "high") return value;
  } catch {
    /* Storage may be disabled. */
  }
  return matchMedia("(pointer:coarse)").matches ? "low" : "medium";
}
export function configureGraphics(
  scene: Scene,
  engine: Engine,
  sun: DirectionalLight,
  initial: Quality,
) {
  const shadow = new ShadowGenerator(1024, sun);
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadow.bias = 0.001;
  shadow.normalBias = 0.025;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 100;
  sun.position.set(20, 38, -25);
  let quality = initial,
    dead = false;
  let assetsReady = false;
  let environment: CubeTexture | undefined;
  let environmentLoaded = false;
  let finishEnvironment: (ok: boolean) => void = () => {};
  const environmentReady = new Promise<void>((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    finishEnvironment = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      environmentLoaded = ok;
      if (ok && !dead) {
        scene.environmentTexture = environment!;
        scene.environmentIntensity = 0.65;
      } else if (!dead)
        console.warn("Environment unavailable; using daylight fallback.");
      resolve();
    };
    environment = new CubeTexture(
      "/assets/environment/potsdamer_platz_128.env",
      scene,
      {
        prefiltered: true,
        forcedExtension: ".env",
        createPolynomials: true,
        onLoad: () => finishEnvironment(true),
        onError: () => finishEnvironment(false),
      },
    );
    timeout = setTimeout(() => {
      finishEnvironment(false);
      environment?.dispose();
    }, 15000);
  });
  const apply = (next: Quality) => {
    quality = next;
    const effective = assetsReady ? next : "low";
    engine.setHardwareScalingLevel(
      effective === "low" ? 1.5 : effective === "medium" ? 1 : 0.8,
    );
    sun.shadowEnabled = assetsReady && next !== "low";
    shadow.getShadowMap()!.refreshRate = next === "high" ? 1 : 2;
    shadow.getShadowMap()!.resize(next === "high" ? 2048 : 1024);
    shadow.filteringQuality =
      next === "high"
        ? ShadowGenerator.QUALITY_MEDIUM
        : ShadowGenerator.QUALITY_LOW;
    scene.fogStart = next === "low" ? 28 : 40;
    scene.fogEnd = next === "low" ? 65 : 100;
    scene.metadata = { ...scene.metadata, quality: next };
    try {
      localStorage.setItem("netcity-quality", next);
    } catch {
      /* The setting still applies for this session. */
    }
  };
  apply(initial);
  return {
    environmentReady,
    activate() {
      assetsReady = true;
      apply(quality);
    },
    shadow,
    apply,
    get environmentLoaded() {
      return environmentLoaded;
    },
    get quality() {
      return quality;
    },
    refreshCasters() {
      const list = shadow.getShadowMap()!.renderList!;
      list.length = 0;
      for (const mesh of scene.meshes) {
        if (
          mesh.getTotalVertices() > 0 &&
          mesh.name !== "ground" &&
          !mesh.name.includes("nickname-") &&
          !mesh.name.includes("detail-batch-road")
        ) {
          list.push(mesh);
          mesh.receiveShadows = true;
        }
      }
    },
    dispose() {
      if (dead) return;
      dead = true;
      finishEnvironment(false);
      shadow.dispose();
      environment?.dispose();
    },
  };
}
