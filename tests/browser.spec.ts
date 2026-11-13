import { test, expect } from '@playwright/test';
test('two browser players connect, render 3D, move and disconnect', async ({ browser }) => {
  const context = await browser.newContext();
  const a = await context.newPage();
  const b = await context.newPage();
  const errors: string[] = [];
  for (const page of [a, b]) page.on('pageerror', e => errors.push(e.message));
  await a.goto('/');
  await expect(a.locator('aside')).toContainText('В сети');
  await b.goto('/');
  await expect(a.locator('aside')).toContainText('Игроков: 2');
  await expect(b.locator('aside')).toContainText('Игроков: 2');
  // Inspect the actual Babylon scene through the same Vite module used by world.ts.
  const sceneSnapshot = async (page: typeof a) => page.evaluate(async () => {
    const source = await (await fetch('/src/world.ts')).text();
    const modulePath = source.match(/from \"([^\"]*@babylonjs_core[^\"]*)\"/)![1];
    const { EngineStore } = await import(/* @vite-ignore */ modulePath);
    const scene = EngineStore.LastCreatedScene;
    return { buildings: scene.meshes.filter((m: { name: string }) => m.name.startsWith('building-')).length,
      players: scene.meshes.filter((m: { name: string }) => m.name.startsWith('player-')).map((m: { position: { z: number } }) => m.position.z),
      z: scene.activeCamera.position.z };
  });
  await expect.poll(async () => (await sceneSnapshot(b)).players.length).toBe(1);
  expect((await sceneSnapshot(a)).buildings).toBe(10);
  const before = (await sceneSnapshot(a)).z;
  await a.bringToFront();
  await a.locator('canvas').click({ position: { x: 400, y: 300 } });
  await expect.poll(() => a.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await a.keyboard.down('KeyW'); await a.waitForTimeout(500); await a.keyboard.up('KeyW');
  await expect.poll(async () => (await sceneSnapshot(a)).z).toBeGreaterThan(before + 0.5);
  await expect.poll(async () => (await sceneSnapshot(b)).players[0]).toBeGreaterThan(before + 0.5);
  await a.keyboard.press('Escape');
  await a.screenshot({ path: '/tmp/netcity-browser.png' });
  await a.close();
  await expect(b.locator('aside')).toContainText('Игроков: 1');
  await expect.poll(async () => (await sceneSnapshot(b)).players.length).toBe(0);
  expect(errors).toEqual([]);
  await context.close();
});
