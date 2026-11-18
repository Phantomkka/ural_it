import {MeshBuilder,TransformNode,type Scene} from './babylon';
import {DOOR_WIDTH,DOOR_HEIGHT,DOOR_THICKNESS,type CityDoor} from '@netcity/shared';
import {doorResponse} from './motion';
import type {Palette} from './visuals';
/** Both leaves use the same hinge positions and footprints as server doorLeaves/doorClosed. */
export function buildDoor(scene:Scene,mat:Palette,d:CityDoor,entry=false){
 const root=new TransformNode('door-'+d.id,scene);root.position.set(d.x,0,d.z);const pivots:TransformNode[]=[];
 const frame=mat('door-frame','#4c626b'),panel=mat('door-panel','#315766'),metal=mat('door-handle','#b8c6be');
 const box=(name:string,parent:TransformNode,x:number,y:number,z:number,w:number,h:number,depth:number,material=frame)=>{const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth},scene);m.parent=parent;m.position.set(x,y,z);m.material=material;m.isPickable=false;m.metadata={cityDynamic:true};return m;};
 for(const end of [-1,1]){
  const pivot=new TransformNode('door-hinge-'+d.id+'-'+end,scene);pivot.parent=root;pivot.position.z=end*DOOR_WIDTH/2;pivots.push(pivot);
  const leaf=box('door-leaf-'+d.id+'-'+end,pivot,d.side*DOOR_WIDTH/4,DOOR_HEIGHT/2+.02,0,DOOR_WIDTH/2,DOOR_HEIGHT,DOOR_THICKNESS,panel);leaf.isPickable=true;leaf.metadata={cityDynamic:true,...(entry?{entryDoor:true}:{cityDoor:d.id})};
  box('door-handle-'+d.id,pivot,d.side*(DOOR_WIDTH/2-.12),1.12,-end*.085,.045,.25,.06,metal);
  box('door-jamb-'+d.id,root,0,1.37,end*(DOOR_WIDTH/2+.04),.3,2.74,.08);
 }
 box('door-header-'+d.id,root,0,2.67,0,.3,.1,DOOR_WIDTH+.16);
 return {root,update(open:boolean,dt:number){pivots.forEach((p,i)=>{const target=open?0:(i===0?-1:1)*d.side*Math.PI/2;p.rotation.y+=(target-p.rotation.y)*doorResponse(dt);});}};
}
