import { test, expect } from "@playwright/test";
import {tabletApp,legacyWork} from "../tests/navigation";
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
  const health=await (await a.request.get("/game/health")).json();
  expect(health).toMatchObject({status:"ok",persistence:"postgres"});
  expect(await (await a.request.get("/version.json")).json()).toEqual({revision:health.revision});
  await tabletApp(a,"Обзор");
  await expect(a.locator(".profile-summary")).toContainText("Прогресс сохраняется");
  await a.keyboard.press("Escape");
  await b.goto("/");
  await expect(a.locator(".connection-status")).toContainText("Игроков: 2");
  await expect(b.locator(".connection-status")).toContainText("Игроков: 2");
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
  await a.getByRole("button",{name:"Продолжить",exact:true}).click();
  await legacyWork(a);
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
  await a.screenshot({ path: test.info().outputPath("netcity-production-client.png") });
  expect(errors).toEqual([]);
  await context.close();
});

test('built tablet persists accepted client call through PostgreSQL and reload',async({page})=>{
  await page.goto('/');await expect(page.locator('.connection-status')).toContainText('В сети');
  await tabletApp(page,'Звонки');
  await page.getByRole('button',{name:'Ответить и принять',exact:true}).click();
  await expect(page.locator('.profile-summary')).toContainText('30 NET');
  await page.getByRole('button',{name:'Что изменилось вчера?',exact:true}).click();
  await expect(page.locator('.case-feedback')).toContainText('Подойдите');
  await page.reload();await expect(page.locator('.connection-status')).toContainText('В сети');
  await tabletApp(page,'Заявки');
  await expect(page.locator('.case-desk')).toContainText('Поговорите с клиентом');
  await expect(page.locator('.profile-summary')).toContainText('30 NET');
  await expect(page.getByRole('button',{name:'Ответить и принять',exact:true})).toHaveCount(0);
});
