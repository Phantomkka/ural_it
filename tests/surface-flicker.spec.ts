import {test,expect} from '@playwright/test';

test('street/office ground layers do not overlap and glass stays independently sortable',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('netcity-quality','low'));await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const result=await page.evaluate(async()=>{const {EngineStore,Vector3}=await import('/src/babylon.ts');const s=EngineStore.LastCreatedScene!,ground=s.getMeshByName('ground')!;ground.computeWorldMatrix(true);
  const ray=s.activeCamera!.getForwardRay(2);ray.direction.set(0,-1,0);const hit=(x:number,z:number)=>{ray.origin.set(x,1,z);return ground.intersects(ray,false).hit;};
  const panes=s.meshes.filter(m=>['office-window','meeting-glass','shelter-glass'].includes(m.material?.name??''));
  const maps=s.textures.filter(t=>t.name.startsWith('office-map-')||t.name.endsWith('-text'));
  return {groundUnderStreet:hit(0,0),groundUnderOffice:hit(11,-1),garden:hit(35,15),floorTop:s.getMeshByName('building-office')!.getBoundingInfo().boundingBox.maximumWorld.y,clip:s.activeCamera!.maxZ,panes:panes.length,mergedGlass:panes.some(m=>m.getTotalVertices()>24),depthPass:panes.every(m=>m.material!.needDepthPrePass),mips:maps.every(t=>!t.noMipmap),maps:maps.length,oldWalls:[0,1,2,3,4].some(i=>s.getMeshByName('office-wall-'+i)?.isEnabled())};
 });
 expect(result.groundUnderStreet).toBe(false);expect(result.groundUnderOffice).toBe(false);expect(result.garden).toBe(true);expect(result.floorTop).toBeCloseTo(.02);expect(result.clip).toBeLessThanOrEqual(200);expect(result.panes).toBeGreaterThan(100);expect(result.mergedGlass).toBe(false);expect(result.depthPass).toBe(true);expect(result.maps).toBeGreaterThan(10);expect(result.mips).toBe(true);expect(result.oldWalls).toBe(false);
});

test('rotating the render camera cannot reveal grass stripes through the HQ floor',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('netcity-quality','low'));await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const pixels=await page.evaluate(async()=>{const {EngineStore,FreeCamera,Vector3}=await import('/src/babylon.ts');const s=EngineStore.LastCreatedScene!,original=s.activeCamera!,probe=new FreeCamera('surface-sweep-probe',new Vector3(11,1.7,-1),s);probe.minZ=original.minZ;probe.maxZ=original.maxZ;probe.fov=original.fov;s.activeCamera=probe;const gl=s.getEngine().getRenderingCanvas()!.getContext('webgl2')!,result:number[][]=[];
  try{for(let i=0;i<16;i++){probe.rotation.set(1.35,i*Math.PI/8,0);await new Promise<void>(resolve=>s.onAfterRenderObservable.addOnce(()=>{const pixel=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);result.push([...pixel]);resolve();}));}}finally{s.activeCamera=original;probe.dispose();}return result;
 });
 expect(pixels).toHaveLength(16);for(const [r,g,b,a]of pixels){expect(a).toBe(255);expect(b).toBeGreaterThanOrEqual(g-2);expect(b).toBeGreaterThan(r);}
});
