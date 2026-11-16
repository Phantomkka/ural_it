import {test} from 'node:test';import assert from 'node:assert/strict';
import {VAN_BAYS,VAN_MAX_SPEED,stepVan,vanOnRoad,vanOverlaps} from '@netcity/shared';
import {MemoryProgressStore} from './progress/store.js';import {logisticsContract} from './logistics.contract.js';
test('van physics is fixed-step, bounded, road-only, collision-aware and cannot rotate in place',()=>{
 let v={x:0,z:-20,yaw:0,speed:0};assert.deepEqual(stepVan(v,{forward:0,strafe:1,yaw:0},1,[]),v);
 const one=stepVan(v,{forward:1,strafe:0,yaw:0},1,[]),fixed=stepVan(v,{forward:1,strafe:0,yaw:0},1/30,[]);assert.deepEqual(one,fixed);
 for(let i=0;i<1500;i++){v=stepVan(v,{forward:1,strafe:.35,yaw:0},1/30,[]);assert.ok(vanOnRoad(v));assert.ok(Math.abs(v.speed)<=VAN_MAX_SPEED);}
 const stopped=stepVan({x:0,z:0,yaw:0,speed:9},{forward:1,strafe:0,yaw:0},1/30,[{x:0,z:2.3,width:2,depth:.2}]);assert.equal(stopped.speed,0);assert.equal(stopped.z,0);
 assert.equal(vanOverlaps({x:0,z:0,yaw:Math.PI/2,speed:0},{x:1.9,z:0,width:.3,depth:.3}),true);assert.ok(VAN_BAYS.every(vanOnRoad));
});
test('logistics enforces owned vehicles, custody, capacity, actual transport and exactly-once delivery/part transfers',()=>logisticsContract(new MemoryProgressStore()));
