import { expect, type Page } from "@playwright/test";
export async function tabletApp(page:Page,name:string) {
  if(!await page.locator('.tablet-frame').count()) {
    if(await page.evaluate(()=>!!document.pointerLockElement))await page.keyboard.press('Tab');
    else await page.getByRole('button',{name:'Открыть планшет',exact:true}).click();
  }
  await page.getByRole('navigation',{name:'Приложения планшета'}).getByRole('button',{name,exact:true}).click();
}
export async function legacyWork(page:Page) {
  await tabletApp(page,'Рюкзак и магазин');
  await page.getByRole('button',{name:'Каталог и старые работы',exact:true}).click();
}
export async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/src/world.ts";
    const { EngineStore } = await import(/* @vite-ignore */ modulePath);
    const scene = EngineStore.LastCreatedScene;
    return {
      x: scene.activeCamera.position.x,
      z: scene.activeCamera.position.z,
      yaw: scene.activeCamera.rotation.y,
      port: scene.getMeshByName("port-3").material.name,
      cable: scene.getMeshByName("loose-patch-cord").isEnabled(),
    };
  });
}
export async function drive(
  page: Page,
  axis: "x" | "z",
  goal: number,
  start: () => Promise<void>,
  stop: () => Promise<void>,
) {
  // Warm the scene before holding movement: shader compilation can stall rAF
  // while server movement continues, making a test overshoot a narrow doorway.
  await page.evaluate(async () => {
    const modulePath = "/src/world.ts";
    const { EngineStore } = await import(/* @vite-ignore */ modulePath);
    await new Promise<void>((resolve) =>
      EngineStore.LastCreatedScene.executeWhenReady(() => resolve()),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await start();
  try {
    await page.evaluate(
      async ({ axis, goal }) => {
        const modulePath = "/src/world.ts";
        const { EngineStore } = await import(/* @vite-ignore */ modulePath);
        const deadline = performance.now() + 10000;
        await new Promise<void>((resolve, reject) => {
          const frame = () => {
            if (
              EngineStore.LastCreatedScene.activeCamera.position[axis] > goal
            ) {
              window.dispatchEvent(new Event("blur"));
              resolve();
              return;
            }
            if (performance.now() > deadline) {
              window.dispatchEvent(new Event("blur"));
              reject(
                new Error(
                  `Could not reach waypoint: ${JSON.stringify(EngineStore.LastCreatedScene.activeCamera.position)}`,
                ),
              );
              return;
            }
            requestAnimationFrame(frame);
          };
          frame();
        });
      },
      { axis, goal },
    );
  } finally {
    await stop();
  }
  await page.waitForTimeout(150);
}
// A human makes small corrections before entering a doorway. Use real input
// pulses and confirmed positions instead of assuming a long held key stops exactly.
export async function alignDoor(
  page: Page,
  pulse: (direction: number) => Promise<void>,
) {
  const settle = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  await settle();
  for (let i = 0; i < 12; i++) {
    const z = (await snapshot(page)).z;
    // The 2.4m opening and open door leaf leave this safe interval for a 0.4m-radius actor.
    // Do not require an exact center coordinate under a low-FPS software renderer.
    if (z >= -0.6 && z <= 0.7) return;
    await pulse(z > 0 ? -1 : 1);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.waitForTimeout(180);
    await settle();
  }
  const z = (await snapshot(page)).z;
  expect(z).toBeGreaterThanOrEqual(-0.6);
  expect(z).toBeLessThanOrEqual(0.7);
}
