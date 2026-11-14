import {test,expect} from "@playwright/test";
test("the first company contract offers real work instead of a client reward button",async({page})=>{
  await page.goto("/");await expect(page.locator("aside")).toContainText("В сети");
  await page.getByRole("button",{name:"Работа и снабжение",exact:true}).click();
  await page.locator(".company-details > summary").click();
  const company=page.getByLabel("Моя IT-бригада");await expect(company).toContainText("Офис под ключ");
  await expect(company.getByTestId("reputation")).toHaveText("0");
  await expect(company.getByRole("progressbar")).toHaveAttribute("value","0");
  await page.screenshot({path:test.info().outputPath("2-company.png")});
  await company.getByRole("button",{name:"К заявке №003",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Отслеживать заявку")).toHaveValue("003");
});
