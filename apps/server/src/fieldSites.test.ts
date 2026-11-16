import {test} from 'node:test';import assert from 'node:assert/strict';import {FIELD_SITES,districtRoute,advance} from '@netcity/shared';
test('new field sites remain reachable through physical fence gaps in both directions',()=>{
 for(const site of FIELD_SITES){for(const route of [districtRoute({x:0,z:0},site.client),districtRoute(site.client,{x:0,z:0})]){let p=route[0];for(const target of route.slice(1)){for(let i=0;i<2000&&Math.hypot(target.x-p.x,target.z-p.z)>.15;i++){const next=advance(p,{forward:1,strafe:0,yaw:Math.atan2(target.x-p.x,target.z-p.z)},1/30);assert.ok(Math.hypot(next.x-p.x,next.z-p.z)>.001,`${site.id} blocked at ${JSON.stringify(p)}`);p=next;}assert.ok(Math.hypot(target.x-p.x,target.z-p.z)<.2);}}}
});
