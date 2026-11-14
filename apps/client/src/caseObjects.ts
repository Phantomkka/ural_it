import {MeshBuilder,type Scene} from "./babylon";
import {CLIENT_CASE_TEMPLATE as T,type ClientCase} from "@netcity/shared";
import {sign,type Palette} from "./visuals";
export function buildCaseObjects(scene:Scene,mat:Palette) {
  const device=MeshBuilder.CreateBox("client-pc04",{width:0.5,height:0.6,depth:0.7},scene);
  device.position.set(T.hardware.x,1.35,T.hardware.z);device.material=mat("client-pc","#294756");device.metadata={caseTarget:"hardware"};
  const label=sign(scene,"client-pc04-label","CLIENT-PC04 · РОЗЕТКА 2",2,0.32);label.mesh.position.set(T.hardware.x,2,T.hardware.z);label.mesh.billboardMode=7;label.mesh.isPickable=false;
  const dropped=MeshBuilder.CreateBox("owned-patch-cord",{width:0.3,height:0.08,depth:0.25},scene);
  dropped.material=mat("case-cable","#64dec1",true);dropped.metadata={caseTarget:"dropped"};dropped.setEnabled(false);
  const link=MeshBuilder.CreateBox("client-pc04-link",{width:0.08,height:0.08,depth:0.04},scene);
  link.position.set(T.hardware.x,1.5,T.hardware.z-0.37);link.isPickable=false;
  const offline=mat("client-link-down","#ea9668",true),online=mat("client-link-up","#64dec1",true);
  link.material=offline;
  return {sync(c:ClientCase|undefined){dropped.setEnabled(!!c?.droppedAt);if(c?.droppedAt)dropped.position.set(c.droppedAt.x,0.08,c.droppedAt.z);link.material=c&&["REPAIRED","VERIFIED","COMPLETED"].includes(c.stage)?online:offline;}};
}
