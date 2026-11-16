import {test,expect} from '@playwright/test';

test('perimeter stays outside every enlarged office and all lift landings have complete cabins',async({page})=>{
 await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const result=await page.evaluate(async()=>{
  const {EngineStore}=await import('/src/world.ts'),s=EngineStore.LastCreatedScene!;
  const fences=s.meshes.filter(m=>m.material?.name==='perimeter-fence-metal');
  const fenceVertices=fences.flatMap(m=>Array.from(m.getVerticesData('position')??[]).filter((_,i)=>i%3===0));
  const cabins=s.transformNodes.filter(n=>/^elevator-(hq|building-\d+)-\d+$/.test(n.name));
  return {fenceVertices:fenceVertices.length,insideFenceVertex:fenceVertices.some(x=>Math.abs(x)<30.9),cabins:cabins.length,doors:cabins.map(c=>c.getChildMeshes().filter(m=>m.name.startsWith('elevator-sliding-door-')).length),surfaces:cabins.map(c=>['elevator-cabin-wall','elevator-nonslip-floor','elevator-ceiling','lift-call-button'].every(name=>c.getChildMeshes().some(m=>m.name===name))),maps:s.textures.filter(t=>t.name.startsWith('office-map-lift-')).length};
 });
 expect(result.fenceVertices).toBeGreaterThan(100);expect(result.insideFenceVertex).toBe(false);expect(result.cabins).toBe(29);expect(result.doors.every(n=>n===2)).toBe(true);expect(result.surfaces.every(Boolean)).toBe(true);expect(result.maps).toBe(2);
});
