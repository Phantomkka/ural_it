import {MeshBuilder,TransformNode,Vector3,type Scene} from './babylon';
import {sign,type Palette} from './visuals';
/** Explicit procedural fallback used only when a local character GLB failed. */
export function officeWorkerFallback(scene:Scene,mat:Palette,name:string,seated:boolean){
 const root=new TransformNode(name,scene);root.metadata={fallback:true};
 const shirt=mat('office-fallback-shirt','#64879b'),skin=mat('office-fallback-skin','#bc8e71'),pants=mat('office-fallback-pants','#273a4c');
 const torso=MeshBuilder.CreateCylinder(name+'-torso',{height:.58,diameterTop:.37,diameterBottom:.33,tessellation:8},scene);torso.parent=root;torso.position.y=seated?1.02:1.08;torso.material=shirt;
 const head=MeshBuilder.CreateSphere(name+'-head',{diameter:.32,segments:8},scene);head.parent=root;head.position.y=seated?1.5:1.64;head.material=skin;
 for(const x of [-.13,.13]){
  const path=seated?[new Vector3(x,.69,0),new Vector3(x,.62,.36),new Vector3(x,.12,.38)]:[new Vector3(x,.8,0),new Vector3(x,.12,0)];
  const leg=MeshBuilder.CreateTube(name+'-leg',{path,radius:.085,tessellation:6},scene);leg.parent=root;leg.material=pants;
  const arm=MeshBuilder.CreateTube(name+'-arm',{path:[new Vector3(x*1.6,1.23,0),new Vector3(x*1.7,.94,seated?.2:0),new Vector3(x*1.5,.88,seated?.5:.06)],radius:.06,tessellation:6},scene);arm.parent=root;arm.material=shirt;
 }
 const label=sign(scene,name+'-fallback-label','РЕЗЕРВНАЯ МОДЕЛЬ',1.3,.18);label.mesh.parent=root;label.mesh.position.y=2;label.mesh.billboardMode=7;
 return root;
}
