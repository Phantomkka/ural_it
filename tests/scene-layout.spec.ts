import {COMPUTERS,SERVICE_FURNITURE} from '@netcity/shared';
import {test,expect} from '@playwright/test';
test('loaded car geometry stays on the road and follows its replicated vehicle',async({page})=>{
 await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:45000});
 for(let sample=0;sample<3;sample++){
  await expect.poll(()=>page.evaluate(async()=>{const {EngineStore}=await import('/src/world.ts');const s=EngineStore.LastCreatedScene;const cars=s.transformNodes.filter((n:any)=>n.name.startsWith('traffic-car-'));return cars.filter((n:any)=>{n.computeWorldMatrix(true);n.getChildMeshes().forEach((m:any)=>m.computeWorldMatrix(true));const {min,max}=n.getHierarchyBoundingVectors(true);return max.x-min.x>1&&min.x>-3&&max.x<3&&Math.abs((min.x+max.x)/2-n.position.x)<.03&&Math.abs((min.z+max.z)/2-n.position.z)<.03&&Math.abs(min.y)<.03;}).length;})).toBe(6);
  await page.waitForTimeout(500);
 }
});
test('printer and NAS rest on cabinets; seated workers face their keyboards',async({page})=>{
 await page.goto('/');await expect(page.locator('.asset-status')).toHaveAttribute('data-state','ready',{timeout:45000});
 const result=await page.evaluate(async({computers,furniture})=>{const {EngineStore}=await import('/src/world.ts');const s=EngineStore.LastCreatedScene;
  const supported=['printer','backup','voip'].every(id=>{const a=s.getMeshByName('service-device-'+id),b=s.getMeshByName('service-support-'+id);a.computeWorldMatrix(true);b.computeWorldMatrix(true);return Math.abs(a.getBoundingInfo().boundingBox.minimumWorld.y-b.getBoundingInfo().boundingBox.maximumWorld.y)<.02;});
  const seated=computers.every((pc:any,i:number)=>{const body=s.getMeshByName('seated-worker-'+i),head=s.getMeshByName('seated-head-'+i),face=s.getMeshByName('worker-face-'+i);return Math.abs(body.position.x-(pc.x-.9))<.01&&Math.abs(body.position.z-pc.z)<.01&&face.position.x>head.position.x;});
  const fixtures=furniture.every((f:any)=>{const m=s.getMeshByName('service-support-'+f.id);m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;return Math.abs(b.minimumWorld.y)<.01&&Math.abs(b.maximumWorld.x-b.minimumWorld.x-f.width)<.01;});return {supported,seated,fixtures};},{computers:COMPUTERS,furniture:SERVICE_FURNITURE});
 expect(result).toEqual({supported:true,seated:true,fixtures:true});
});
