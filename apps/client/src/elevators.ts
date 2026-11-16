import {MeshBuilder,TransformNode,type Scene,type Vector3,type Mesh} from './babylon';
import {CITY_BUILDINGS,FLOOR_HEIGHT,LIFT_DOOR_MS,officeFloorCount,officeLift,officeLiftWalls,type PlayerView} from '@netcity/shared';
import {officeMaterials} from './officeMaterials';
import {sign,type Palette} from './visuals';

/** One stationary cabin per landing. Server travel is concealed by an explicit transition. */
export function buildElevators(scene:Scene,mat:Palette,maps:ReturnType<typeof officeMaterials>){
 const landings:{root:TransformNode;doors:Mesh[];id:string;floor:number;side:number;x:number;z:number;open:number}[]=[];
 const metal=mat('elevator-brushed-metal','#adb9be'),dark=mat('elevator-frame','#33474f'),floorMat=maps.liftFloor;
 const box=(name:string,parent:TransformNode,x:number,y:number,z:number,w:number,h:number,d:number,material=metal)=>{const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.parent=parent;m.position.set(x,y,z);m.material=material;m.isPickable=false;m.metadata={cityDynamic:true,officeDetail:true};return m;};
 for(const b of CITY_BUILDINGS)for(let floor=0;floor<officeFloorCount(b);floor++){
  const p=officeLift(b),side=Math.sign(b.x),root=new TransformNode(`elevator-${b.id}-${floor}`,scene);root.position.y=floor*FLOOR_HEIGHT;
  for(const w of officeLiftWalls(b))box('elevator-cabin-wall',root,w.x,1.44,w.z,w.width,2.88,w.depth,maps.liftWall);
  box('elevator-nonslip-floor',root,p.x,.055,p.z,2.12,.04,2.04,floorMat);
  box('elevator-ceiling',root,p.x,2.89,p.z,2.3,.08,2.3,dark);
  box('elevator-ceiling-light',root,p.x,2.84,p.z,1.2,.035,.8,mat('elevator-light','#e3f6ee',true));
  for(const z of [-1,1]){box('elevator-door-jamb',root,p.x-side*1.04,1.45,p.z+z*1.1,.18,2.9,.14,dark);box('elevator-handrail',root,p.x+side*.15,1.02,p.z+z*1.01,1.75,.055,.055,metal);}
  box('elevator-header',root,p.x-side*1.04,2.75,p.z,.18,.3,2.3,dark);
  box('elevator-threshold',root,p.x-side*1.04,.065,p.z,.32,.025,2.14,metal);
  const doors=[-1,1].map((dir,i)=>{const m=box('elevator-sliding-door-'+i,root,p.x-side*1.04,1.35,p.z+dir*.49,.08,2.62,.97,maps.liftWall);m.metadata={...m.metadata,officeLift:b.id};m.isPickable=true;return m;});
  const panel=box('lift-control-'+b.id+'-'+floor,root,p.x-side*1.16,1.3,p.z+1.05,.13,.42,.16,dark);panel.isPickable=true;panel.metadata={...panel.metadata,officeLift:b.id};
  box('lift-call-button',root,p.x-side*1.24,1.33,p.z+1.05,.025,.09,.1,mat('elevator-button','#67d8bc',true));
  const label=sign(scene,'lift-label-'+b.id+'-'+floor,`ЭТАЖ ${floor+1}  ·  ЛИФТ`,1.7,.22,37);label.mesh.parent=root;label.mesh.position.set(p.x-side*1.15,2.76,p.z);label.mesh.rotation.y=side*Math.PI/2;label.mesh.isPickable=false;
  landings.push({root,doors,id:b.id,floor,side,x:p.x,z:p.z,open:1});
 }
 return {update(camera:Vector3,players:Iterable<PlayerView>,dt:number){const people=[...players];for(const l of landings){
  const nearby=Math.hypot(l.x-camera.x,l.z-camera.z)<35;l.root.setEnabled(nearby);if(!nearby)continue;
  const now=Date.now(),rider=people.find(p=>p.buildingId===l.id&&(p.liftTarget??-1)>=0&&(p.floor===l.floor||p.liftTarget===l.floor));
  let open=1;
  if(rider){const elapsed=now-(rider.liftStarted??now),remaining=(rider.liftUntil??now)-now;open=Math.min(1,Math.max(0,1-elapsed/LIFT_DOOR_MS,1-remaining/LIFT_DOOR_MS));}
  l.open+=(open-l.open)*Math.min(1,dt*18);
  l.doors.forEach((door,i)=>door.position.z=l.z+(i?1:-1)*(.49+l.open*.9));
 }} };
}
