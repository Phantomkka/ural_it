import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITY_BUILDINGS,CITY_FENCES,clipFence,footprintsOverlap,officeEnvelope,officeFloorCount,officeLift,officeLiftRoute,upperColliders,advance} from '@netcity/shared';

test('legacy x23 rail reproduced inside offices; generated perimeter excludes all 29 floor envelopes and gates',()=>{
 const original={x:-23,z:0,width:.05,depth:80};
 assert.ok(CITY_BUILDINGS.some(b=>footprintsOverlap(original,officeEnvelope(b))));
 assert.ok(CITY_FENCES.length>2);
 let floors=0;
 for(const b of CITY_BUILDINGS)for(let floor=0;floor<officeFloorCount(b);floor++){
  floors++;
  for(const fence of CITY_FENCES)assert.equal(footprintsOverlap(fence,officeEnvelope(b),.5),false,`${b.id}/${floor+1}`);
 }
 assert.equal(floors,29);
 for(const side of [-1,1])for(const z of [-34,-17,0,17,34])assert.equal(CITY_FENCES.some(f=>footprintsOverlap(f,{x:side*31,z,width:1,depth:3.2})),false);
});

test('clipping handles crossing, fully contained, touching and reversed sides deterministically',()=>{
 const f={x:23,z:0,width:.08,depth:80},blocked=CITY_BUILDINGS.map(officeEnvelope);
 const result=clipFence(f,blocked);
 assert.ok(result.length>0);
 for(const p of result)for(const b of blocked)assert.equal(footprintsOverlap(p,b,.64),false);
 assert.deepEqual(clipFence(f,[f]),[]);
 assert.deepEqual(clipFence(f,[]),[f]);
 const horizontal={x:0,z:0,width:20,depth:.1};
 assert.deepEqual(clipFence(horizontal,[{x:0,z:0,width:2,depth:2}],0),[{x:-5.5,z:0,width:9,depth:.1},{x:5.5,z:0,width:9,depth:.1}]);
});

test('all office lift landings have a walkable front approach on every floor',()=>{
 for(const b of CITY_BUILDINGS){const lift=officeLift(b),side=Math.sign(b.x);
  for(let floor=0;floor<officeFloorCount(b);floor++){
   const route=officeLiftRoute({x:lift.x,z:b.z},b);assert.ok(route.some(p=>Math.abs(p.x-(lift.x-side*2.2))<.01&&p.z===lift.z),'GPS approaches the door, not the side wall');
   let p={x:lift.x-side*2,z:lift.z};
   for(let i=0;i<12;i++)p=advance(p,{forward:1,strafe:0,yaw:side*Math.PI/2},1/30,true,undefined,floor?b.id:undefined);
   assert.ok(Math.hypot(p.x-lift.x,p.z-lift.z)<.3,`${b.id}/${floor}`);
   assert.ok(upperColliders(b.id).length>4);
  }
 }
});
