import {TransformNode,Quaternion,type Scene,type Vector3} from './babylon';
import {COMPUTERS,ENGINEERING_CASES,CASE_CATALOG,FLOOR_HEIGHT} from '@netcity/shared';
import {officeWorkerFallback} from './officeWorkerFallback';
import {type Palette} from './visuals';
import {fitModel,CHARACTER_FILES,type AssetLibrary} from './assets';
/** Authored static seated pose on the existing local rig; no extra texture/model downloads. */
export function buildOfficeWorkers(scene:Scene,mat:Palette){
 let ready=false;const roots:TransformNode[]=[],activity=new Map<TransformNode,(active:boolean)=>void>();
 return {update(library:AssetLibrary,camera:Vector3){
  if(!ready&&library.complete){ready=true;
   for(const p of COMPUTERS){
    const model=library.instantiate(CHARACTER_FILES[p.id==='pc03'?1:p.id==='pc02'?0:2],'office-worker-'+p.id,true);if(!model){const fallback=officeWorkerFallback(scene,mat,'worker-seat-'+p.id,true);fallback.position.set(p.x-.9,0,p.z);fallback.rotation.y=Math.PI/2;fallback.getChildMeshes().forEach(m=>{m.metadata={npcId:p.id==='pc01'?'alex':p.id==='pc03'?'olga':'igor',workstation:p.id};m.isPickable=true;});roots.push(fallback);continue;}
    for(const a of model.entries.animationGroups)a.stop();fitModel(model.root,undefined,1.8,undefined);
    const nodes=model.root.getDescendants().filter((n):n is TransformNode=>n instanceof TransformNode);
    const node=(name:string)=>nodes.find(n=>n.name.endsWith('/'+name));
    const rotate=(name:string,x:number,y=0,z=0)=>{const n=node(name);if(n)n.rotationQuaternion=Quaternion.FromEulerAngles(x,y,z);};
    rotate('Body',0);rotate('Hips',0);rotate('Abdomen',-.06);rotate('Torso',0);rotate('Neck',.08);
    for(const side of ['L','R']){rotate('UpperLeg.'+side,Math.PI/2);rotate('LowerLeg.'+side,Math.PI/2);rotate('Shoulder.'+side,0);rotate('UpperArm.'+side,2.2);rotate('LowerArm.'+side,Math.PI/2-2.2);rotate('Fist.'+side,0);const foot=node('Foot.'+side);if(foot){foot.position.set(side==='L'?.26:-.26,.09,.55);foot.rotationQuaternion=Quaternion.Identity();}}
    const anchor=new TransformNode('worker-seat-'+p.id,scene);model.root.parent=anchor;anchor.position.set(p.x-.9,-.12,p.z);anchor.rotation.y=Math.PI/2;
    model.root.getChildMeshes().forEach(m=>{m.metadata={npcId:p.id==='pc01'?'alex':p.id==='pc03'?'olga':'igor',workstation:p.id,cityDynamic:true};m.isPickable=true;});roots.push(anchor);
   }
   // A visible contact on each new service floor, with a normal idle animation.
   for(const t of [...ENGINEERING_CASES.filter(t=>!!t.floor),CASE_CATALOG.find(t=>t.id==='voip-vlan')!]){
    const model=library.instantiate(CHARACTER_FILES[(t.floor??1)%3],'upper-client-'+t.id,true);if(!model){const fallback=officeWorkerFallback(scene,mat,'client-floor-'+t.id,false);fallback.position.set(t.client.x,(t.floor??0)*FLOOR_HEIGHT,t.client.z);fallback.getChildMeshes().forEach(m=>{m.metadata={caseTarget:'client'};m.isPickable=true;});roots.push(fallback);continue;}fitModel(model.root,undefined,1.8,undefined);const anchor=new TransformNode('client-floor-'+t.id,scene);model.root.parent=anchor;anchor.position.set(t.client.x,(t.floor??0)*FLOOR_HEIGHT,t.client.z);model.root.getChildMeshes().forEach(m=>{m.metadata={caseTarget:'client',cityDynamic:true};m.isPickable=true;});activity.set(anchor,active=>{for(const a of model.entries.animationGroups)if(a.name.endsWith('/Idle')){if(active&&!a.isPlaying)a.play(true);else if(!active&&a.isPlaying)a.pause();}});roots.push(anchor);
   }
  }
  for(const root of roots){const visible=Math.abs(camera.y-root.position.y)<2.7&&Math.hypot(root.position.x-camera.x,root.position.z-camera.z)<26;root.setEnabled(visible);activity.get(root)?.(visible);}
 }};
}
