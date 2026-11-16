import {test} from 'node:test';import assert from 'node:assert/strict';import {VAN_BAYS,vanOnRoad,vanOverlaps,initialCars} from '@netcity/shared';
test('all service parking bays fit the road and remain clear of moving traffic in either lane',()=>{
 for(const bay of VAN_BAYS){assert.ok(vanOnRoad(bay));for(const car of initialCars())assert.equal(vanOverlaps(bay,{x:car.x,z:bay.z,width:1.9,depth:4.1}),false,'parked vans must not depend on traffic phase');}
});
