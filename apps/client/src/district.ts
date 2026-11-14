import { MeshBuilder, Mesh, type Scene } from "./babylon";
import { sign, type Palette } from "./visuals";
import {CLIENT_CASE_TEMPLATE} from "@netcity/shared";
export const CONTACTS = [
  {id:"client",name:"Елена · бухгалтерия",...CLIENT_CASE_TEMPLATE.client,color:"#799fd4"},
  {id:"dispatcher",name:"Алина · диспетчер",x:4,z:-5,color:"#e2b46b"},
  {id:"supplier",name:"Марат · снабжение",x:-6,z:2,color:"#62cdb3"},
] as const;
export const LANDMARKS = [
  {name:"IT-офис",x:14,z:0}, {name:"Снабжение",x:-14,z:0},
  {name:"Офис клиента",x:14,z:17}, {name:"Серверная",x:17,z:0},
] as const;
/** Friendly authored district contacts. Dialogues never award money or change server state. */
export function buildDistrict(scene: Scene, palette: Palette) {
  for(const contact of CONTACTS) {
    const jacket=palette(`npc-${contact.id}`,contact.color), skin=palette("npc-skin","#cb9573"), trousers=palette("npc-trousers","#203849");
    const body=MeshBuilder.CreateCylinder(`contact-${contact.id}`,{height:0.85,diameterTop:0.42,diameterBottom:0.5,tessellation:8},scene);
    body.position.set(contact.x,1.05,contact.z);body.material=jacket;body.metadata={npcId:contact.id};body.isPickable=true;
    const head=MeshBuilder.CreateSphere(`contact-head-${contact.id}`,{diameter:0.4,segments:6},scene);
    head.position.set(contact.x,1.7,contact.z);head.material=skin;head.metadata={npcId:contact.id};
    for(const dx of [-0.13,0.13]) {
      const leg=MeshBuilder.CreateCylinder("contact-leg",{height:0.65,diameter:0.18,tessellation:6},scene);
      leg.position.set(contact.x+dx,0.325,contact.z);leg.material=trousers;leg.isPickable=false;
    }
    const tag=sign(scene,`contact-label-${contact.id}`,contact.name,2.7,0.4);
    tag.mesh.position.set(contact.x,2.25,contact.z);tag.mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;tag.mesh.isPickable=false;
  }
  for(const item of [
    {name:"supply-sign",text:"СНАБЖЕНИЕ · NET",x:-7.8,y:3,z:0,yaw:-Math.PI/2},
    {name:"client-sign",text:"КЛИЕНТСКИЙ ОФИС",x:7.8,y:3,z:17,yaw:Math.PI/2},
  ]) {
    const tag=sign(scene,item.name,item.text,5,0.75);tag.mesh.position.set(item.x,item.y,item.z);tag.mesh.rotation.y=item.yaw;tag.mesh.isPickable=false;
  }
}
