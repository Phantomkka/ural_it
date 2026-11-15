import {MeshBuilder,type Scene} from './babylon';
import {CLIENT_CASE_TEMPLATE as T,SERVICE_FURNITURE,type ClientCase} from '@netcity/shared';
import {sign,type Palette} from './visuals';
export function buildCaseObjects(scene:Scene,mat:Palette){
  const shell=mat('service-device','#c0ccd0'),dark=mat('service-device-dark','#294756'),metal=mat('fixture-metal','#526774');
  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,material=shell,pick=false)=>{
    const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=material;m.isPickable=pick;return m;
  };
  for(const f of SERVICE_FURNITURE){
    const base=box('service-support-'+f.id,f.x,f.height/2,f.z,f.width,f.height,f.depth,metal);base.metadata={fixtureId:f.id};
    if(f.id!=='camera'){
      box('cabinet-door-'+f.id,f.x,f.height*.52,f.z-f.depth/2-.012,f.width-.08,f.height-.12,.02,shell);
      box('cabinet-handle-'+f.id,f.x+f.width*.3,f.height*.65,f.z-f.depth/2-.04,.035,.15,.035,dark);
    }
  }
  const target=(m:ReturnType<typeof MeshBuilder.CreateBox>,label:string)=>{m.metadata={caseTarget:'hardware',deviceLabel:label};m.isPickable=true;};
  const device=box('client-pc04',T.hardware.x,1.08,T.hardware.z,.5,.6,.7,dark,true);target(device,'CLIENT-PC04');
  const printer=box('service-device-printer',11.7,1.01,3,.7,.38,.5);target(printer,'PRINT-01');
  box('printer-scanner-lid',11.7,1.215,3,.72,.035,.51,dark);
  box('printer-output-slot',11.7,.99,2.741,.45,.06,.025,dark);
  box('printer-paper',11.7,.955,2.64,.3,.012,.24);
  const nas=box('service-device-backup',16,1.02,3.3,.42,.4,.4,dark);target(nas,'BACKUP-NAS');
  for(const x of [15.87,16,16.13])box('nas-drive',x,1.02,3.09,.09,.3,.02,metal);
  const phone=box('service-device-voip',6,.92,-4,.3,.14,.3,dark);target(phone,'SIP-01');
  box('phone-handset',5.88,1.02,-4,.075,.07,.33);
  box('phone-display',6.04,1.005,-3.93,.13,.015,.09,mat('device-indicator','#63cdb0',true));
  const ap=box('service-device-wifi',12.79,2.5,-1.8,.1,.3,.4);target(ap,'WIFI-AP');
  const server=box('service-device-server',18.045,1.25,0,.04,.25,1.3,dark);target(server,'RACK-01');
  const camera=box('service-device-camera',-6.5,2.55,20.23,.3,.22,.5);target(camera,'CAM-01');
  box('camera-bracket',-6.5,2.4,20.07,.08,.1,.25,metal);box('camera-lens',-6.5,2.55,20.493,.15,.15,.035,dark);
  for(const p of [
    {id:'network',label:'CLIENT-PC04',x:11.5,y:1.55,z:-4},{id:'printer',label:'PRINT-01',x:11.7,y:1.43,z:3},
    {id:'backup',label:'BACKUP-NAS',x:16,y:1.42,z:3.3},{id:'wifi',label:'WIFI-AP',x:12.78,y:2.85,z:-1.8},
    {id:'voip',label:'SIP-01',x:6,y:1.23,z:-4},{id:'camera',label:'CAM-01',x:-6.5,y:2.95,z:20},
  ]){const label=sign(scene,'device-label-'+p.id,p.label,.95,.15);label.mesh.position.set(p.x,p.y,p.z);label.mesh.billboardMode=7;label.mesh.isPickable=false;}
  const dropped=box('owned-patch-cord',0,.08,0,.3,.08,.25,mat('case-cable','#64dec1',true),true);dropped.metadata={caseTarget:'dropped'};dropped.setEnabled(false);
  const link=box('client-pc04-link',T.hardware.x,1.25,T.hardware.z-.37,.08,.08,.04);
  const offline=mat('client-link-down','#ea9668',true),online=mat('client-link-up','#64dec1',true);
  return {sync(c:ClientCase|undefined){dropped.setEnabled(!!c?.droppedAt);if(c?.droppedAt)dropped.position.set(c.droppedAt.x,.08,c.droppedAt.z);link.material=c&&c.templateId==='moved-desks'&&['REPAIRED','VERIFIED','COMPLETED'].includes(c.stage)?online:offline;}};
}
