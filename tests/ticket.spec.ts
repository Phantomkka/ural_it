import { test, expect, type Page } from "@playwright/test";
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const source = await (await fetch("/src/world.ts")).text();
    const modulePath = source.match(/from "([^"]*@babylonjs_core[^"]*)"/)![1];
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
async function drive(
  page: Page,
  axis: "x" | "z",
  goal: number,
  start: () => Promise<void>,
  stop: () => Promise<void>,
) {
  await start();
  try {
    await page.evaluate(
      async ({ axis, goal }) => {
        const source = await (await fetch("/src/world.ts")).text();
        const modulePath = source.match(
          /from "([^"]*@babylonjs_core[^"]*)"/,
        )![1];
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
              reject(new Error("Could not reach waypoint"));
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
test("complete ticket in browser with server replicated port and no duplicate award", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const a = await context.newPage(),
    b = await context.newPage();
  const errors: string[] = [];
  a.on("pageerror", (e) => errors.push(e.message));
  b.on("pageerror", (e) => errors.push(e.message));
  await a.goto("/");
  await expect(a.locator("aside")).toContainText("В сети");
  await b.goto("/");
  await expect(b.locator("aside")).toContainText("Игроков: 2");
  await a.bringToFront();
  await a.locator("canvas").click({ position: { x: 450, y: 350 } });
  await drive(
    a,
    "z",
    -0.5,
    () => a.keyboard.down("KeyW"),
    () => a.keyboard.up("KeyW"),
  );
  await a.evaluate(() =>
    document.dispatchEvent(
      new MouseEvent("mousemove", { movementX: Math.PI / 2 / 0.002 }),
    ),
  );
  await drive(
    a,
    "x",
    16,
    () => a.keyboard.down("KeyW"),
    () => a.keyboard.up("KeyW"),
  );
  await expect(
    a.getByText("[E] Осмотреть коммутатор", { exact: true }),
  ).toBeVisible();
  await a.keyboard.press("KeyE");
  const dialog = a.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-port="3"]')).toContainText("Отключён");
  await dialog.locator('[data-port="2"]').click();
  await expect(dialog).toContainText("Нужен порт №3");
  await expect(a.getByText("Награды за заявку: 0/1")).toBeVisible();
  await dialog.locator('[data-port="3"]').click();
  await expect(a.locator(".ticket")).toContainText(
    "✅ Заявка выполнена! Сеть восстановлена.",
  );
  await expect.poll(async () => (await snapshot(b)).port).toBe("port-online");
  await expect.poll(async () => (await snapshot(b)).cable).toBe(false);
  await dialog.locator('[data-port="3"]').click();
  await expect(dialog).toContainText("Повторная награда недоступна");
  await expect(a.getByText("Награды за заявку: 1/1")).toBeVisible();
  expect(errors).toEqual([]);
  await a.screenshot({ path: "/tmp/netcity-002-ticket.png" });
  await context.close();
});
test("mobile joystick, swipe camera, interaction button and responsive equipment panel", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 650 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("aside")).toContainText("В сети");
  const cdp = await context.newCDPSession(page);
  const touch = async (type: string, x?: number, y?: number) => {
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: x === undefined ? [] : [{ x, y, id: 1 }],
    });
  };
  const stick = await page.getByLabel("Джойстик движения").boundingBox();
  expect(stick).not.toBeNull();
  const sx = stick!.x + stick!.width / 2,
    sy = stick!.y + stick!.height / 2;
  await drive(
    page,
    "z",
    -0.5,
    () => touch("touchStart", sx, sy - 45),
    () => touch("touchEnd"),
  );
  const old = (await snapshot(page)).yaw;
  // Two genuine touch swipes rotate to the office entrance.
  for (const amount of [200, Math.PI / 2 / 0.004 - 200]) {
    await touch("touchStart", 500, 350);
    await touch("touchMove", 500 + amount, 350);
    await touch("touchEnd");
    await page.waitForTimeout(80);
  }
  await expect
    .poll(async () => (await snapshot(page)).yaw)
    .toBeGreaterThan(old + 1.5);
  await drive(
    page,
    "x",
    16,
    () => touch("touchStart", sx, sy - 45),
    () => touch("touchEnd"),
  );
  await expect(page.locator(".interaction-hint")).toBeVisible();
  await page.getByRole("button", { name: "Осмотреть", exact: true }).tap();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(844);
  await dialog.locator('[data-port="3"]').tap();
  await expect(page.locator(".ticket")).toContainText("✅ Заявка выполнена!");
  await page.screenshot({ path: "/tmp/netcity-002-mobile.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const portrait = await dialog.boundingBox();
  expect(portrait!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
