import {test,expect} from '@playwright/test';
import {ENGINEERING_CASES} from '@netcity/shared';
import {tabletApp} from './navigation';
import {walk,face} from './case-navigation';

test('office phone is supported indoors, workers use seated rigs and spare switch ports have no fake patch cords',async({page})=>{
 await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 await expect.poll(()=>page.evaluate(async()=>{const {EngineStore}=await import('/src/world.ts');return EngineStore.LastCreatedScene!.getTransformNodeByName('client-floor-upper-dns')!==null;})).toBe(true);
 const result=await page.evaluate(async()=>{const {EngineStore}=await import('/src/world.ts'),s=EngineStore.LastCreatedScene!,phone=s.getTransformNodeByName('legacy-detailed-voip')!,workers=s.transformNodes.filter(n=>/^worker-seat-pc/.test(n.name));return {phone:{x:phone.position.x,y:phone.position.y,z:phone.position.z},workers:workers.map(n=>({yaw:n.rotation.y,rig:n.getChildMeshes().some(m=>!!m.skeleton)})),fakeCords:s.meshes.filter(m=>/^patch-cable-[5-8]$/.test(m.name)).length,upper:[s.getTransformNodeByName('client-floor-upper-wifi')!.position.y,s.getTransformNodeByName('client-floor-upper-dns')!.position.y],maps:s.textures.filter(t=>t.name.startsWith('office-map-')).length};});
 expect(result.phone.x).toBeGreaterThan(20);expect(result.phone.y).toBeCloseTo(.82);expect(result.phone.z).toBeCloseTo(3.4);expect(result.workers).toHaveLength(3);expect(result.workers.every(w=>w.rig&&Math.abs(w.yaw-Math.PI/2)<.01)).toBe(true);expect(result.fakeCords).toBe(0);expect(result.upper).toEqual([3.6,7.2]);expect(result.maps).toBeGreaterThan(8);
});

test('second-floor Wi-Fi call requires the lift, fresh radio evidence and a signed repair',async({page})=>{
 test.setTimeout(240000);page.setDefaultTimeout(15000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('netcity-quality','low'));await page.goto('/');await expect(page.locator('.connection-status')).toContainText('В сети');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 await tabletApp(page,'Диагностика');await page.locator('.lab-catalog article').filter({hasText:'2 этаж: помехи беспроводной сети'}).getByRole('button',{name:'Получить инженерный звонок',exact:true}).click();
 const act=async(name:string)=>{const button=page.getByRole('button',{name,exact:true});await expect(button).toBeEnabled();await button.click();await expect(page.getByText('Ожидание подтверждения…',{exact:false})).toHaveCount(0);};
 await act('Ответить и принять');await act('Что изменилось?');await expect(page.locator('.case-feedback')).toContainText('этаже 2');await page.keyboard.press('Escape');
 const move=async(axis:'x'|'z',goal:number)=>{await page.locator('canvas').click({position:{x:450,y:350}});await walk(page,axis,goal,.3);};
 await move('z',0);await move('x',-6);await face(page,-8,0);await page.keyboard.press('KeyE');await expect(page.locator('.action-message')).toContainText('открыта');await move('x',-21.8);await move('z',1.8);await move('x',-24);
 await tabletApp(page,'Офис / этажи');await page.getByRole('button',{name:/Этаж 2 · Рабочие кабинеты/}).click();await expect(page.locator('.floor-panel')).toContainText('Текущий этаж: 2');await expect(page.locator('.floor-panel')).not.toContainText('Лифт едет');await page.keyboard.press('Escape');
 await move('x',-21.8);await move('x',-13.3);await move('z',-1.5);await tabletApp(page,'Диагностика');await act('Что изменилось?');await act('Кого затронуло?');await page.keyboard.press('Escape');await move('z',-3);await tabletApp(page,'Диагностика');
 await act('Радиоэфир / каналы · обязательно');await act('Ping / потери · обязательно');const channel=await page.locator('.lab-readings tr').filter({hasText:/Занятость канала/}).filter({hasText:'8%'}).locator('th').innerText();
 await page.getByLabel('Диагностическая гипотеза').selectOption('radio');await act('Подтвердить причину по измерениям');await act('Канал '+channel.match(/\d+/)![0]);await act('Радиоэфир / каналы · обязательно');await act('Ping / потери · обязательно');await act('Подтвердить контрольные измерения');await act('Сдать акт клиенту');await expect(page.locator('.diagnostic-desk')).toContainText('Акт подписан');
 const t=ENGINEERING_CASES.find(t=>t.id==='upper-wifi')!;await expect(page.locator('.profile-summary')).toContainText(t.payment+' NET');await page.reload();await expect(page.locator('.connection-status')).toContainText('В сети');await tabletApp(page,'Диагностика');await expect(page.locator('.diagnostic-desk')).toContainText('Акт подписан');expect(errors).toEqual([]);
});
