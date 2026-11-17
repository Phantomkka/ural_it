import {test,expect} from '@playwright/test';

test('signs fit their faces, contacts use one rig, and road portals leave traffic clearance',async({page})=>{
 await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const result=await page.evaluate(async()=>{const {EngineStore}=await import('/src/babylon.ts');const {doorResponse}=await import('/src/motion.ts');const s=EngineStore.LastCreatedScene!;
  const close=(fps:number)=>{let value=1;for(let i=0;i<fps;i++)value+=(0-value)*doorResponse(1/fps);return value;};
  const signs=s.meshes.filter(m=>m.metadata?.signText),badSigns=signs.filter(m=>m.metadata.signTextWidth>m.metadata.signTextureWidth-24+.01);
  const contacts=['client','dispatcher','supplier'].map(id=>({rig:!!s.getTransformNodeByName('contact-person-'+id)?.getChildMeshes().some(m=>!!m.skeleton),fallback:s.getTransformNodeByName('contact-fallback-'+id)?.isEnabled()}));
  const portal=s.meshes.filter(m=>m.name.startsWith('road-tunnel-'));portal.forEach(m=>m.computeWorldMatrix(true));
  const blocked=portal.some(m=>{const b=m.getBoundingInfo().boundingBox;return b.minimumWorld.x<4.9&&b.maximumWorld.x>-4.9&&b.minimumWorld.y<4.5;});
  const obsolete=s.meshes.filter(m=>['detail-batch-cornice','detail-batch-window-glass'].includes(m.name)&&m.isEnabled());
  const optics=s.transformNodes.filter(n=>n.name==='district-detailed-camera'||n.name==='district-detailed-wifi');
  return{door30:close(30),door60:close(60),skins:s.materials.filter(m=>m.name==='Skin').every(m=>(m as any).albedoColor.g>.05),texturesReady:s.textures.every(t=>t.isReady()),signs:signs.length,badSigns:badSigns.map(m=>m.name),contacts,portal:portal.length,blocked,obsolete:obsolete.length,optics:optics.length,missing:s.meshes.filter(m=>m.isEnabled()&&m.isVisible&&m.getTotalVertices()>0&&!m.material).map(m=>m.name)};
 });
 expect(result.door30).toBeCloseTo(result.door60,10);expect(result.door30).toBeLessThan(.001);expect(result.skins).toBe(true);expect(result.texturesReady).toBe(true);expect(result.signs).toBeGreaterThan(50);expect(result.badSigns).toEqual([]);expect(result.contacts).toEqual(Array(3).fill({rig:true,fallback:false}));expect(result.portal).toBe(6);expect(result.blocked).toBe(false);expect(result.obsolete).toBe(0);expect(result.optics).toBe(3);expect(result.missing).toEqual([]);
});

test('rendered glass transmits the background instead of a black depth-prepass pane',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('netcity-quality','low'));await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const colors=await page.evaluate(async()=>{const {EngineStore,FreeCamera,Vector3,MeshBuilder,StandardMaterial,Color3}=await import('/src/babylon.ts');const s=EngineStore.LastCreatedScene!,original=s.activeCamera!,glass=s.meshes.find(m=>m.material?.name==='office-window')!.material!;
  const probe=new FreeCamera('glass-quality-probe',new Vector3(0,150,-5),s);probe.minZ=.1;probe.maxZ=20;s.activeCamera=probe;
  const back=MeshBuilder.CreatePlane('glass-test-back',{size:4},s),color=new StandardMaterial('glass-test-back-color',s);back.position.set(0,150,2);color.disableLighting=true;color.emissiveColor=new Color3(.9,.6,.25);back.material=color;
  const pane=MeshBuilder.CreateBox('glass-test-pane',{width:4,height:4,depth:.08},s);pane.position.set(0,150,0);pane.material=glass;
  const gl=s.getEngine().getRenderingCanvas()!.getContext('webgl2')!;
  const pixel=()=>new Promise<number[]>(resolve=>s.onAfterRenderObservable.addOnce(()=>{const value=new Uint8Array(4);gl.readPixels(gl.drawingBufferWidth/2,gl.drawingBufferHeight/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,value);resolve([...value]);}));
  try{await pixel();const through=await pixel();pane.setEnabled(false);const clear=await pixel();return{through,clear};}finally{s.activeCamera=original;probe.dispose();pane.dispose();back.dispose();color.dispose();}
 });
 expect(colors.through[0]).toBeGreaterThan(90);expect(colors.through[1]).toBeGreaterThan(60);expect(colors.through[3]).toBe(255);expect(colors.clear[0]).toBeGreaterThan(120);
});
