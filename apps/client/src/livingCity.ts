import {TransformNode,MeshBuilder,Vector3,type Scene,type Mesh} from './babylon';
import {CITY_PEDESTRIANS,pedestrianPosition,type CityCar} from '@netcity/shared';
import {buildOfficeWorkers} from './officeWorkers';
import {sign,type Palette} from './visuals';
import {type AssetLibrary,fitModel,CHARACTER_FILES,appearanceVariant} from './assets';
export function buildLivingCity(scene:Scene,mat:Palette){
  const workers=buildOfficeWorkers(scene,mat);
  const cars=new Map<string,{root:TransformNode;model?:boolean}>(),people:TransformNode[]=[];
  const lamp=mat('traffic-green','#63e39b',true),red=mat('traffic-red','#ef6b69',true),amber=mat('traffic-amber','#efce72',true),off=mat('traffic-off','#334047');
  const npcModels=new Map<number,NonNullable<ReturnType<AssetLibrary["instantiate"]>>>();
  const lights:Mesh[][]=[];let clock=0,clockAt=0;
  for(const x of [-5.4,5.4]){const pole=MeshBuilder.CreateCylinder('traffic-pole',{height:3,diameter:0.12,tessellation:6},scene);pole.position.set(x,1.5,1.8);pole.material=mat('traffic-metal','#34434c');
    const group:Mesh[]=[];for(let i=0;i<3;i++){const m=MeshBuilder.CreateSphere('traffic-light-'+i,{diameter:0.22,segments:6},scene);m.position.set(x,2.65-i*0.3,1.8);m.material=off;m.isPickable=false;group.push(m);}lights.push(group);}
  for(const [i,n]of CITY_PEDESTRIANS.entries()){
    const root=new TransformNode('city-npc-'+n.id,scene),body=MeshBuilder.CreateCylinder('npc-walking-body',{height:0.85,diameter:0.42,tessellation:6},scene),head=MeshBuilder.CreateSphere('npc-walking-head',{diameter:0.36,segments:6},scene);
    body.parent=root;body.position.y=1;body.material=mat('walker-'+i,['#7a9dbb','#c0997d','#75866c','#a78cae'][i]);head.parent=root;head.position.y=1.65;head.material=mat('npc-skin','#cb9573');
    for(const dx of [-0.13,0.13]){const leg=MeshBuilder.CreateBox('npc-walking-leg',{width:0.15,height:0.65,depth:0.2},scene);leg.parent=root;leg.position.set(dx,0.325,0);leg.material=mat('npc-trousers','#203849');leg.isPickable=false;}
    body.metadata=head.metadata={npcId:n.id,cityDynamic:true};body.isPickable=head.isPickable=true;root.getChildMeshes().forEach(m=>m.metadata={...m.metadata,cityDynamic:true});people.push(root);
    const label=sign(scene,'walker-label-'+i,n.name,2.5,0.3);label.mesh.parent=root;label.mesh.position.y=2.05;label.mesh.billboardMode=7;label.mesh.isPickable=false;
  }
  const ground=MeshBuilder.CreateGround('terrain-continuation',{width:600,height:600},scene);ground.position.y=-0.09;ground.material=mat('grass','#6f9278');ground.isPickable=false;
  for(const z of [-47,47]){
    // Keep the ten-metre road opening empty instead of hiding traffic in a solid box.
    for(const x of [-5.6,5.6]){const pier=MeshBuilder.CreateBox('road-tunnel-pier',{width:1.2,height:5.2,depth:4},scene);pier.position.set(x,2.6,z);pier.material=mat('tunnel','#65767c');pier.isPickable=false;}
    const header=MeshBuilder.CreateBox('road-tunnel-header',{width:12.4,height:1.2,depth:4},scene);header.position.set(0,5.8,z);header.material=mat('tunnel','#65767c');header.isPickable=false;
    const tag=sign(scene,'district-edge','НОВОЛИНСК · ОБЪЕЗД',8,0.8);tag.mesh.position.set(0,5.8,z-Math.sign(z)*2.03);tag.mesh.rotation.y=z<0?Math.PI:0;tag.mesh.isPickable=false;
  }
  for(const x of [-37,37])for(const z of [-52,-26,0,26,52]){const height=12+(z+52)%9,block=MeshBuilder.CreateBox('distant-block',{width:10,height,depth:10},scene);block.position.set(x,height/2,z);block.material=mat('distant-building','#8b9b9d');block.isPickable=false;}
  return {update(vehicles:Map<string,CityCar>|undefined,phase:string,now:number,camera:Vector3,dt:number,library:AssetLibrary){
    if(now!==clock){clock=now;clockAt=performance.now();}now=clock+Math.min(performance.now()-clockAt,1500);
    for(const group of lights)group.forEach((m,i)=>m.material=phase==='DRIVE'&&i===2?lamp:phase==='AMBER'&&i===1?amber:phase==='CROSS'&&i===0?red:off);
    people.forEach((root,i)=>{const p=pedestrianPosition(i,now);root.position.set(p.x,0,p.z);root.rotation.y=p.yaw;const distance=Vector3.Distance(root.position,camera),far=distance>30;root.setEnabled(!far);let model=npcModels.get(i);if(!model&&library.complete){model=library.instantiate(CHARACTER_FILES[appearanceVariant(CITY_PEDESTRIANS[i].id)],'walker-skin-'+i,true);if(model){for(const mesh of root.getChildMeshes())if(!mesh.name.startsWith('walker-label-'))mesh.setEnabled(false);fitModel(model.root,undefined,1.8,undefined);model.root.parent=root;model.root.getChildMeshes().forEach(m=>{m.metadata={npcId:CITY_PEDESTRIANS[i].id,cityDynamic:true};m.isPickable=true;});npcModels.set(i,model);}}if(model){for(const g of model.entries.animationGroups){const desired=!far&&g.name.endsWith(p.walking?'/Walk':'/Idle');if(desired&&!g.isPlaying)g.play(true);else if(!desired&&g.isPlaying)g.pause();}}else if(!far)root.getChildMeshes().filter(m=>m.name==='npc-walking-leg').forEach((leg,j)=>leg.rotation.x=p.walking?Math.sin(now/180+j*Math.PI)*0.3:0);const label=scene.getMeshByName('walker-label-'+i);if(label){label.setEnabled(distance<9);label.scaling.setAll(Math.min(1,distance/8));}});
    workers.update(library,camera);
    if(!vehicles)return;
    for(const [id,c]of vehicles){let item=cars.get(id);if(!item){const root=new TransformNode('traffic-car-'+id,scene);item={root};cars.set(id,item);}
      if(!item.model&&library.has('car_sedan.glb')){const model=library.instantiate(id.endsWith('1')?'car_hatchback.glb':'car_sedan.glb','moving-'+id);if(model){fitModel(model.root,1.7,1.2,3.5);model.root.parent=item.root;model.root.getChildMeshes().forEach(m=>{m.metadata={heavy:true,cityDynamic:true};m.isPickable=true;});item.model=true;}}
      const target=new Vector3(c.x,0,c.z),snap=Vector3.Distance(item.root.position,target)>10;Vector3.LerpToRef(item.root.position,target,snap?1:1-Math.exp(-12*dt),item.root.position);item.root.rotation.y=c.direction>0?0:Math.PI;
    }
  }};
}
