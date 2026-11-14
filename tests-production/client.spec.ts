import { test, expect } from "@playwright/test";
test("production client loads local models and connects two browser guests through reverse proxy", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 650 },
  });
  await context.addInitScript(() =>
    localStorage.setItem("netcity-quality", "low"),
  );
  const a = await context.newPage(),
    b = await context.newPage();
  const errors: string[] = [];
  a.on("pageerror", (e) => errors.push(e.message));
  b.on("pageerror", (e) => errors.push(e.message));
  await a.goto("/");
  await expect(a.locator(".profile-summary")).toContainText("PostgreSQL");
  await b.goto("/");
  await expect(a.locator("aside")).toContainText("Игроков: 2");
  await expect(b.locator("aside")).toContainText("Игроков: 2");
  for (const page of [a, b])
    await expect(page.locator(".asset-status")).toHaveAttribute(
      "data-state",
      "ready",
      { timeout: 60000 },
    );
  await a.bringToFront();
  await a.locator("canvas").click({ position: { x: 450, y: 350 } });
  await a.keyboard.down("KeyW");
  await a.waitForTimeout(400);
  await a.keyboard.up("KeyW");
  await a.keyboard.press("Escape");
  await a.evaluate(() => {
    if (document.pointerLockElement) document.exitPointerLock();
  });
  await a
    .getByRole("button", { name: "Работа и снабжение", exact: true })
    .click();
  const dialog = a.getByRole("dialog");
  await expect(dialog).toContainText("PostgreSQL");
  await dialog
    .getByRole("button", { name: "Купить: 30 NET", exact: true })
    .click();
  await expect(dialog.locator(".notification")).toContainText("Недостаточно");
  await expect(dialog.locator(".notification")).toBeInViewport();
  await dialog
    .getByRole("button", { name: "Закрыть профиль", exact: true })
    .click();
  await a.screenshot({ path: "/tmp/netcity-production-client.png" });
  expect(errors).toEqual([]);
  await context.close();
});
