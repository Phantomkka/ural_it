import { test, expect, type Page } from "@playwright/test";
async function resources(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/src/world.ts";
    const { EngineStore } = await import(/* @vite-ignore */ modulePath);
    const engines = EngineStore.Instances;
    const scene = engines[0]?.scenes[0];
    return {
      engines: engines.length,
      scenes: engines.reduce(
        (n: number, e: { scenes: unknown[] }) => n + e.scenes.length,
        0,
      ),
      meshes: scene?.meshes.length ?? 0,
      materials: scene?.materials.length ?? 0,
      textures: scene?.textures.length ?? 0,
      avatars:
        scene?.transformNodes.filter((node: { name: string }) =>
          node.name.startsWith("player-"),
        ).length ?? 0,
      loops: engines[0]?._activeRenderLoops.length ?? 0,
    };
  });
}
test("disconnect disposes WebGL resources; repeated reconnects keep one scene and no stale players", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const Native = window.WebSocket;
    (window as any).__gameSockets = [];
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (String(url).includes("/game/"))
          (window as any).__gameSockets.push(this);
      }
    };
  });
  const a = await context.newPage(),
    b = await context.newPage();
  const errors: string[] = [];
  a.on("pageerror", (e) => errors.push(e.message));
  await b.goto("/");
  await expect(b.locator("aside")).toContainText("В сети");
  await a.goto("/");
  await expect(a.locator("aside")).toContainText("Игроков: 2");
  await expect
    .poll(async () => (await resources(a)).textures)
    .toBeGreaterThan(3);
  // State may arrive before the first rendered avatar. Measure a fully built scene.
  await expect.poll(async () => (await resources(a)).avatars).toBe(1);
  await a.evaluate(async () => {
    const modulePath = "/src/world.ts";
    const { EngineStore } = await import(/* @vite-ignore */ modulePath);
    await new Promise<void>((resolve) =>
      EngineStore.LastCreatedScene.executeWhenReady(() => resolve()),
    );
  });
  const baseline = await resources(a);
  expect(baseline.engines).toBe(1);
  expect(baseline.scenes).toBe(1);
  expect(baseline.loops).toBe(1);
  for (let i = 0; i < 3; i++) {
    await a.evaluate(() => {
      for (const socket of (window as any).__gameSockets)
        if (socket.readyState === WebSocket.OPEN)
          socket.close(4000, "test disconnect");
    });
    await expect(a.locator("aside")).toContainText("Соединение закрыто");
    await expect(b.locator("aside")).toContainText("Игроков: 1");
    await expect.poll(async () => (await resources(a)).engines).toBe(0);
    await a.getByRole("button", { name: "Переподключиться" }).click();
    await expect(a.locator("aside")).toContainText("Игроков: 2");
    await expect.poll(() => resources(a)).toEqual(baseline);
  }
  // Rapid retries can resolve out of order: cancelled connections must leave again.
  for (let i = 0; i < 3; i++) {
    await a.getByRole("button", { name: "Переподключиться" }).click();
    await a.waitForTimeout(50);
  }
  await expect(a.locator("aside")).toContainText("Игроков: 2");
  await expect(b.locator("aside")).toContainText("Игроков: 2");
  await expect.poll(() => resources(a)).toEqual(baseline);
  await b.close();
  await expect(a.locator("aside")).toContainText("Игроков: 1");
  await expect
    .poll(async () => (await resources(a)).textures)
    .toBe(baseline.textures - 1);
  await expect
    .poll(async () => (await resources(a)).materials)
    .toBe(baseline.materials - 1);
  expect(errors).toEqual([]);
  await context.close();
});
