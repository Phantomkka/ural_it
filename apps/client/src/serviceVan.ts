import {MeshBuilder,Mesh,TransformNode,Vector3,type Scene} from './babylon';
import {VAN_WIDTH,VAN_LENGTH,type WorkVan,type GroundFreight} from '@netcity/shared';
import {sign,type Palette} from './visuals';

/** Authored reusable carton, with tape, reinforcement and a readable shipping label. */
export function createFreightCrate(scene:Scene,mat:Palette,name:string){
 const root=new TransformNode(name,scene),parts:Mesh[]=[];
 const box=(id:string,x:number,y:number,z:number,w:number,h:number,d:number,material=mat('freight-cardboard','#ab8258'))=>{const m=MeshBuilder.CreateBox(id,{width:w,height:h,depth:d},scene);m.parent=root;m.position.set(x,y,z);m.material=material;m.isPickable=false;m.metadata={cityDynamic:true,officeDetail:true};parts.push(m);return m;};
 box('equipment-carton',0,.28,0,.65,.56,.52);box('carton-tape',0,.563,0,.11,.007,.53,mat('packing-tape','#d0b17a'));for(const x of [-.31,.31])box('carton-edge',x,.28,0,.022,.56,.54,mat('carton-reinforcement','#715638'));
 const label=sign(scene,name+'-label','NETCITY / IT · ↑ ↑',.48,.16,35);label.mesh.parent=root;label.mesh.position.set(0,.36,.266);label.mesh.isPickable=false;label.mesh.metadata={cityDynamic:true,officeDetail:true};
 return root;
}

