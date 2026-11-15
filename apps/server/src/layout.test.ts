import {test} from 'node:test';import assert from 'node:assert/strict';
import {advance,TICK_RATE,SERVICE_FURNITURE,PARKED_CARS,initialCars,propFloor} from '@netcity/shared';
test('service cabinets leave the existing PC and training approaches walkable',()=>{
 for(const [x,direction]of [[16,1],[11,-1]]){let p={x,z:0};for(let i=0;i<24;i++)p=advance(p,{forward:1,strafe:0,yaw:direction>0?0:Math.PI},1/TICK_RATE);assert.ok(p.z*direction>3.8,JSON.stringify(p));}
 for(const f of SERVICE_FURNITURE)assert.equal(propFloor(f,true),false,f.id);
});
test('parking is contained on the road with clearance from authoritative moving lanes',()=>{
 for(const p of PARKED_CARS){assert.ok(Math.abs(p.x)+p.width/2<5);for(const c of initialCars())assert.ok(Math.abs(c.x-p.x)>p.width/2+1.25);}
});
