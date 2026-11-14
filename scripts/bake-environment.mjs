// Bake the CC0 HDRI once with Babylon; ship prefiltered .env so phones never run HDR convolution.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("..", import.meta.url),
  html = new URL("../apps/client/__bake-environment.html", import.meta.url),
  module = new URL("../apps/client/src/__bakeEnvironment.ts", import.meta.url);
let service, browser;
let createdHtml = false,
  createdModule = false;
try {
  const busy = await fetch("http://127.0.0.1:5173").then(
    () => true,
    () => false,
  );
  if (busy)
    throw new Error(
      "Stop the existing dev server before baking (port 5173 is in use).",
    );
  await writeFile(
    html,
    '<html><body><canvas id="bake" width="128" height="128"></canvas><script type="module" src="/src/__bakeEnvironment.ts"></script></body></html>',
    { flag: "wx" },
  );
  createdHtml = true;
  await writeFile(
    module,
    `import {Engine,Scene,HDRCubeTexture,FreeCamera,Vector3} from './babylon';
import {CreateEnvTextureAsync} from '@babylonjs/core/Misc/environmentTextureTools.js';
const engine=new Engine(document.getElementById('bake') as HTMLCanvasElement,false);const scene=new Scene(engine);scene.activeCamera=new FreeCamera('bake-camera',new Vector3(0,0,-2),scene);
const texture=new HDRCubeTexture('/assets/environment/potsdamer_platz_1k.hdr',scene,128,false,true,false,true,async()=>{
 try{const buffer=await CreateEnvTextureAsync(texture,{imageType:'image/png'});(window as any).__baked=Array.from(new Uint8Array(buffer));}catch(error){(window as any).__bakeError=String(error);}
},message=>{(window as any).__bakeError=message;});
engine.runRenderLoop(()=>scene.render());`,
    { flag: "wx" },
  );
  createdModule = true;
  service = spawn("npm", ["run", "dev"], {
    cwd: root,
    detached: true,
    stdio: "ignore",
  });
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      if ((await fetch("http://127.0.0.1:5173/__bake-environment.html")).ok)
        break;
    } catch {}
    if (Date.now() > deadline) throw new Error("Dev server unavailable");
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error(error.message));
  await page.goto("http://127.0.0.1:5173/__bake-environment.html");
  await page.waitForFunction(
    () => window.__baked || window.__bakeError,
    {},
    { timeout: 90000 },
  );
  const result = await page.evaluate(() => ({
    data: window.__baked,
    error: window.__bakeError,
  }));
  if (result.error) throw new Error(result.error);
  const bytes = Buffer.from(result.data);
  await writeFile(
    new URL(
      "../apps/client/public/assets/environment/potsdamer_platz_128.env",
      import.meta.url,
    ),
    bytes,
  );
  await writeFile(
    new URL(
      "../apps/client/public/assets/environment/prefiltered-metadata.json",
      import.meta.url,
    ),
    JSON.stringify(
      {
        file: "potsdamer_platz_128.env",
        author: "HDRI Haven / Poly Haven",
        license: "CC0-1.0",
        source: "potsdamer_platz_1k.hdr",
        modification:
          "128px prefiltered RGBD cubemap baked with Babylon EnvironmentTextureTools",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Baked environment bytes:", bytes.length);
} finally {
  await browser?.close();
  if (service?.pid) {
    try {
      process.kill(-service.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  if (createdModule) await unlink(module).catch(() => {});
  if (createdHtml) await unlink(html).catch(() => {});
}
