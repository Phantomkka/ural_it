import {FIELD_SITES} from '../../../packages/shared/src/fieldSites';
import {MeshBuilder,type Scene} from './babylon';import {sign,type Palette} from './visuals';
export function buildFieldSites(scene:Scene,mat:Palette){
 for(const p of FIELD_SITES){const ground=MeshBuilder.CreateGround('field-service-yard-'+p.id,{width:11,height:10},scene);ground.position.set(p.x,.012,p.z);ground.material=mat('service-yard','#87908a');ground.isPickable=false;
  const cabinet=MeshBuilder.CreateBox('field-cabinet-'+p.id,{width:1,height:1.9,depth:1},scene);cabinet.position.set(p.x,.95,p.z);cabinet.material=mat('field-cabinet','#677a83');cabinet.metadata={caseTarget:'hardware',deviceLabel:p.name};
  const panel=MeshBuilder.CreateBox('field-panel-'+p.id,{width:.86,height:1.65,depth:.04},scene);panel.position.set(p.x,.95,p.z-.52);panel.material=mat('field-panel','#253e49');panel.isPickable=false;
  for(let i=0;i<4;i++){const vent=MeshBuilder.CreateBox('field-vent',{width:.65,height:.04,depth:.05},scene);vent.position.set(p.x,.5+i*.15,p.z-.55);vent.material=mat('field-vent','#849a9f');vent.isPickable=false;}
  const label=sign(scene,'field-label-'+p.id,p.name,3,.32,24);label.mesh.position.set(p.x,2.25,p.z-.55);label.mesh.isPickable=false;
 }
}
