import { test, expect } from "@playwright/test";
async function assetScene(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const path = "/src/world.ts";
    const { EngineStore } = await import(/* @vite-ignore */ path);
    const scene = EngineStore.LastCreatedScene;
    return {
      state: scene.metadata?.graphics,
      quality: scene.metadata?.quality,
      shadowEnabled: scene.getLightByName("sun").shadowEnabled,
      renderWidth: scene.getEngine().getRenderWidth(),
      placements: scene.metadata?.assetPlacements ?? 0,
      architectures: scene.transformNodes.filter((n: { name: string }) =>
        /^architecture-\d+$/.test(n.name),
      ).length,
      instances: scene.meshes.filter(
        (m: { getClassName: () => string }) =>
          m.getClassName() === "InstancedMesh",
      ).length,
      fallbackBuilding: scene.getMeshByName("building-0")?.isEnabled(),
      character: scene.transformNodes.find((n: { name: string }) =>
        n.name.startsWith("player-"),
      )?.metadata,
      skeletons: scene.skeletons.length,
      environment: !!scene.environmentTexture,
      office: !!scene.getTransformNodeByName("office-exterior"),
    };
  });
}
test("local models load with real skins and instanced architecture; quality switches live", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const context = await browser.newContext();
  const a = await context.newPage(),
    b = await context.newPage();
  const remote: string[] = [];
  a.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:5173") &&
      !request.url().startsWith("data:") &&
      !request.url().startsWith("blob:")
    )
      remote.push(request.url());
  });
  await a.goto("/");
  await b.goto("/");
  await expect(a.locator(".asset-status")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 45000 },
  );
  await expect
    .poll(async () => (await assetScene(a)).character?.asset)
    .toMatch(/\.glb$/);
  const scene = await assetScene(a);
  expect(scene.state.failed).toEqual([]);
  expect(scene.placements).toBeGreaterThan(30);
  expect(scene.architectures).toBe(9);
  expect(scene.instances).toBeGreaterThan(10);
  expect(scene.skeletons).toBeGreaterThan(0);
  expect(scene.environment).toBe(true);
  expect(scene.office).toBe(true);
  expect(scene.fallbackBuilding).toBe(false);
  const widths: Record<string, number> = {};
  for (const quality of ["low", "high", "medium"]) {
    await a.getByLabel("Качество графики").selectOption(quality);
    await expect.poll(async () => (await assetScene(a)).quality).toBe(quality);
    const state = await assetScene(a);
    expect(state.shadowEnabled).toBe(quality !== "low");
    widths[quality] = state.renderWidth;
  }
  expect(widths.low).toBeLessThan(widths.medium);
  expect(widths.medium).toBeLessThan(widths.high);
  await b.bringToFront();
  await b.locator("canvas").click({ position: { x: 450, y: 350 } });
  await b.evaluate(() =>
    document.dispatchEvent(
      new MouseEvent("mousemove", { movementX: Math.PI / 0.002 }),
    ),
  );
  await b.keyboard.press("Escape");
  await a.bringToFront();
  await a.locator("canvas").click({ position: { x: 450, y: 350 } });
  await a.keyboard.down("KeyS");
  await a.waitForTimeout(450);
  await a.keyboard.up("KeyS");
  await a.keyboard.press("Escape");
  await a.waitForTimeout(200);
  expect(remote).toEqual([]);
  await a.screenshot({ path: "/tmp/netcity-overhaul-city.png" });
  await context.close();
});
test("failed assets report degraded graphics while fallback city and multiplayer stay usable", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const context = await browser.newContext();
  await context.route(
    /\/assets\/models\/(?:Worker|Casual|building_A).*\.glb$/,
    (route) => route.fulfill({ status: 503, body: "test unavailable" }),
  );
  const a = await context.newPage(),
    b = await context.newPage();
  await a.goto("/");
  await b.goto("/");
  await expect(a.locator(".asset-status")).toHaveAttribute(
    "data-state",
    "degraded",
    { timeout: 45000 },
  );
  await expect(a.locator("aside")).toContainText("Игроков: 2");
  await expect
    .poll(async () => (await assetScene(a)).character?.fallback)
    .toBe(true);
  expect((await assetScene(a)).fallbackBuilding).toBe(true);
  await expect(a.locator(".asset-status")).toContainText("Резервная графика");
  await context.close();
});
