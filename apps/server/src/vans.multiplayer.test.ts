import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {Client,type Room} from '@colyseus/sdk';import {matchMaker} from '@colyseus/core';
import {createGameServer} from './server.js';import {MemoryProgressStore} from './progress/store.js';import type {StreetRoom,StreetState} from './StreetRoom.js';
const until=async(f:()=>boolean)=>{const end=Date.now()+7000;while(!f()){if(Date.now()>end)throw Error('van replication timeout');await new Promise(r=>setTimeout(r,20));}};
test('two-client van authority rejects foreign ownership, forgery and mid-drive work; disconnect stops and restores owned pose',{timeout:20000},async()=>{
 const store=new MemoryProgressStore(),server=createGameServer({store}),rooms:Room<StreetState>[]=[];await server.listen(26843,'127.0.0.1');
 try{
  const users=await Promise.all([store.register(),store.register()]),sdk=new Client('ws://127.0.0.1:26843'),a=await sdk.joinOrCreate<StreetState>('street',{guestToken:users[0].token}),b=await sdk.joinOrCreate<StreetState>('street',{guestToken:users[1].token});rooms.push(a,b);
  const answers=[new Map<string,any>(),new Map<string,any>()],cases:any[]=[];
  rooms.forEach((r,i)=>{r.reconnection.enabled=false;r.onMessage('vanResult',v=>answers[i].set(v.requestId,v));r.onMessage('crewState',()=>{});r.onMessage('crewObjects',()=>{});r.onMessage('profile',()=>{});});a.onMessage('caseResult',v=>cases.push(v));
  const send=async(i:number,value:Record<string,unknown>)=>{const requestId=randomUUID();rooms[i].send('van',{...value,requestId});await until(()=>answers[i].has(requestId));return answers[i].get(requestId);};
  assert.equal((await send(0,{action:'request'})).ok,true);await until(()=>b.state.vans.size===1);const id=[...b.state.vans.keys()][0],world=matchMaker.getLocalRoomById(a.roomId) as StreetRoom,p=world.state.players.get(a.sessionId)!,v=world.state.vans.get(id)!;
  assert.equal((await send(1,{action:'enter'})).ok,false);assert.equal((await send(1,{action:'enter',vanId:id,x:v.x,z:v.z})).ok,false);
  p.x=v.x-1.6;p.z=v.z;assert.equal((await send(0,{action:'enter'})).ok,true);await until(()=>b.state.players.get(a.sessionId)?.vehicleId===id);assert.equal(v.driver,a.sessionId);
  a.send('move',{forward:1,strafe:0,yaw:0});await until(()=>v.speed>.3);assert.ok(v.speed<=10);assert.equal(p.x,v.x);assert.equal(p.z,v.z);assert.equal((await send(0,{action:'exit'})).ok,false);
  const requestId=randomUUID();a.send('case',{action:'accept',caseId:randomUUID(),requestId});await until(()=>cases.length===1);assert.equal(cases[0].ok,false);assert.equal(cases[0].requestId,requestId);
  await a.leave();await until(()=>!world.state.players.has(a.sessionId));await until(()=>!world.state.vans.has(id));const data=await store.read(users[0].profileId);assert.equal(data.business!.logistics!.van!.id,id);assert.equal(data.business!.logistics!.van!.pose.speed,0);assert.ok(data.business!.logistics!.van!.odometer!>0,'actual driven distance persists across disconnect');
  const re=await sdk.joinOrCreate<StreetState>('street',{guestToken:users[0].token});rooms.push(re);re.reconnection.enabled=false;re.onMessage('crewState',()=>{});re.onMessage('crewObjects',()=>{});re.onMessage('profile',()=>{});await until(()=>!!re.state.vans?.has(id));assert.equal(re.state.vans.get(id)!.driver,'');assert.equal(re.state.vans.get(id)!.speed,0);
 }finally{await Promise.all(rooms.filter(r=>r.connection.isOpen).map(r=>r.leave()));await server.gracefullyShutdown(false);}
});
