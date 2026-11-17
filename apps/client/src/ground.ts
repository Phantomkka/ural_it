import {CITY_BUILDINGS,officeEnvelope} from '@netcity/shared';
import {Mesh,VertexData,type Scene} from './babylon';

/** Grass ends at streets and buildings instead of sharing their depth-buffer pixels. */
export function buildGround(scene:Scene){
 const buildings=CITY_BUILDINGS.map(officeEnvelope),extent=55,street={halfWidth:7,halfLength:50};
 const xs=[...new Set([-extent,extent,-street.halfWidth,street.halfWidth,-5,5,...buildings.flatMap(b=>[b.x-b.width/2,b.x+b.width/2])])].sort((a,b)=>a-b);
 const zs=[...new Set([-extent,extent,-street.halfLength,street.halfLength,...buildings.flatMap(b=>[b.z-b.depth/2,b.z+b.depth/2])])].sort((a,b)=>a-b);
 const positions:number[]=[],indices:number[]=[],uvs:number[]=[],normals:number[]=[];
 for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
  const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;
  if(Math.abs(x)<5||Math.abs(x)<street.halfWidth&&Math.abs(z)<street.halfLength||buildings.some(b=>Math.abs(x-b.x)<b.width/2&&Math.abs(z-b.z)<b.depth/2))continue;
  const start=positions.length/3;
  for(const [px,pz]of [[xs[i-1],zs[j-1]],[xs[i-1],zs[j]],[xs[i],zs[j]],[xs[i],zs[j-1]]]){positions.push(px,0,pz);normals.push(0,1,0);uvs.push((px+extent)/(extent*2),(pz+extent)/(extent*2));}
  indices.push(start,start+1,start+2,start,start+2,start+3);
 }
 const mesh=new Mesh('ground',scene),data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;data.applyToMesh(mesh);return mesh;
}