export function buildServiceVans(scene:Scene,mat:Palette){
 const template=new TransformNode('service-van-template',scene),wheels:TransformNode[]=[],doorNodes:TransformNode[]=[];
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,key=name,parent=template)=>{const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.parent=parent;m.position.set(x,y,z);m.material=mat(key,color);m.metadata={cityDynamic:true};return m;};
 const width=VAN_WIDTH-.12,length=VAN_LENGTH-.14;
 box('van-underbody',0,.55,0,width,.28,length,'#293f49');box('van-cargo-floor',0,.73,-.7,width,.08,2.5,'#5d6d70','van-cargo-floor');for(const side of [-1,1])box('van-cargo-side',side*(width/2-.025),1.36,-.55,.055,1.5,2.8,'#d5dedb','service-van-paint');box('van-cargo-bulkhead',0,1.36,.34,width,1.5,.06,'#d5dedb','service-van-paint');box('van-roof',0,2.11,0,width,.14,length,'#d5dedb','service-van-paint');
 box('van-bonnet',0,.93,1.55,width,.47,.9,'#d5dedb','service-van-paint');box('van-grille',0,.84,2.045,1.1,.18,.025,'#243841','van-underbody');
 const glass=mat('service-van-glass','#a8c7cd');glass.unfreeze();glass.alpha=.28;glass.roughness=.12;glass.freeze();
 const windshield=box('van-windshield',0,1.65,1.75,1.55,.72,.025,'#a8c7cd','service-van-glass');windshield.rotation.x=-.18;
 for(const side of [-1,1]){
  box('van-cabin-side',side*(width/2),1.08,1.12,.06,.8,1.7,'#d5dedb','service-van-paint');const window=box('van-side-window',side*(width/2+.007),1.73,1.1,.014,.58,1.25,'#a8c7cd','service-van-glass');window.material=glass;
  box('van-pillar',side*.84,1.7,1.82,.09,.85,.09,'#d5dedb','service-van-paint');box('van-side-mirror',side*.94,1.63,1.72,.09,.18,.12,'#293f49','van-underbody');
  box('van-headlight',side*.67,1.04,2.048,.35,.2,.035,'#e0efcf','van-headlight');box('van-rear-light',side*.74,1.01,-2.055,.16,.4,.035,'#d75d54','van-tail-light');
  const stripe=box('van-service-stripe',side*(width/2+.012),1.3,-.6,.025,.21,2.5,'#258a86','van-service-stripe');stripe.metadata={cityDynamic:true,officeDetail:true};
  const badge=sign(scene,'van-company-badge','NETCITY / SERVICE',1.6,.24,36);badge.mesh.parent=template;badge.mesh.position.set(side*(width/2+.035),1.62,-.55);badge.mesh.rotation.y=side*Math.PI/2;badge.mesh.isPickable=false;badge.mesh.metadata={cityDynamic:true,officeDetail:true};
  const hinge=new TransformNode('van-rear-hinge-'+side,scene);hinge.parent=template;hinge.position.set(side*.87,1.36,-2.06);box('van-rear-door',-side*.43,0,0,.85,1.4,.05,'#d5dedb','service-van-paint',hinge);box('van-door-handle',-side*.7,-.12,-.04,.05,.22,.06,'#293f49','van-underbody',hinge);doorNodes.push(hinge);
 }
 for(const side of [-1,1])for(const z of [-1.32,1.35]){const root=new TransformNode('van-wheel',scene);root.parent=template;root.position.set(side*.84,.36,z);const tyre=MeshBuilder.CreateCylinder('van-tyre',{height:.22,diameter:.68,tessellation:16},scene);tyre.parent=root;tyre.rotation.z=Math.PI/2;tyre.material=mat('van-rubber','#263038');const rim=MeshBuilder.CreateCylinder('van-rim',{height:.235,diameter:.37,tessellation:12},scene);rim.parent=root;rim.rotation.z=Math.PI/2;rim.material=mat('van-wheel-metal','#9ba8aa');for(const m of [tyre,rim])m.metadata={cityDynamic:true,officeDetail:true};wheels.push(root);}
 const driver=new TransformNode('van-seated-driver',scene);driver.parent=template;
 box('van-driver-seat',-.4,1.0,1.05,.5,.7,.5,'#263f4b','van-seat',driver);box('van-driver-torso',-.4,1.32,1.12,.36,.48,.28,'#428e98','van-driver-shirt',driver);const head=MeshBuilder.CreateSphere('van-driver-head',{diameter:.3,segments:8},scene);head.parent=driver;head.position.set(-.4,1.73,1.13);head.material=mat('npc-skin','#cb9573');head.metadata={cityDynamic:true,officeDetail:true};
 for(const x of [-.56,-.24]){const arm=MeshBuilder.CreateTube('van-driver-arm',{path:[new Vector3(x,1.48,1.12),new Vector3(x,1.22,1.35),new Vector3(x,1.35,1.57)],radius:.055,tessellation:6},scene);arm.parent=driver;arm.material=mat('van-driver-shirt','#428e98');arm.metadata={cityDynamic:true,officeDetail:true};}
 const wheel=MeshBuilder.CreateTorus('van-steering-wheel',{diameter:.35,thickness:.035,tessellation:12},scene);wheel.parent=template;wheel.position.set(-.4,1.35,1.6);wheel.rotation.x=Math.PI/2;wheel.material=mat('van-rubber','#263038');wheel.metadata={cityDynamic:true,officeDetail:true};
 for(let i=0;i<3;i++){const crate=createFreightCrate(scene,mat,'van-cargo-'+i);crate.parent=template;crate.position.set((i%2-.5)*.75,.77,-1.35+Math.floor(i/2)*.7);crate.scaling.setAll(.85);}
 box('van-dashboard',0,1.27,1.67,1.65,.2,.27,'#263f4b','van-seat');
 // Merge only stationary direct-child geometry. Door pivots, wheels and seated driver remain movable.
 const groups=new Map<unknown,Mesh[]>();for(const node of template.getChildren())if(node instanceof Mesh&&!node.name.includes('badge')){const group=groups.get(node.material)??[];group.push(node);groups.set(node.material,group);}
 for(const group of groups.values())if(group.length>1){const merged=Mesh.MergeMeshes(group,true,true,undefined,false,false)!;merged.parent=template;merged.metadata={cityDynamic:true};}
 template.setEnabled(false);const fleet=new Map<string,TransformNode>(),parcels=new Map<string,TransformNode>();let changed=false;
 return {update(vans:Map<string,WorkVan>|undefined,freight:Map<string,GroundFreight>|undefined,camera:Vector3,me:string,dt:number){changed=false;const present=new Set<string>();if(vans)for(const [id,v]of vans){present.add(id);let root=fleet.get(id);if(!root){root=template.clone('service-van-'+id,null)!;root.position.set(v.x,0,v.z);root.rotation.y=v.yaw;root.setEnabled(true);for(const m of root.getChildMeshes()){m.metadata={...m.metadata,vanId:id,cityDynamic:true};m.isPickable=true;}fleet.set(id,root);changed=true;}
  root.position=Vector3.Lerp(root.position,new Vector3(v.x,0,v.z),Math.hypot(root.position.x-v.x,root.position.z-v.z)>5?1:Math.min(1,dt*20));root.rotation.y+=Math.atan2(Math.sin(v.yaw-root.rotation.y),Math.cos(v.yaw-root.rotation.y))*Math.min(1,dt*20);root.setEnabled(Vector3.Distance(root.position,camera)<65);
  root.getChildTransformNodes().filter(n=>n.name.includes('van-rear-hinge')).forEach((n,i)=>n.rotation.y+=((v.bootOpen?(i?1:-1)*1.8:0)-n.rotation.y)*Math.min(1,dt*12));root.getChildTransformNodes().filter(n=>n.name.includes('van-wheel')).forEach(n=>n.rotation.x+=v.speed*dt/.34);
  root.getChildTransformNodes().find(n=>n.name.includes('van-seated-driver'))?.setEnabled(!!v.driver&&v.driver!==me);
  root.getChildTransformNodes().filter(n=>/van-cargo-\d+$/.test(n.name)).forEach((n,i)=>n.setEnabled(i<v.cargoCount));
 }
 for(const [id,root]of fleet)if(!present.has(id)){root.dispose();fleet.delete(id);changed=true;}
 const ground=new Set<string>();if(freight)for(const [id,p]of freight){ground.add(id);let root=parcels.get(id);if(!root){root=createFreightCrate(scene,mat,'delivery-ground-'+id);for(const m of root.getChildMeshes()){m.isPickable=true;m.metadata={...m.metadata,groundFreight:id};}parcels.set(id,root);changed=true;}root.position.set(p.x,0,p.z);root.setEnabled(Vector3.Distance(root.position,camera)<50);}
 for(const [id,root]of parcels)if(!ground.has(id)){root.dispose();parcels.delete(id);changed=true;}return changed;}};
}
