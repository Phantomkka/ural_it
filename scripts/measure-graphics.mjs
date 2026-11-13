// Local reproducible render probe. Uses system Chromium + SwiftShader, NOT a phone/PC FPS certification.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:5173";
let service, browser;
try {
  try {
    await fetch(base);
  } catch {
    service = spawn("npm", ["run", "dev"], {
      cwd: new URL("..", import.meta.url),
      detached: true,
      stdio: "ignore",
    });
    const deadline = Date.now() + 30000;
    for (;;) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      if (Date.now() > deadline) throw new Error("Dev server did not start");
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const results = [];
  for (const scenario of [
    { name: "desktop-low", width: 1280, height: 720, quality: "low" },
    { name: "desktop-medium", width: 1280, height: 720, quality: "medium" },
    { name: "desktop-high", width: 1280, height: 720, quality: "high" },
    {
      name: "mobile-low-emulation",
      width: 390,
      height: 844,
      quality: "low",
      mobile: true,
    },
  ]) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      isMobile: !!scenario.mobile,
      hasTouch: !!scenario.mobile,
    });
    await context.addInitScript(
      (quality) => localStorage.setItem("netcity-quality", quality),
      scenario.quality,
    );
    const observer = await context.newPage(),
      page = await context.newPage();
    await observer.goto(base);
    await page.goto(base);
    await page
      .locator('.asset-status[data-state="ready"]')
      .waitFor({ state: "attached", timeout: 45000 });
    await page
      .locator("aside")
      .filter({ hasText: "Игроков: 2" })
      .waitFor({ timeout: 20000 });
    await page.bringToFront();
    await page.getByLabel("Качество графики").selectOption(scenario.quality);
    const sample = await page.evaluate(async () => {
      const path = "/src/world.ts";
      const { EngineStore } = await import(/* @vite-ignore */ path);
      const scene = EngineStore.LastCreatedScene,
        engine = scene.getEngine();
      await new Promise((resolve) => scene.executeWhenReady(resolve));
      const loadToReadyMs = Math.round(performance.now());
      const assetBytes = performance
        .getEntriesByType("resource")
        .filter(
          (r) => r.name.includes("/assets/models/") || r.name.endsWith(".env"),
        )
        .reduce((sum, r) => sum + r.decodedBodySize, 0);
      // Bounded wall-clock probes remain useful even on very slow software GPUs.
      let previous = 0,
        warmFrames = 0;
      const warmStarted = performance.now();
      await new Promise((resolve) => {
        const frame = () => {
          if (++warmFrames >= 30 || performance.now() - warmStarted >= 3000)
            resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const deltas = [];
      const started = performance.now();
      await new Promise((resolve) => {
        const frame = (now) => {
          if (previous) deltas.push(now - previous);
          previous = now;
          if (deltas.length >= 120 || performance.now() - started >= 10000)
            resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const ordered = [...deltas].sort((a, b) => a - b),
        average = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const gl = engine._gl,
        extension = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        loadToReadyMs,
        assetBytes,
        samples: deltas.length,
        averageFps: Math.round((1000 / average) * 10) / 10,
        p50FrameMs:
          Math.round(ordered[Math.floor(ordered.length * 0.5)] * 100) / 100,
        p95FrameMs:
          Math.round(ordered[Math.floor(ordered.length * 0.95)] * 100) / 100,
        renderer: extension
          ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
          : engine.getGlInfo().renderer,
        antialias: gl.getContextAttributes().antialias,
        renderWidth: engine.getRenderWidth(),
        renderHeight: engine.getRenderHeight(),
        activeMeshes: scene.getActiveMeshes().length,
        activeIndices: scene.getActiveIndices(),
        visibleCharacter: scene.transformNodes.find((node) =>
          node.name.startsWith("player-"),
        )?.metadata?.asset,
        players: document.querySelector("aside").innerText,
        quality: scene.metadata.quality,
        graphicsState: scene.metadata.graphics.state,
      };
    });
    results.push({ ...scenario, ...sample });
    console.log(scenario.name, sample.averageFps + " FPS", sample.renderer);
    await writeFile(
      new URL("../benchmarks/graphics-swiftshader.json", import.meta.url),
      JSON.stringify(
        {
          completed: false,
          method:
            "Diagnostic SwiftShader probe; warm-up <=30 frames/3s, sample <=120 frames/10s; two pages on one software GPU; not a physical device benchmark.",
          results,
        },
        null,
        2,
      ) + "\n",
    );
    await context.close();
  }
  await writeFile(
    new URL("../benchmarks/graphics-swiftshader.json", import.meta.url),
    JSON.stringify(
      {
        completed: true,
        method:
          "Two connected players; fixed street view; up to 30 warm-up frames / 3 seconds, then up to 120 measured frames / 10 seconds; system headless Chromium using software SwiftShader. Mobile is viewport/touch emulation only. Not a real gaming PC or smartphone benchmark.",
        results,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser?.close();
  if (service?.pid) {
    try {
      process.kill(-service.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}
