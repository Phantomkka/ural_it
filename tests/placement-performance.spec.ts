import {test,expect} from '@playwright/test';
import {tabletApp} from './navigation';
import {assertEquipmentSupport} from './placement-assertions';
test('equipment rests on real furniture and unused upper offices allocate no models',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('netcity-quality','low'));await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 await assertEquipmentSupport(page);
 const counts=await page.evaluate(async()=>{const {EngineStore}=await import('/src/world.ts');const s=EngineStore.LastCreatedScene!;return {meshes:s.meshes.length,upper:s.transformNodes.filter(n=>/^office-furniture-.*-[12]$/.test(n.name)).flatMap(n=>n.getChildMeshes()).length,obsolete:s.transformNodes.filter(n=>n.name.startsWith('station-legacy-details-')).length};});
 expect(counts.meshes).toBeLessThan(3000);expect(counts.upper).toBe(0);expect(counts.obsolete).toBe(0);
});
test('render budget spares CPU behind tablet and reports the actual graphics driver',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('netcity-quality','low'));await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const state=()=>page.evaluate(async()=>{const {EngineStore}=await import('/src/world.ts');const s=EngineStore.LastCreatedScene!,e=s.getEngine();return {cap:e.maxFPS,renderer:s.metadata.renderer,preference:e.getRenderingCanvas()!.getContext('webgl2')?.getContextAttributes()?.powerPreference};});
 await expect.poll(async()=>(await state()).cap).toBe(30);expect((await state()).renderer).toBeTruthy();expect((await state()).preference).toBe('high-performance');
 await tabletApp(page,'Настройки');await expect(page.getByLabel('Рендерер в настройках')).toContainText('WebGL');await expect.poll(async()=>(await state()).cap).toBe(15);await page.keyboard.press('Escape');await expect.poll(async()=>(await state()).cap).toBe(30);
});
test('software WebGL is identified without pretending it is a hardware GPU',async({playwright})=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROMIUM_PATH||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':'/usr/bin/chromium'),headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{const page=await browser.newPage();await page.addInitScript(()=>localStorage.setItem('netcity-quality','high'));await page.goto('http://127.0.0.1:5173');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});await tabletApp(page,'Настройки');await expect(page.getByRole('status').filter({hasText:'Обнаружен программный рендерер'})).toBeVisible();expect(await page.evaluate(async()=>{const {EngineStore}=await import('/src/world.ts');return EngineStore.LastCreatedScene!.metadata.effectiveQuality;})).toBe('low');}finally{await browser.close();}
});
