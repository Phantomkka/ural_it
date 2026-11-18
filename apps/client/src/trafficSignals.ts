import {MeshBuilder,TransformNode,type Scene,type Mesh} from './babylon';
import {TRAFFIC_SIGNALS,trafficLamp} from '@netcity/shared';
import type {Palette} from './visuals';
export function buildTrafficSignals(scene:Scene,mat:Palette){
 const active=[mat('traffic-red','#ef4542',true),mat('traffic-amber','#ffbe39',true),mat('traffic-green','#44e383',true)],off=mat('traffic-off','#172329'),groups:Mesh[][]=[];
 for(const layout of TRAFFIC_SIGNALS){
  const root=new TransformNode('traffic-signal-'+layout.id,scene);root.position.set(layout.x,.055,layout.z);root.rotation.y=layout.yaw;
  const metal=mat('traffic-metal','#34434c'),housing=mat('traffic-housing','#172329');
  const pole=MeshBuilder.CreateCylinder('traffic-pole',{height:2.35,diameter:.12,tessellation:10},scene);pole.parent=root;pole.position.y=1.175;pole.material=metal;
  const body=MeshBuilder.CreateBox('traffic-head',{width:.43,height:1.02,depth:.3},scene);body.parent=root;body.position.y=2.35;body.material=housing;
  const lamps:Mesh[]=[];
  for(let i=0;i<3;i++){
   const lamp=MeshBuilder.CreateCylinder('traffic-lens-'+layout.id+'-'+i,{diameter:.23,height:.025,tessellation:16},scene);lamp.parent=root;lamp.position.set(0,2.65-i*.3,-.165);lamp.rotation.x=Math.PI/2;lamp.material=off;lamp.metadata={cityDynamic:true,trafficLens:i,direction:layout.direction};lamps.push(lamp);
   const visor=MeshBuilder.CreateBox('traffic-visor',{width:.33,height:.025,depth:.25},scene);visor.parent=root;visor.position.set(0,2.79-i*.3,-.22);visor.material=housing;
  }
  for(const mesh of root.getChildMeshes()){mesh.isPickable=false;mesh.metadata={...mesh.metadata,cityDynamic:true};mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();}groups.push(lamps);
 }
 let previous=-1;return {update(phase:string){const selected=trafficLamp(phase);if(selected===previous)return;previous=selected;for(const lamps of groups)lamps.forEach((lamp,i)=>lamp.material=i===selected?active[i]:off);}};
}
