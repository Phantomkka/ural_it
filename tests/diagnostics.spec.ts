import {test,expect} from '@playwright/test';
import {tabletApp} from './navigation';
import {walk} from './case-navigation';

test('engineering network call uses observed evidence, real repair and fresh acceptance readings through reload',async({page})=>{
 test.setTimeout(240000);page.setDefaultTimeout(15000);await page.addInitScript(()=>localStorage.setItem('netcity-quality','low'));await page.goto('/');await expect(page.locator('.connection-status')).toContainText('В сети');
 await tabletApp(page,'Диагностика');await expect(page.locator('.lab-catalog .mission-list article')).toHaveCount(14);await page.locator('.lab-catalog article').filter({hasText:'Инженерный аудит: Сеть пропала после перестановки'}).getByRole('button',{name:'Получить инженерный звонок',exact:true}).click();
 const act=async(label:string)=>{const b=page.getByRole('button',{name:label,exact:true});await expect(b).toBeEnabled();await b.click();await expect(page.getByText('Ожидание подтверждения…',{exact:false})).toHaveCount(0);};
 await act('Ответить и принять');await page.keyboard.press('Escape');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const move=async(axis:'x'|'z',goal:number)=>{await page.locator('canvas').click();await walk(page,axis,goal);};
 await move('z',0);await move('x',11);await move('z',-2.5);await tabletApp(page,'Диагностика');await act('Что изменилось?');await act('Кого затронуло?');await page.keyboard.press('Escape');await move('z',-4);await tabletApp(page,'Диагностика');
 await act('Подтвердить причину по измерениям');await expect(page.locator('.case-feedback')).toContainText('обязательные показания');await act('Кабель / порт коммутатора · обязательно');await act('Ping / потери · обязательно');await expect(page.locator('.lab-readings article')).toHaveCount(2);
 const physical=(await page.locator('.lab-readings').innerText()).includes('Обрыв пары');await page.getByLabel('Диагностическая гипотеза').selectOption(physical?'cable':'vlan');await act('Подтвердить причину по измерениям');
 if(physical){
  await page.keyboard.press('Escape');await move('z',0);await move('x',-6);await move('z',2);await tabletApp(page,'Диагностика');await act('Купить у Марата · 30 NET');await act('Взять деталь в руки');await page.keyboard.press('Escape');await move('z',0);await move('x',11);await move('z',-4);await tabletApp(page,'Диагностика');await act('Установить · разъём 2');
 }else{
  await page.locator('.lab-site summary').click();const vlan=await page.locator('.lab-site dt').filter({hasText:/^VLAN$/}).evaluate(e=>e.nextElementSibling!.textContent!);await page.getByLabel('VLAN порта').fill(vlan);await act('Применить VLAN');
 }
 await act('Подтвердить контрольные измерения');await expect(page.locator('.case-feedback')).toContainText('после последнего изменения');await act('Кабель / порт коммутатора · обязательно');await act('Ping / потери · обязательно');await act('Подтвердить контрольные измерения');
 await page.reload();await expect(page.locator('.connection-status')).toContainText('В сети');await tabletApp(page,'Диагностика');await expect(page.locator('.lab-readings')).toContainText('Показания в норме');await page.keyboard.press('Escape');await move('z',0);await move('x',11);await move('z',-2.5);await tabletApp(page,'Диагностика');await act('Сдать акт клиенту');await expect(page.locator('.diagnostic-desk')).toContainText('Акт подписан');await expect(page.locator('.profile-summary')).toContainText('200 NET');await expect(page.locator('.profile-summary')).toContainText('135 XP');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('portrait engineering catalog and diagnostic navigation fit touch controls',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});try{const page=await context.newPage();await page.goto('/');await expect(page.locator('.connection-status')).toContainText('В сети');await tabletApp(page,'Диагностика');await expect(page.locator('.lab-catalog .mission-list article')).toHaveCount(14);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}finally{await context.close();}
});
