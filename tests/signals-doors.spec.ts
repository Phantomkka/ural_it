import {test,expect} from '@playwright/test';
import {CITY_DOORS,HQ_ENTRY_DOOR,doorLeaves,doorClosed,DOOR_WIDTH,trafficLamp,TRAFFIC_SIGNALS} from '@netcity/shared';

test('one oriented signal per direction switches only its correct lens, including fallback graphics',async({page})=>{
 await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const result=await page.evaluate(async()=>{const {EngineStore}=await import('/src/babylon.ts'),{buildTrafficSignals}=await import('/src/trafficSignals.ts'),{createPalette}=await import('/src/visuals.ts');const s=EngineStore.LastCreatedScene!;
  const original=s.transformNodes.filter(n=>n.name.startsWith('traffic-signal-')),old=s.meshes.filter(m=>m.name.startsWith('traffic-light-'));
  const directions=original.map(root=>({x:root.position.x,z:root.position.z,yaw:root.rotation.y}));
  // Separate probe in the same renderer exercises phase transitions without changing game authority/time.
  const signals=buildTrafficSignals(s,createPalette(s)),roots=s.transformNodes.filter(n=>n.name.startsWith('traffic-signal-')&&!original.includes(n));roots.forEach(n=>n.position.y=100);
  try{const phases=['DRIVE','AMBER','CROSS','unknown'].map(phase=>{signals.update(phase);return roots.map(n=>n.getChildMeshes().filter(m=>m.metadata?.trafficLens!==undefined).map(m=>m.material!.name));});return{original:original.length,old:old.length,directions,phases};}finally{roots.forEach(n=>n.dispose());}
 });
 expect(result.original).toBe(2);expect(result.old).toBe(0);expect(result.directions).toEqual(TRAFFIC_SIGNALS.map(s=>({x:s.x,z:s.z,yaw:s.yaw})));
 for(const [i,phase]of ['DRIVE','AMBER','CROSS','unknown'].entries())for(const lenses of result.phases[i]){expect(lenses.filter(v=>v!=='traffic-off')).toHaveLength(1);expect(lenses[trafficLamp(phase)]).toBe(['traffic-red','traffic-amber','traffic-green'][trafficLamp(phase)]);}
});

test('paired leaves match authoritative bounds when closed and open on both sides and in HQ',async({page})=>{
 await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const states=await page.evaluate(async defs=>{const {EngineStore}=await import('/src/babylon.ts'),{buildDoor}=await import('/src/doors.ts'),{createPalette}=await import('/src/visuals.ts');const s=EngineStore.LastCreatedScene!;
  return defs.map(d=>{const door=buildDoor(s,createPalette(s),{...d,id:'probe-'+d.id});door.root.position.y=100;const bounds=()=>door.root.getChildMeshes().filter(m=>m.name.startsWith('door-leaf-')).map(m=>{m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;return{x:(b.minimumWorld.x+b.maximumWorld.x)/2,z:(b.minimumWorld.z+b.maximumWorld.z)/2,width:b.maximumWorld.x-b.minimumWorld.x,depth:b.maximumWorld.z-b.minimumWorld.z};});
   try{for(let i=0;i<90;i++)door.update(false,1/60);const closed=bounds();for(let i=0;i<90;i++)door.update(true,1/60);return{closed,open:bounds()};}finally{door.root.dispose();}
  });},[...CITY_DOORS,HQ_ENTRY_DOOR]);
 for(const [i,d]of [...CITY_DOORS,HQ_ENTRY_DOOR].entries()){const state=states[i],c=doorClosed(d),open=doorLeaves(d);expect(Math.min(...state.closed.map(b=>b.z-b.depth/2))).toBeCloseTo(c.z-DOOR_WIDTH/2,3);expect(Math.max(...state.closed.map(b=>b.z+b.depth/2))).toBeCloseTo(c.z+DOOR_WIDTH/2,3);for(const b of state.closed){expect(b.x).toBeCloseTo(d.x,3);expect(b.width).toBeCloseTo(c.width,3);}for(let j=0;j<2;j++)for(const key of ['x','z','width','depth']as const)expect(state.open[j][key]).toBeCloseTo(open[j][key],3);}
});
