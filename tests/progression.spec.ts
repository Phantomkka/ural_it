import { test, expect } from "@playwright/test";
import { drive, alignDoor } from "./navigation";
test.use({ viewport: { width: 844, height: 650 }, actionTimeout: 15000 });
test("earn NET and XP, buy consumables, service rack and perform a fresh repeat order; guest survives reload", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem("netcity-quality", "low"),
  );
  await page.goto("/");
  await expect(page.locator(".profile-summary")).toContainText("0 NET");
  const openProfile = async () => {
    await page
      .getByRole("button", { name: "Работа и снабжение", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  };
  await openProfile();
  let dialog = page.getByRole("dialog");
  await expect(dialog.locator(".persistence-mode")).toContainText(
    "Временные данные",
  );
  const firstID = await dialog
    .locator('[data-job-kind="patch"] .job-id')
    .textContent();
  await dialog
    .getByRole("button", { name: "Купить: 30 NET", exact: true })
    .click();
  await expect(dialog).toContainText("Недостаточно кредитов");
  await expect(dialog.locator(".notification")).toBeInViewport();
  await dialog
    .getByRole("button", { name: "Закрыть профиль", exact: true })
    .click();
  await expect(page.locator(".asset-status")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 45000 },
  );
  await page.locator("canvas").click({ position: { x: 450, y: 350 } });
  await drive(
    page,
    "z",
    -0.5,
    () => page.keyboard.down("KeyW"),
    () => page.keyboard.up("KeyW"),
  );
  await alignDoor(page, async (direction) => {
    await page.evaluate(
      (direction) =>
        new Promise<void>((r) => {
          const code = direction > 0 ? "KeyW" : "KeyS";
          window.dispatchEvent(new KeyboardEvent("keydown", { code }));
          setTimeout(() => {
            window.dispatchEvent(new Event("blur"));
            window.dispatchEvent(new KeyboardEvent("keyup", { code }));
            r();
          }, 35);
        }),
      direction,
    );
  });
  await page.evaluate(() =>
    document.dispatchEvent(
      new MouseEvent("mousemove", { movementX: Math.PI / 2 / 0.002 }),
    ),
  );
  await drive(
    page,
    "x",
    16,
    () => page.keyboard.down("KeyW"),
    () => page.keyboard.up("KeyW"),
  );
  await expect(page.locator(".interaction-hint")).toBeVisible();
  await page.keyboard.press("KeyE");
  dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-port="3"]').click();
  await expect(page.locator(".profile-summary")).toContainText("100 NET");
  await page.keyboard.press("Escape");
  await openProfile();
  await expect(dialog).toContainText("Уровень 2 · 60 XP");
  await dialog
    .getByRole("button", { name: "Купить: 20 NET", exact: true })
    .click();
  await expect(dialog.getByTestId("wallet")).toHaveText("80 NET");
  await expect(dialog.locator('[data-item="cleaner"]')).toHaveText("1");
  await dialog
    .locator('[data-job-kind="rack"]')
    .getByRole("button", { name: "Взять заявку", exact: true })
    .click();
  await expect(dialog.locator('[data-job-kind="rack"]')).toHaveAttribute(
    "data-job-status",
    "ACTIVE",
  );
  await dialog
    .getByRole("button", { name: "Закрыть профиль", exact: true })
    .click();
  await page.locator("canvas").click({ position: { x: 450, y: 350 } });
  await page.keyboard.press("KeyE");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Осмотреть охлаждение", exact: true })
    .click();
  await expect(dialog).toContainText("Обнаружена пыль");
  await dialog
    .getByRole("button", { name: "Очистить охлаждение", exact: true })
    .click();
  await expect(page.locator(".profile-summary")).toContainText("160 NET");
  await expect(dialog).toContainText("Охлаждение обслужено");
  await page.keyboard.press("Escape");
  await openProfile();
  await expect(dialog.locator('[data-item="cleaner"]')).toHaveText("0");
  const repeat = dialog.locator(
    '[data-job-kind="patch"][data-job-status="AVAILABLE"]',
  );
  await expect(repeat).toBeVisible({ timeout: 40000 });
  expect(await repeat.locator(".job-id").textContent()).not.toBe(firstID);
  await dialog
    .getByRole("button", { name: "Купить: 30 NET", exact: true })
    .click();
  await expect(dialog.getByTestId("wallet")).toHaveText("130 NET");
  await repeat
    .getByRole("button", { name: "Взять заявку", exact: true })
    .click();
  await expect(repeat).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Закрыть профиль", exact: true })
    .click();
  await page.locator("canvas").click({ position: { x: 450, y: 350 } });
  await page.keyboard.press("KeyE");
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-port="3"]').click();
  await expect(page.locator(".profile-summary")).toContainText("230 NET");
  await page.keyboard.press("Escape");
  await openProfile();
  await expect(dialog).toContainText("Уровень 2 · 170 XP");
  await expect(dialog.locator('[data-item="patch_cord"]')).toHaveText("0");
  await page.screenshot({ path: test.info().outputPath("netcity-progression-desktop.png") });
  const token = await page.evaluate(() =>
    sessionStorage.getItem("netcity-guest-token"),
  );
  await page.reload();
  await expect(page.locator(".profile-summary")).toContainText("230 NET");
  expect(
    await page.evaluate(() => sessionStorage.getItem("netcity-guest-token")),
  ).toBe(token);
  expect(errors).toEqual([]);
  const context=page.context();await page.close();const nextTab=await context.newPage();
  await nextTab.goto("/");await expect(nextTab.locator(".profile-summary")).toContainText("230 NET");
  await expect(nextTab.locator(".identity-status")).toHaveAttribute("data-mode","device");
});
test("mobile profile and supply UI fits portrait and landscape and does not cover controls", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    localStorage.setItem("netcity-quality", "low"),
  );
  await page.goto("/");
  await expect(page.locator(".profile-summary")).toContainText("0 NET");
  await page
    .getByRole("button", { name: "Работа и снабжение", exact: true })
    .tap();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Купить: 20 NET", exact: true })
    .tap();
  await expect(dialog).toContainText("Недостаточно кредитов");
  await expect(dialog.locator(".notification")).toBeInViewport();
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("netcity-progression-mobile.png") });
  await dialog
    .getByRole("button", { name: "Закрыть профиль", exact: true })
    .tap();
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 500 },
  ]) {
    await page.setViewportSize(size);
    const button = (await page
      .getByRole("button", { name: "Работа и снабжение", exact: true })
      .boundingBox())!;
    const stick = (await page.getByLabel("Джойстик движения").boundingBox())!;
    const interact = (await page
      .getByRole("button", { name: "Осмотреть", exact: true })
      .boundingBox())!;
    expect(button.y + button.height).toBeLessThan(interact.y);
    expect(button.y + button.height).toBeLessThan(stick.y);
  }
  await context.close();
});
