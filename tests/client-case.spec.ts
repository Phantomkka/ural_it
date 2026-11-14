import {test,expect} from '@playwright/test';
import {tabletApp} from './navigation';
import {walk} from './case-navigation';
test.use({actionTimeout:15000,viewport:{width:844,height:650}});

test('tablet call, interview, diagnosis, supplier, carry, repair and client signoff survive reload',async({page})=>{
  test.setTimeout(300000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('netcity-quality','low'));
  await page.goto('/');
  await expect(page.locator('.connection-status')).toContainText('В сети');
  await expect(page.locator('.ticket')).toHaveCount(0);
  await tabletApp(page,'Звонки');
  await page.getByRole('button',{name:'Ответить и принять',exact:true}).click();
  await expect(page.locator('.profile-summary')).toContainText('30 NET');
  await page.getByRole('button',{name:'Что изменилось вчера?',exact:true}).click();
  await expect(page.locator('.case-feedback')).toContainText('Подойдите');
  await page.keyboard.press('Escape');
  await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:45000});
  const move=async(axis:'x'|'z',goal:number)=>{await page.locator('canvas').click();await walk(page,axis,goal);};
  const action=async(label:string)=>{await tabletApp(page,'Заявки');await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByText('Ожидание подтверждения…',{exact:false})).toHaveCount(0);};
  await move('z',0);await move('x',11);await move('z',-2.5);
  await action('Что изменилось вчера?');await action('Горит ли индикатор?');
  await page.keyboard.press('Escape');await move('z',-4);
  await action('Проверить кабель и индикатор линка');
  await expect(page.locator('.case-desk')).toContainText('Кабель пережат');
  await page.reload();await expect(page.locator('.connection-status')).toContainText('В сети');
  await tabletApp(page,'Заявки');await expect(page.locator('.case-desk')).toContainText('Замените повреждённый кабель');
  await page.keyboard.press('Escape');
  // Reload respawns at the street; reach the real supplier with normal movement.
  await move('z',0);await move('x',-6);await move('z',2);
  await action('Купить у Марата · 30 NET');await expect(page.locator('.profile-summary')).toContainText('0 NET');
  await action('Достать патч-корд');
  await tabletApp(page,'Рюкзак и магазин');await expect(page.locator('.tablet-content')).toContainText('В руках: патч-корд');
  await page.getByRole('button',{name:'Положить у ног',exact:true}).click();
  await expect(page.locator('.tablet-content')).toContainText('В руках: ничего');
  await page.getByRole('button',{name:'Подобрать свою деталь',exact:true}).click();
  await expect(page.locator('.tablet-content')).toContainText('В руках: патч-корд');
  await page.keyboard.press('Escape');
  await move('z',0);await move('x',11);await move('z',-4);
  await action('Установить в розетку №1');await expect(page.locator('.case-feedback')).toContainText('Деталь не потрачена');
  await action('Установить в розетку №2');await action('Проверить линк на месте');
  await page.keyboard.press('Escape');await move('z',-2.5);
  await action('Сдать работу Елене');
  await expect(page.locator('.profile-summary')).toContainText('110 NET');
  await expect(page.locator('.profile-summary')).toContainText('80 XP');
  await page.reload();await expect(page.locator('.connection-status')).toContainText('В сети');
  await tabletApp(page,'Компания');await expect(page.locator('.tablet-content')).toContainText('Завершено клиентских работ: 1');
  await expect(page.locator('.profile-summary')).toContainText('110 NET');
  expect(errors).toEqual([]);
});

test('portrait tablet, focus navigation and calls leave touch controls usable',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto('/');
  await expect(page.locator('.connection-status')).toContainText('В сети');
  await page.getByRole('button',{name:'Открыть планшет'}).tap();
  await expect(page.getByRole('dialog',{name:'Планшет инженера'})).toBeVisible();
  await page.getByRole('button',{name:'Ответить и принять'}).tap();
  await expect(page.locator('.profile-summary')).toContainText('30 NET');
  for(const name of ['GPS','Рюкзак и магазин','Компания','Контакты']){
    await tabletApp(page,name);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.keyboard.press('Tab');expect(await page.locator('.tablet-frame').count()).toBe(1);
  await page.getByRole('button',{name:'Закрыть планшет'}).tap();
  await expect(page.getByLabel('Джойстик движения')).toBeVisible();
  await context.close();
});
