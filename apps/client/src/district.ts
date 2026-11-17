import {dressOfficeCharacter} from './characterAppearance';
import { MeshBuilder, Mesh,TransformNode, type Scene,type Vector3 } from "./babylon";
import {AssetLibrary,CHARACTER_FILES,fitModel} from './assets';
import { sign, type Palette } from "./visuals";
import {CLIENT_CASE_TEMPLATE,DISPATCHER_POINT} from "@netcity/shared";
export const CONTACTS = [
  {id:"client",name:"Елена · бухгалтерия",...CLIENT_CASE_TEMPLATE.client,color:"#799fd4"},
  {id:"dispatcher",name:"Алина · диспетчер",...DISPATCHER_POINT,color:"#e2b46b"},
  {id:"supplier",name:"Марат · снабжение",x:-6,z:2,color:"#62cdb3"},
  {id:"alex",name:"Алексей · рабочие места",x:10.7,z:-3.35,color:"#7a9dbb",seated:true},
  {id:"olga",name:"Ольга · печать",x:10.7,z:4.65,color:"#b6a783",seated:true},
  {id:"igor",name:"Игорь · серверы",x:15.7,z:4.65,color:"#75919f",seated:true},
] as const;
export const LANDMARKS = [
  {name:"IT-офис",x:14,z:0}, {name:"Снабжение",x:-14,z:0},
  {name:"Офис клиента",x:14,z:17}, {name:"Серверная",x:17,z:0},
] as const;
/** Friendly authored district contacts. Dialogues never award money or change server state. */
export function buildDistrict(scene: Scene, palette: Palette) {
  const actors:{id:string;x:number;z:number;fallback:TransformNode;label:Mesh;model?:NonNullable<ReturnType<AssetLibrary['instantiate']>>;anchor?:TransformNode}[]=[];
  for(const contact of CONTACTS) {
    if("seated" in contact)continue;
    const fallback=new TransformNode('contact-fallback-'+contact.id,scene);
    const jacket=palette(`npc-${contact.id}`,contact.color), skin=palette("npc-skin","#cb9573"), trousers=palette("npc-trousers","#203849");
    const body=MeshBuilder.CreateCylinder(`contact-${contact.id}`,{height:0.85,diameterTop:0.42,diameterBottom:0.5,tessellation:8},scene);
    body.parent=fallback;
    body.position.set(contact.x,1.05,contact.z);body.material=jacket;body.metadata={npcId:contact.id};body.isPickable=true;
    const head=MeshBuilder.CreateSphere(`contact-head-${contact.id}`,{diameter:0.4,segments:6},scene);
    head.parent=fallback;
    head.position.set(contact.x,1.7,contact.z);head.material=skin;head.metadata={npcId:contact.id};
    for(const dx of [-0.13,0.13]) {
      const leg=MeshBuilder.CreateCylinder("contact-leg",{height:0.65,diameter:0.18,tessellation:6},scene);
      leg.parent=fallback;
      leg.position.set(contact.x+dx,0.325,contact.z);leg.material=trousers;leg.isPickable=false;
    }
    const tag=sign(scene,`contact-label-${contact.id}`,contact.name,2.7,0.4);
    tag.mesh.position.set(contact.x,2.25,contact.z);tag.mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;tag.mesh.isPickable=false;
    actors.push({id:contact.id,x:contact.x,z:contact.z,fallback,label:tag.mesh});
  }
  for(const item of [
    {name:"supply-sign",text:"СНАБЖЕНИЕ · NET",x:-7.8,y:3,z:0,yaw:-Math.PI/2},
    {name:"client-sign",text:"КЛИЕНТСКИЙ ОФИС",x:7.8,y:3,z:17,yaw:Math.PI/2},
  ]) {
    const tag=sign(scene,item.name,item.text,5,0.75);tag.mesh.position.set(item.x,item.y,item.z);tag.mesh.rotation.y=item.yaw;tag.mesh.isPickable=false;
  }
  return {hydrate(library:AssetLibrary){for(const actor of actors){const model=library.instantiate(CHARACTER_FILES[actor.id==='client'||actor.id==='dispatcher'?1:2],'contact-skin-'+actor.id,true);if(!model)continue;fitModel(model.root,undefined,1.75,undefined);dressOfficeCharacter(model.root);const anchor=new TransformNode('contact-person-'+actor.id,scene);model.root.parent=anchor;anchor.position.set(actor.x,0,actor.z);anchor.rotation.y=Math.atan2(-actor.x,-actor.z);for(const mesh of model.root.getChildMeshes()){mesh.metadata={npcId:actor.id,cityDynamic:true};mesh.isPickable=true;}actor.model=model;actor.anchor=anchor;actor.fallback.setEnabled(false);}},update(camera:Vector3,floor:number){for(const actor of actors){const distance=Math.hypot(actor.x-camera.x,actor.z-camera.z),visible=distance<26&&(actor.id!=="client"||floor===0);(actor.anchor??actor.fallback).setEnabled(visible);actor.label.setEnabled(visible&&distance<8);for(const clip of actor.model?.entries.animationGroups??[]){const play=visible&&clip.name.endsWith('/Idle');if(play&&!clip.isPlaying)clip.play(true);else if(!play&&clip.isPlaying)clip.pause();}}}};
}
