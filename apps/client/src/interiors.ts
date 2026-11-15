import {AssetLibrary,CHARACTER_FILES,appearanceVariant,fitModel} from './assets';
import {MeshBuilder,TransformNode,Vector3,type Scene,type Mesh} from './babylon';
import {CASE_CATALOG,CASE_KIND_NAMES,CITY_BUILDINGS,CITY_DOORS,buildingWalls,buildingClient,missionStation,doorLeaf} from '@netcity/shared';
import {batchStatic,sign,type Palette} from './visuals';
export function buildInteriors(scene:Scene,mat:Palette){
 const tenants:{fallback:TransformNode;point:{x:number;z:number};id:string;model?:ReturnType<AssetLibrary["instantiate"]>}[]=[];
 const fixed:Mesh[]=[],doors=new Map<string,Mesh>(),dynamic:Mesh[]=[];
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,key:string,pick=false)=>{const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=mat(key,color);m.isPickable=pick;if(!pick)fixed.push(m);return m;};
 for(const b of CITY_BUILDINGS.filter(b=>b.id!=='hq')){
  for(const [i,w]of buildingWalls(b).entries())box(`interior-wall-${b.id}-${i}`,w.x,1.8,w.z,w.width,3.6,w.depth,b.theme,'room-wall-'+b.theme);
  box('room-floor-'+b.id,b.x,.005,b.z,11.7,.03,11.7,'#71828b','room-floor');
  box('room-ceiling-'+b.id,b.x,3.54,b.z,11.7,.08,11.7,'#d6d9d0','room-ceiling');
  box('entrance-lintel-'+b.id,Math.sign(b.x)*8,3,b.z,.3,.6,2.4,b.theme,'room-wall-'+b.theme);
  for(const dz of [-2.8,2.8])box('room-light',b.x,3.48,b.z+dz,5,.025,.1,'#b7eadf','room-lamp');
  const contact=buildingClient(b),body=box('tenant-'+b.id,contact.x,1.03,contact.z,.42,.85,.34,'#648ca2','tenant-shirt',true);
  const fallback=new TransformNode('tenant-fallback-'+b.id,scene);body.parent=fallback;
  body.metadata={npcId:'tenant:'+b.id};
  const head=MeshBuilder.CreateSphere('tenant-head-'+b.id,{diameter:.36,segments:6},scene);head.position.set(contact.x,1.64,contact.z);head.material=mat('npc-skin','#cb9573');head.metadata=body.metadata;head.parent=fallback;
  tenants.push({fallback,point:contact,id:b.id});
  for(const dx of [-.13,.13]){const leg=box('tenant-leg',contact.x+dx,.325,contact.z,.16,.65,.18,'#203849','npc-trousers');fixed.pop();leg.parent=fallback;}
  const entrance=sign(scene,'entrance-label-'+b.id,b.name,4,.45,25);entrance.mesh.position.set(Math.sign(b.x)*7.8,2.95,b.z);entrance.mesh.rotation.y=Math.sign(b.x)*Math.PI/2;entrance.mesh.isPickable=false;
  const board=sign(scene,'tenant-label-'+b.id,'КЛИЕНТ · '+b.name,2.5,.22,21);board.mesh.position.set(contact.x,2.05,contact.z);board.mesh.isPickable=false;board.mesh.billboardMode=7;
  for(let slot=0;slot<4;slot++){
   const p=missionStation(b,slot);
   box(`station-support-${b.id}-${slot}`,p.x,.4,p.z,.8,.8,.7,'#536775','station-support');
   const job=CASE_CATALOG.find(t=>t.buildingId===b.id&&t.station===slot)!,printer=job.kind==='printer',tower=['power','server','ups','storage'].includes(job.kind),height=printer?.32:tower?.65:.44,front=slot<2?1:-1,monitor=['network','dns','dhcp','voip'].includes(job.kind);
   const machine=box(`station-device-${b.id}-${slot}`,p.x,monitor?1.25:.8+height/2,p.z,printer?.7:.55,monitor?.34:height,monitor?.08:.48,'#bccbd0','station-device',true);machine.metadata={caseTarget:'hardware',deviceLabel:b.name+' · узел '+(slot+1),buildingId:b.id,station:slot};
   if(printer){box('district-printer-lid',p.x,1.14,p.z,.71,.035,.5,'#213a4a','station-buttons');box('district-printer-paper',p.x,.89,p.z+front*.32,.3,.015,.23,'#e0e4df','room-ceiling');}
   if(tower)for(const offset of [-.12,0,.12])box('district-server-vent',p.x+offset,1.05,p.z+front*.25,.04,.24,.02,'#213a4a','station-buttons');
   box('station-display',p.x,monitor?1.25:1.06,p.z+front*(monitor?.051:.248),monitor?.48:.3,monitor?.26:.16,.02,'#4bada0','station-screen');
   if(monitor){box('station-monitor-stand',p.x,.94,p.z,.08,.28,.08,'#213a4a','station-buttons');box('station-keyboard',p.x,.825,p.z+front*.23,.4,.035,.2,'#213a4a','station-buttons');}
   box('station-panel',p.x,.4,p.z+front*.357,.66,.65,.02,'#71838a','station-panel');box('station-handle',p.x+.2,.55,p.z+front*.38,.035,.15,.025,'#213a4a','station-buttons');
   if(!printer&&!monitor)box('station-controls',p.x,.8+height+.012,p.z,.18,.015,.15,'#213a4a','station-buttons');
   const tag=sign(scene,`station-tag-${b.id}-${slot}`,`${slot+1} · ${CASE_KIND_NAMES[job.kind]}`,1.5,.18,21);tag.mesh.position.set(p.x,1.72,p.z);tag.mesh.billboardMode=7;tag.mesh.isPickable=false;
  }
  box('room-counter',b.x-Math.sign(b.x)*3,.4,b.z+3.5,1.2,.8,1,'#927b64','room-wood');
  box('room-cupboard',b.x+Math.sign(b.x)*4.6,.8,b.z, .65,1.6,1.4,'#536775','station-support');
 }
 for(const d of CITY_DOORS.filter(d=>d.id!=='hq-server')){
  const p=doorLeaf(d),m=box('district-door-'+d.id,p.x,1.3,p.z,p.width,2.6,p.depth,'#315766','district-door',true);m.setPivotPoint(new Vector3(-d.side*.8,0,0));m.metadata={cityDoor:d.id,cityDynamic:true};doors.set(d.id,m);
  const handle=MeshBuilder.CreateBox('district-handle',{width:.05,height:.22,depth:.06},scene);handle.parent=m;handle.position.set(d.side*.5,0,-.09);handle.material=mat('handle','#b8c6be');handle.isPickable=false;handle.metadata={cityDynamic:true};dynamic.push(handle);
 }
 batchStatic(scene,fixed);
 return {hydrate(library:AssetLibrary){
   for(const t of tenants){const file=CHARACTER_FILES[appearanceVariant(t.id)],model=library.instantiate(file,'tenant-skin-'+t.id,true);if(!model)continue;fitModel(model.root,undefined,1.8,undefined);model.root.position.x+=t.point.x;model.root.position.z+=t.point.z;model.root.metadata={asset:file,tenant:t.id};for(const m of model.root.getChildMeshes()){m.metadata={npcId:'tenant:'+t.id,cityDynamic:true};m.isPickable=true;}for(const g of model.entries.animationGroups)g.stop();model.entries.animationGroups.find(g=>g.name.endsWith('/Idle'))?.start(true);t.model=model;t.fallback.setEnabled(false);}
   const place=(file:string,name:string,x:number,z:number,w:number,h:number,d:number,elevation=0,yaw=0)=>{const model=library.instantiate(file,name);if(!model)return false;fitModel(model.root,w,h,d);const pivot=new TransformNode(name+'-placement',scene);model.root.parent=pivot;pivot.position.set(x,elevation,z);pivot.rotation.y=yaw;model.root.getChildMeshes().forEach(m=>{m.isPickable=false;m.computeWorldMatrix(true);m.freezeWorldMatrix();});return true;};
   for(const b of CITY_BUILDINGS.filter(b=>b.id!=='hq')){const x=b.x-Math.sign(b.x)*3;place('table_medium.glb','interior-desk-'+b.id,x,b.z+3.5,1.2,.8,1);place('chair_B.glb','interior-chair-'+b.id,x,b.z+4.3,.6,1,.6,0,Math.PI);place('book_set.glb','interior-books-'+b.id,x,b.z+3.5,.3,.16,.25,.8);}
   if(library.has('table_medium.glb'))scene.getMeshByName('detail-batch-room-wood')?.setEnabled(false);
 },sync(states:Map<string,{open:boolean}>|undefined,camera?:Vector3){if(camera)for(const t of tenants)if(t.model){const near=Math.hypot(camera.x-t.point.x,camera.z-t.point.z)<22;t.model.root.setEnabled(near);const idle=t.model.entries.animationGroups.find(g=>g.name.endsWith('/Idle'));if(near&&!idle?.isPlaying)idle?.play(true);if(!near&&idle?.isPlaying)idle.pause();}for(const d of CITY_DOORS){const m=doors.get(d.id);if(m)m.rotation.y+=((states?.get(d.id)?.open?0:-d.side*Math.PI/2)-m.rotation.y)*.22;}}};
}
