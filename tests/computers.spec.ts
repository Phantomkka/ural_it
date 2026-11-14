import { test, expect, type Page } from "@playwright/test";
import { drive, alignDoor, tabletApp, legacyWork } from "./navigation";
import {view,face,walk} from "./case-navigation";
async function lock(page: Page) {
  await page.locator("canvas").click({ position: { x: 470, y: 340 } });
}
async function openPC(page: Page, id: string, x: number, z: number) {
  const p = await view(page);
  await face(page, x, z, Math.atan2(0.32, Math.hypot(x - p.x, z - p.z)));
  try {
    await expect(page.locator(".interaction-hint")).toContainText(id);
  } catch (error) {
    await page.screenshot({ path: test.info().outputPath("netcity-pc-target-failure.png") });
    console.info(
      "Target diagnostic",
      await page.evaluate(async () => {
        const path = "/src/world.ts";
        const { EngineStore } = await import(/* @vite-ignore */ path);
        const s = EngineStore.LastCreatedScene,
          c = s.activeCamera;
        const hit = s.pickWithRay(
          c.getForwardRay(2.5),
          (m) => m.isPickable && !m.name.startsWith("player-"),
        );
        return {
          position: c.position,
          rotation: c.rotation,
          hit: hit?.pickedMesh?.name,
          computers: s.meshes
            .filter((m) => m.name.startsWith("pc-monitor"))
            .map((m) => ({
              name: m.name,
              position: m.position,
              enabled: m.isEnabled(),
              pickable: m.isPickable,
            })),
        };
      }),
    );
    throw error;
  }
  await page.keyboard.press("KeyE");
  await expect(
    page.getByRole("dialog", { name: `Компьютер ${id}`, exact: true }),
  ).toBeVisible();
}
test.use({ actionTimeout: 15000, viewport: { width: 844, height: 650 } });
test("diagnose and repair all office faults through the real virtual desktop, including mobile layout", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem("netcity-quality", "low"),
  );
  await page.goto("/");
  await expect(page.locator(".connection-status")).toContainText("В сети");
  await expect(page.locator(".asset-status")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 45000 },
  );
  await lock(page);
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
  const p = await view(page);
  await face(page, p.x + 20, p.z);
  await drive(
    page,
    "x",
    16,
    () => page.keyboard.down("KeyW"),
    () => page.keyboard.up("KeyW"),
  );
  await expect(page.locator(".interaction-hint")).toContainText("коммутатор");
  await page.keyboard.press("KeyE");
  await page.locator('[data-port="3"]').click();
  await expect(page.locator(".profile-summary")).toContainText("100 NET");
  await page.keyboard.press("Escape");
  await lock(page);
  await walk(page, "x", 16);
  await walk(page, "z", 3.8);
  await openPC(page, "OFFICE-PC02", 15, 4);
  const os = page.getByRole("dialog");
  const cmd = async (command: string) => {
    await os.getByLabel("Команда", { exact: true }).fill(command);
    await os.getByRole("button", { name: "Выполнить", exact: true }).click();
  };
  await os
    .getByRole("button", { name: "Закрыть заявку №002", exact: true })
    .click();
  await expect(os).toContainText("Пройдите все этапы");
  await os.getByRole("button", { name: "▣ Терминал", exact: true }).click();
  await cmd("ping 192.168.10.1");
  await expect(os.getByRole("log")).toContainText("Сетевой кабель отключён");
  await os
    .getByRole("button", { name: "Проверить кабель", exact: true })
    .click();
  await os
    .getByRole("button", { name: "Подключить кабель", exact: true })
    .click();
  await cmd("ping 192.168.10.1");
  await expect(os.getByRole("log")).toContainText("потеряно: 0");
  await os
    .getByRole("button", { name: "Закрыть заявку №002", exact: true })
    .click();
  await expect(os).toContainText("Заявка №002 выполнена");
  await page.screenshot({ path: test.info().outputPath("netcity-os-terminal.png") });
  await page.keyboard.press("Escape");
  await lock(page);
  await walk(page, "z", 0.15);
  await alignDoor(page, async (direction) => {
    await face(page, 16, direction > 0 ? 20 : -20);
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(40);
    await page.keyboard.up("KeyW");
  });
  await walk(page, "x", 11);
  await walk(page, "z", 3.8);
  await openPC(page, "OFFICE-PC03", 10, 4);
  await os.getByRole("button", { name: "▣ Терминал", exact: true }).click();
  await cmd("ipconfig");
  await expect(os.getByRole("log")).toContainText("192.168.20.103");
  await os
    .getByRole("button", { name: "⚙ Сетевые настройки", exact: true })
    .click();
  await os.getByLabel("IP-адрес", { exact: true }).fill("192.168.10.103");
  await os
    .getByRole("button", { name: "Сохранить настройки", exact: true })
    .click();
  await expect(os).toContainText("Сетевые настройки сохранены");
  await os.getByRole("button", { name: "▣ Терминал", exact: true }).click();
  await cmd("ping 192.168.10.1");
  await os
    .getByRole("button", { name: "Закрыть заявку №003", exact: true })
    .click();
  await expect(os).toContainText("Заявка №003 выполнена");
  await page.keyboard.press("Escape");
  await lock(page);
  await walk(page, "z", -3.8);
  await openPC(page, "OFFICE-PC01", 10, -4);
  await os.getByRole("button", { name: "▣ Терминал", exact: true }).click();
  await cmd("ping 192.168.10.1");
  await cmd("nslookup intranet.netcity.local");
  await expect(os.getByRole("log")).toContainText("Не удалось разрешить");
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const tap = async (locator: import("@playwright/test").Locator) => {
    await locator.scrollIntoViewIfNeeded();
    const box = (await locator.boundingBox())!;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };
  await os
    .getByRole("button", { name: "⚙ Сетевые настройки", exact: true })
    .click();
  await os.getByLabel("DNS-сервер", { exact: true }).fill("192.168.10.1");
  await os
    .getByRole("button", { name: "Сохранить настройки", exact: true })
    .click();
  await os.getByRole("button", { name: "▣ Терминал", exact: true }).click();
  await tap(
    os.getByRole("button", {
      name: "nslookup intranet.netcity.local",
      exact: true,
    }),
  );
  await expect(os.getByRole("log")).toContainText("Адрес: 192.168.10.10");
  await expect
    .poll(() =>
      os
        .getByRole("log")
        .evaluate(
          (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2,
        ),
    )
    .toBe(true);
  await os
    .getByRole("button", { name: "Закрыть заявку №004", exact: true })
    .click();
  await expect(os).toContainText("Заявка №004 выполнена");
  await expect(page.locator(".profile-summary")).toContainText("280 NET");
  await expect(page.getByLabel("Получена награда")).toContainText("+60 NET");
  expect((await os.boundingBox())!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("netcity-os-mobile.png") });
  await page.keyboard.press("Escape");
  await tabletApp(page,"Заявки");
  await page.getByText("Заявки NETCITY 2.0",{exact:true}).click();
  await page.locator(".journal summary").click();
  await expect(page.locator(".journal")).toContainText("награды: 4/4");
  for (const id of ["002", "003", "004"]) {
    await page.getByLabel("Активная заявка").selectOption(id);
    await expect(page.locator(`[data-job="${id}"]`)).toContainText("COMPLETED");
  }
  expect(errors).toEqual([]);
  await page.reload();
  await tabletApp(page,"Обзор");
  await expect(page.locator(".profile-summary")).toContainText("280 NET");
  await legacyWork(page);
  await expect(page.locator(".diagnostic-board")).toContainText("Выполнено и оплачено");
  await expect(page.getByLabel("Моя IT-бригада")).toContainText("Контракт выполнен");
  await expect(page.getByTestId("reputation")).toHaveText("1");
});
