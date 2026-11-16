import {
  ShadowGenerator,
  CubeTexture,
  type DirectionalLight,
  type Engine,
  type Scene,type StandardMaterial,
} from "./babylon";
import {FrameBudget} from './frameBudget';
export type Quality = "low" | "medium" | "high";
export function defaultQuality(): Quality {
  try {
    const value = localStorage.getItem("netcity-quality");
    if (value === "low" || value === "medium" || value === "high") return value;
  } catch {
    /* Storage may be disabled. */
  }
  return matchMedia("(pointer:coarse)").matches || navigator.hardwareConcurrency<=4 ? "low" : "medium";
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
  const budget=new FrameBudget();
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
    const selectedRank={low:0,medium:1,high:2}[next];
    const effective = assetsReady ? (['low','medium','high'] as const)[Math.max(0,selectedRank-budget.level)] : "low";
    engine.setHardwareScalingLevel(
      Math.max(effective === "low" ? 1.5 : effective === "medium" ? 1 : 1, budget.level>selectedRank?Math.min(2.5,1.5+(budget.level-selectedRank)*.25):1, Math.max(engine.getRenderingCanvas()?.clientWidth??0,engine.getRenderingCanvas()?.clientHeight??0)/(effective==='low'?1280:1920)),
    );
    sun.shadowEnabled = assetsReady && effective !== "low";
    shadow.getShadowMap()!.refreshRate = effective === "high" ? 1 : 2;
    shadow.getShadowMap()!.resize(effective === "high" ? 2048 : 1024);
    shadow.filteringQuality =
      effective === "high"
        ? ShadowGenerator.QUALITY_MEDIUM
        : ShadowGenerator.QUALITY_LOW;
    scene.fogStart = effective === "low" ? 28 : 40;
    scene.fogEnd = effective === "low" ? 65 : 100;
    scene.metadata = { ...scene.metadata, quality: next, effectiveQuality:effective, adaptiveLevel:budget.level };
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
    apply(next:Quality){budget.reset();apply(next);},
    sample(dt:number){if(assetsReady&&budget.sample(dt))apply(quality);},
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
          !mesh.metadata?.officeDetail &&
          !mesh.billboardMode &&
          !(mesh.material as StandardMaterial|null)?.disableLighting &&
          (mesh.material?.alpha??1)>=1 &&
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
