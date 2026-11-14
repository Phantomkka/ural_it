import {MeshBuilder,type Scene} from "./babylon";
import {CLIENT_CASE_TEMPLATE as T,CASE_CATALOG,caseTemplate,type ClientCase} from "@netcity/shared";
import {sign,type Palette} from "./visuals";
export function buildCaseObjects(scene:Scene,mat:Palette) {
  const device=MeshBuilder.CreateBox("client-pc04",{width:0.5,height:0.6,depth:0.7},scene);
  device.position.set(T.hardware.x,1.35,T.hardware.z);device.material=mat("client-pc","#294756");device.metadata={caseTarget:"hardware",cityDynamic:true};
  // Authored local equipment silhouettes identify distinct service destinations.
  for(const t of CASE_CATALOG.filter(t=>t.kind!=='network')){
    const base=MeshBuilder.CreateBox('service-device-'+t.kind,{width:t.kind==='printer'?.7:.45,height:t.kind==='camera'?.25:.35,depth:.4},scene);
    base.position.set(t.hardware.x,t.kind==='camera'?2.4:1.1,t.hardware.z);base.material=mat('service-device','#c0ccd0');base.metadata={caseTarget:'hardware'};
    const screen=MeshBuilder.CreateBox('device-indicator-'+t.kind,{width:.25,height:.08,depth:.02},scene);screen.position.set(t.hardware.x,base.position.y+.05,t.hardware.z-.21);screen.material=mat('device-indicator','#63cdb0',true);screen.isPickable=false;
    const tag=sign(scene,'device-label-'+t.kind,{network:'CLIENT-PC04',wifi:'WIFI-AP',power:'CLIENT-PC',printer:'PRINT-01',server:'RACK-01',backup:'BACKUP-NAS',camera:'CAM-01',voip:'SIP-01'}[t.kind],1.5,.24);tag.mesh.position.set(t.hardware.x,base.position.y+.5,t.hardware.z);tag.mesh.billboardMode=7;tag.mesh.isPickable=false;
  }
  const label=sign(scene,"client-pc04-label","CLIENT-PC04 · РОЗЕТКА 2",2,0.32);label.mesh.position.set(T.hardware.x,2,T.hardware.z);label.mesh.billboardMode=7;label.mesh.isPickable=false;
  const dropped=MeshBuilder.CreateBox("owned-patch-cord",{width:0.3,height:0.08,depth:0.25},scene);
  dropped.material=mat("case-cable","#64dec1",true);dropped.metadata={caseTarget:"dropped"};dropped.setEnabled(false);
  const link=MeshBuilder.CreateBox("client-pc04-link",{width:0.08,height:0.08,depth:0.04},scene);
  link.position.set(T.hardware.x,1.5,T.hardware.z-0.37);link.isPickable=false;
  const offline=mat("client-link-down","#ea9668",true),online=mat("client-link-up","#64dec1",true);
  link.material=offline;
  return {sync(c:ClientCase|undefined){const t=caseTemplate(c);device.setEnabled(t.kind==='network');dropped.setEnabled(!!c?.droppedAt);if(c?.droppedAt)dropped.position.set(c.droppedAt.x,0.08,c.droppedAt.z);link.material=c&&["REPAIRED","VERIFIED","COMPLETED"].includes(c.stage)?online:offline;}};
}
