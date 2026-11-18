import {test} from 'node:test';import assert from 'node:assert/strict';
import {CITY_DOORS,HQ_ENTRY_DOOR,DOOR_WIDTH,doorLeaves,doorClosed,advance,TICK_RATE} from '@netcity/shared';
test('paired doors cover the whole wall aperture and leave an open central route in either direction',()=>{
 for(const d of [...CITY_DOORS,HQ_ENTRY_DOOR]){
  const closed=doorClosed(d),leaves=doorLeaves(d);assert.equal(closed.z,d.z);assert.equal(closed.depth,DOOR_WIDTH);assert.equal(leaves.length,2);
  assert.equal(leaves[0].z+leaves[1].z,2*d.z);assert.equal(leaves[0].width*2,DOOR_WIDTH);
  for(const offset of [-.6,0,.6])for(const inside of [false,true]){
   const side=d.side,initial={x:d.x+(inside?1:-1)*side*1.1,z:d.z+offset},input={forward:1,strafe:0,yaw:(inside?-1:1)*side*Math.PI/2};
   let p=initial;const states=new Map(CITY_DOORS.map(door=>[door.id,{open:door.id!==d.id}]));
   for(let i=0;i<25;i++)p=advance(p,input,1/TICK_RATE,d.id!=='hq-entry',states);
   assert.equal(Math.sign(p.x-d.x),Math.sign(initial.x-d.x),d.id+' closed');
   states.set(d.id,{open:true});p=initial;for(let i=0;i<25;i++)p=advance(p,input,1/TICK_RATE,true,states);
   assert.notEqual(Math.sign(p.x-d.x),Math.sign(initial.x-d.x),d.id+' open route');
  }
 }
});
