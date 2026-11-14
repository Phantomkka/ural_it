import {test,expect} from "@playwright/test";
test("malformed device keys are repaired without claiming another profile",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("netcity-saved-guest-token","invalid"));
  await page.goto("/");await expect(page.locator("aside")).toContainText("В сети");
  await expect(page.locator(".identity-status")).toHaveAttribute("data-mode","device");
});
test("a legacy tab never overwrites a different saved profile",async({browser})=>{
  const a=await browser.newContext(),b=await browser.newContext();
  const first=await a.newPage(),second=await b.newPage();
  await first.goto("/");await second.goto("/");
  await expect(first.locator("aside")).toContainText("В сети");await expect(second.locator("aside")).toContainText("В сети");
  const original=await first.evaluate(()=>localStorage.getItem("netcity-saved-guest-token"));
  const other=await second.evaluate(()=>sessionStorage.getItem("netcity-guest-token"));
  await first.evaluate(token=>sessionStorage.setItem("netcity-guest-token",token!),other);
  await first.reload();await expect(first.locator("aside")).toContainText("В сети");
  await expect(first.locator(".identity-status")).toContainText("другой профиль");
  expect(await first.evaluate(token=>localStorage.getItem("netcity-saved-guest-token")===token,original)).toBe(true);
  await b.close();await a.close();
});
test("profile survives closing a tab, migrates old session storage and stays separate across browsers",async({browser})=>{
  const a=await browser.newContext();let page=await a.newPage();
  await page.goto("/");await expect(page.locator("aside")).toContainText("В сети");
  const nickname=await page.locator("aside > span").innerText();
  await expect(page.locator(".identity-status")).toHaveAttribute("data-mode","device");
  await page.evaluate(()=>localStorage.removeItem("netcity-saved-guest-token"));
  await page.reload();await expect(page.locator("aside")).toContainText("В сети");
  expect(await page.evaluate(()=>localStorage.getItem("netcity-saved-guest-token")===sessionStorage.getItem("netcity-guest-token"))).toBe(true);
  await page.close();page=await a.newPage();await page.goto("/");await expect(page.locator("aside")).toContainText("В сети");
  expect(await page.locator("aside > span").innerText()).toBe(nickname);
  const b=await browser.newContext();const independent=await b.newPage();
  await independent.goto("/");await expect(independent.locator("aside")).toContainText("В сети");
  expect((await independent.locator("aside > span").innerText()).split(" · ")[0]).not.toBe(nickname.split(" · ")[0]);
  await b.close();await a.close();
});
test("unavailable device storage never claims durable identity",async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,"localStorage",{get(){throw new DOMException("Blocked","SecurityError");}});});
  await page.goto("/");await expect(page.locator("aside")).toContainText("В сети");
  await expect(page.locator(".identity-status")).toHaveAttribute("data-mode","tab");
  await expect(page.locator(".identity-status")).toContainText("только в этой вкладке");
});
test("a permanent authorization error does not silently replace an existing profile",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("netcity-saved-guest-token","b".repeat(64)));
  let registrations=0;page.on("request",r=>{if(r.url().endsWith("/game/guest"))registrations++;});
  await page.route("**/game/matchmake/**",route=>route.fulfill({status:401,contentType:"application/json",body:JSON.stringify({code:401,error:"Профиль не найден"})}));
  await page.goto("/");await expect(page.locator("aside")).toContainText("Ошибка подключения");
  expect(registrations).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem("netcity-saved-guest-token")==="b".repeat(64))).toBe(true);
});
