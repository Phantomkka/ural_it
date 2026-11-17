import {expect,type Page} from '@playwright/test';
export async function assertEquipmentSupport(page:Page){
 const errors=await page.evaluate(async()=>{const {EngineStore}=await import('/src/world.ts');const s=EngineStore.LastCreatedScene!,errors:string[]=[];
  for(const n of s.transformNodes){let expected:number|undefined;
   if(/-keyboard-placement$|-mouse-placement$/.test(n.name))expected=n.parent!.getAbsolutePosition().y;
   if(n.name==='office-underdesk-pc')expected=n.parent!.getAbsolutePosition().y;
   if(n.name==='office-phone')expected=n.parent!.getAbsolutePosition().y+.82;
   if(n.name==='office-copy-center')expected=n.parent!.getAbsolutePosition().y+1.5;
   if(n.name==='legacy-detailed-printer')expected=.82;
   if(n.name==='legacy-detailed-voip')expected=.82;
   if(expected!==undefined){n.computeWorldMatrix(true);n.getChildMeshes().forEach(m=>m.computeWorldMatrix(true));const min=n.getHierarchyBoundingVectors(true).min.y;if(Math.abs(min-expected)>.003)errors.push(n.name+': '+min+' expected '+expected);}
  }
  const phones=s.transformNodes.filter(n=>n.name==='office-phone'||n.name==='legacy-detailed-voip');for(let i=0;i<phones.length;i++)for(let j=i+1;j<phones.length;j++)if(phones[i].getAbsolutePosition().subtract(phones[j].getAbsolutePosition()).length()<.08)errors.push('overlapping office phones');
  const support=s.getMeshByName('service-support-network')!,computer=s.getTransformNodeByName('service-client-pc04')!;support.computeWorldMatrix(true);const top=support.getBoundingInfo().boundingBox.maximumWorld.y;if(Math.abs(computer.position.y-top)>.003)errors.push('PC04 base is not on cabinet');
  const bounds=support.getBoundingInfo().boundingBox;for(const n of computer.getChildren().filter(n=>/-keyboard-placement$|-mouse-placement$/.test(n.name))){n.computeWorldMatrix(true);const {min,max}=n.getHierarchyBoundingVectors(true);if(min.x<bounds.minimumWorld.x-.005||max.x>bounds.maximumWorld.x+.005||min.z<bounds.minimumWorld.z-.005||max.z>bounds.maximumWorld.z+.005)errors.push(n.name+' overhangs cabinet');}
  return errors;
 });expect(errors).toEqual([]);
}
