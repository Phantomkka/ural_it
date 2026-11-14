import {test,expect} from "@playwright/test";
import {drive} from "./navigation";
test("district contact explains the first job and routes to the real work board",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("netcity-quality","low"));
  await page.goto("/");await expect(page.locator("aside")).toContainText("В сети");
  await page.locator("canvas").click({position:{x:450,y:350}});
  await drive(page,"z",-5,()=>page.keyboard.down("KeyW"),()=>page.keyboard.up("KeyW"));
  await page.evaluate(()=>document.dispatchEvent(new MouseEvent("mousemove",{movementX:Math.PI/2/0.002})));
  await drive(page,"x",2,()=>page.keyboard.down("KeyW"),()=>page.keyboard.up("KeyW"));
  await page.evaluate(async()=>{
    const path="/src/world.ts",{EngineStore}=await import(/* @vite-ignore */path);
    const c=EngineStore.LastCreatedScene.activeCamera;
    document.dispatchEvent(new MouseEvent("mousemove",{movementX:(Math.atan2(4-c.position.x,-5-c.position.z)-c.rotation.y)/0.002}));
  });
  await expect(page.locator(".interaction-hint")).toContainText("Алина");
  await page.keyboard.press("KeyE");await expect(page.getByRole("dialog")).toHaveAccessibleName("Диспетчер Алина");
  await expect(page.getByRole("dialog")).toContainText("порт №3");
  await page.getByRole("button",{name:"Доска работ и снабжение",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("Диагностика рабочих мест");
  await expect(page.getByTestId("wallet")).toHaveText("0 NET");
  await page.getByRole("button",{name:"Закрыть профиль",exact:true}).click();
  await page.getByRole("button",{name:"Главное меню",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("NETCITY 2.0");
  await page.screenshot({path:test.info().outputPath("2-district-desktop.png")});
});
test("mobile main menu and map remain usable in portrait",async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();await page.goto("/");await expect(page.locator("aside")).toContainText("В сети");
  await page.getByRole("button",{name:"Главное меню",exact:true}).tap();
  await page.getByRole("button",{name:"Карта района",exact:true}).tap();
  await expect(page.getByRole("img",{name:"Карта Новолинска"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath("2-district-mobile.png")});await context.close();
});
