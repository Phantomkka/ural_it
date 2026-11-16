import {CITY_BUILDINGS} from './buildings.js';
import {officeEnvelope} from './officeFloors.js';

export interface Footprint {x:number;z:number;width:number;depth:number}
export const footprintsOverlap=(a:Footprint,b:Footprint,padding=0)=>
 Math.abs(a.x-b.x)<(a.width+b.width)/2+padding&&Math.abs(a.z-b.z)<(a.depth+b.depth)/2+padding;

/** Split an axis-aligned fence around occupied land. Used by rendering and collision. */
export function clipFence(fence:Footprint,exclusions:readonly Footprint[],clearance=.65):Footprint[]{
 const vertical=fence.depth>=fence.width,axis=vertical?'z':'x',span=vertical?'depth':'width';
 let pieces=[fence];
 for(const obstacle of exclusions){
  pieces=pieces.flatMap(piece=>{
   if(!footprintsOverlap(piece,obstacle,clearance))return [piece];
   const low=piece[axis]-piece[span]/2,high=piece[axis]+piece[span]/2;
   const cutLow=obstacle[axis]-obstacle[span]/2-clearance,cutHigh=obstacle[axis]+obstacle[span]/2+clearance;
   return [[low,Math.min(high,cutLow)],[Math.max(low,cutHigh),high]].filter(([a,b])=>b-a>.15).map(([a,b])=>({...piece,[axis]:(a+b)/2,[span]:b-a}));
  });
 }
 return pieces;
}
const buildings=CITY_BUILDINGS.map(officeEnvelope);
// Rear service gates remain open; never run a rail through an office or an access route.
export const CITY_FENCES=[-1,1].flatMap(side=>clipFence(
 {x:side*31,z:0,width:.08,depth:86},
 [...buildings,...[-34,-17,0,17,34].map(z=>({x:side*31,z,width:4,depth:3.2}))],
));
