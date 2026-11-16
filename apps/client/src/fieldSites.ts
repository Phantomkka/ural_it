import {FIELD_SITES} from '../../../packages/shared/src/fieldSites';
import {MeshBuilder,TransformNode,Mesh,type Scene,type Vector3} from './babylon';import {sign,type Palette} from './visuals';
import {AssetLibrary,CHARACTER_FILES,appearanceVariant,fitModel} from './assets';
export function buildFieldSites(scene:Scene,mat:Palette){
 const clients: {root:TransformNode;fallback:TransformNode;point:{x:number;z:number};id:string;name:string;model?:ReturnType<AssetLibrary['instantiate']>}[]=[];
 for(const p of FIELD_SITES){const ground=MeshBuilder.CreateGround('field-service-yard-'+p.id,{width:11,height:10},scene);ground.position.set(p.x,.012,p.z);ground.material=mat('service-yard','#87908a');ground.isPickable=false;
  const cabinet=MeshBuilder.CreateBox('field-cabinet-'+p.id,{width:1,height:1.9,depth:1},scene);cabinet.position.set(p.x,.95,p.z);cabinet.material=mat('field-cabinet','#677a83');cabinet.metadata={caseTarget:'hardware',deviceLabel:p.name};
  const panel=MeshBuilder.CreateBox('field-panel-'+p.id,{width:.86,height:1.65,depth:.04},scene);panel.position.set(p.x,.95,p.z-.52);panel.material=mat('field-panel','#253e49');panel.isPickable=false;
  for(let i=0;i<4;i++){const vent=MeshBuilder.CreateBox('field-vent',{width:.65,height:.04,depth:.05},scene);vent.position.set(p.x,.5+i*.15,p.z-.55);vent.material=mat('field-vent','#849a9f');vent.isPickable=false;}
  const label=sign(scene,'field-label-'+p.id,p.name,3,.32,24);label.mesh.position.set(p.x,2.25,p.z-.55);label.mesh.isPickable=false;
  const root=new TransformNode('field-client-'+p.id,scene);root.position.set(p.client.x,0,p.client.z);root.rotation.y=Math.atan2(p.x-p.client.x,p.z-p.client.z);root.setEnabled(false);const fallback=new TransformNode('field-client-fallback-'+p.id,scene);fallback.parent=root;
  const body=MeshBuilder.CreateCylinder('field-client-body',{height:1.2,diameter:.42,tessellation:8},scene);body.parent=fallback;body.position.y=.75;body.material=mat('field-client-coat','#607f96');const head=MeshBuilder.CreateSphere('field-client-head',{diameter:.34,segments:8},scene);head.parent=fallback;head.position.y=1.6;head.material=mat('npc-skin','#cb9573');for(const mesh of [body,head])mesh.metadata={npcId:'client',npcName:p.caller};
  clients.push({root,fallback,point:p.client,id:p.id,name:p.caller});
 }
 return {hydrate(library:AssetLibrary){for(const c of clients){const model=library.instantiate(CHARACTER_FILES[appearanceVariant(c.id)],'field-client-skin-'+c.id,true);if(!model)continue;fitModel(model.root,undefined,1.8,undefined);model.root.parent=c.root;model.root.getChildMeshes().forEach(m=>{m.metadata={npcId:'client',npcName:c.name,cityDynamic:true};m.isPickable=true;});c.model=model;c.fallback.setEnabled(false);}},update(camera:Vector3,floor:number){for(const c of clients){const near=!floor&&Math.hypot(camera.x-c.point.x,camera.z-c.point.z)<(scene.metadata?.effectiveQuality==='low'?18:28);c.root.setEnabled(near);const idle=c.model?.entries.animationGroups.find(g=>g.name.endsWith('/Idle'));if(near&&!idle?.isPlaying)idle?.play(true);else if(!near&&idle?.isPlaying)idle.pause();}}};
}
