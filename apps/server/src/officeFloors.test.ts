import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {matchMaker} from '@colyseus/core';
import {CITY_BUILDINGS,officeLift,officeFloorCount,officeEnvelope,advance} from '@netcity/shared';
import {createGameServer} from './server.js';
import type {StreetRoom,StreetState} from './StreetRoom.js';
const until=async(f:()=>boolean)=>{const end=Date.now()+6000;while(!f()){if(Date.now()>end)throw Error('floor replication timeout');await new Promise(r=>setTimeout(r,20));}};
test('larger offices retain service origins and upper floor movement stays inside walls',()=>{for(const b of CITY_BUILDINGS){const lift=officeLift(b),e=officeEnvelope(b);assert.equal(officeFloorCount(b),b.id==='hq'?2:3);for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){let p={...lift};for(let n=0;n<700;n++)p=advance(p,{forward:1,strafe:0,yaw},1/30,true,undefined,b.id);assert.ok(Math.abs(p.x-e.x)<e.width/2&&Math.abs(p.z-e.z)<6);}}});
test('timed lift replicates travel, freezes movement and rejects remote, freight, busy and downstairs actions',{timeout:20000},async()=>{
 const server=createGameServer();await server.listen(26842,'127.0.0.1');const clients:Room<StreetState>[]=[];
 try{
  const sdk=new Client('ws://127.0.0.1:26842'),a=await sdk.joinOrCreate<StreetState>('street'),b=await sdk.joinOrCreate<StreetState>('street');clients.push(a,b);
  const replies:any[]=[],actions:any[]=[],cases:any[]=[];
  for(const c of clients){c.onMessage('crewState',()=>{});c.onMessage('crewObjects',()=>{});c.onMessage('profile',()=>{});}
  a.onMessage('interactionResult',r=>replies.push(r));a.onMessage('actionResult',r=>actions.push(r));a.onMessage('caseResult',r=>cases.push(r));
  const world=matchMaker.getLocalRoomById(a.roomId) as StreetRoom,p=world.state.players.get(a.sessionId)!,lift=officeLift(CITY_BUILDINGS[2]);
  const travel=async(floor:number,buildingId='building-2')=>{const count=replies.length;a.send('interaction',{kind:'floor',buildingId,floor});await until(()=>replies.length>count);return replies.at(-1);};
  assert.equal((await travel(1)).ok,false);
  Object.assign(p,lift);p.heldItem='crew_parcel';assert.equal((await travel(1)).ok,false);p.heldItem='';
  assert.equal((await travel(1)).ok,true);assert.equal(p.floor,0);assert.equal(p.liftTarget,1);
  await until(()=>b.state.players.get(a.sessionId)?.liftTarget===1);
  a.send('move',{forward:1,strafe:0,yaw:0});a.send('case',{action:'take',caseId:'invented',requestId:'11111111-1111-4111-8111-111111111111'});
  await until(()=>cases.length===1);assert.equal(cases[0].ok,false);assert.match(cases[0].message,/остановки лифта/);assert.equal(cases[0].requestId,'11111111-1111-4111-8111-111111111111');
  await new Promise(r=>setTimeout(r,300));assert.equal(p.x,lift.x);assert.equal(p.z,lift.z);assert.equal((await travel(2)).ok,false);
  await until(()=>b.state.players.get(a.sessionId)?.floor===1);assert.equal(p.liftTarget,-1);
  p.x=18;p.z=0;a.send('equipment',{type:'inspect'});await until(()=>actions.length===1);assert.equal(actions[0].ok,false);
  Object.assign(p,lift);assert.equal((await travel(3)).ok,false);assert.equal((await travel(1,'hq')).ok,false);
  assert.equal((await travel(0)).ok,true);await until(()=>b.state.players.get(a.sessionId)?.floor===0);assert.equal(p.buildingId,'');assert.equal(p.liftTarget,-1);
 }finally{await Promise.all(clients.filter(c=>c.connection.isOpen).map(c=>c.leave()));await server.gracefullyShutdown(false);}
});
