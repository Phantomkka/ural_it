import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Client,type Room} from '@colyseus/sdk';import {matchMaker} from '@colyseus/core';
import {CREW_SHOP,CREW_CATALOG,type CrewView,type CrewIntent,type ProgressResult,type CrewObject} from '@netcity/shared';
import {createGameServer} from './server.js';import {MemoryProgressStore} from './progress/store.js';import type {StreetRoom,StreetState} from './StreetRoom.js';
const until=async(check:()=>boolean)=>{const end=Date.now()+6000;while(!check()){if(Date.now()>end)throw Error('Crew replication timeout');await new Promise(r=>setTimeout(r,20));}};
test('five real clients share tasks, one parcel custody and disconnect handoff; sixth member rejected',{timeout:30000},async()=>{
 const store=new MemoryProgressStore(),server=createGameServer({store}),rooms:Room<StreetState>[]=[],views:(CrewView|null)[]=[],results:Map<string,ProgressResult>[]=[],objects:CrewObject[][]=[];await server.listen(26841,'127.0.0.1');
 try{
  const guests=await Promise.all(Array.from({length:6},()=>store.register()));for(let i=0;i<6;i++){const r=await new Client('ws://127.0.0.1:26841').joinOrCreate<StreetState>('street',{guestToken:guests[i].token});r.reconnection.enabled=false;rooms.push(r);results[i]=new Map();r.onMessage('crewState',v=>views[i]=v);r.onMessage('crewResult',v=>results[i].set(v.requestId,v));r.onMessage('crewObjects',v=>objects[i]=v);r.onMessage('profile',()=>{});}
  const world=matchMaker.getLocalRoomById(rooms[0].roomId) as StreetRoom;await (world as any).work.idle();await until(()=>rooms[0].state.players.size===6);
  const send=async(i:number,intent:CrewIntent)=>{const requestId=randomUUID();rooms[i].send('crew',{...intent,requestId});await until(()=>results[i].has(requestId));return results[i].get(requestId)!;};
  assert.equal((await send(0,{action:'create',templateId:'building-2-security'})).ok,true);await until(()=>!!views[0]);const code=views[0]!.code;
  assert.ok((await Promise.all([1,2,3,4].map(i=>send(i,{action:'join',code})))).every(r=>r.ok));assert.equal((await send(5,{action:'join',code})).ok,false);await until(()=>views[4]?.members.length===5);
  assert.equal((await send(0,{action:'launch',code})).ok,true);
  const place=(i:number,p:{x:number;z:number})=>Object.assign(world.state.players.get(rooms[i].sessionId)!,p);
  for(let step=0;step<2;step++){const s=views[0]!.tasks[0].steps[step];place(0,s.point);assert.equal((await send(0,{action:'work',code,taskId:'survey',step,...(s.choice?{choice:s.choice}:{})})).ok,true);if(s.wait){await new Promise(r=>setTimeout(r,(s.wait??0)+30));assert.equal((await send(0,{action:'work',code,taskId:'survey',step,choice:s.choice})).ok,true);}}
  place(1,CREW_SHOP);assert.equal((await send(1,{action:'order',code,taskId:'delivery-0'})).ok,true);await until(()=>!!views[2]?.tasks[1].orderedAt);place(2,CREW_SHOP);await new Promise(r=>setTimeout(r,8100));
  assert.equal((await send(2,{action:'pickup',code,taskId:'delivery-0'})).ok,true);await until(()=>rooms[3].state.players.get(rooms[2].sessionId)?.heldItem==='crew_parcel');assert.equal((await send(3,{action:'pickup',code,taskId:'delivery-0'})).ok,false);
  place(2,{x:-14,z:0});await rooms[2].leave();await until(()=>!world.state.players.has(rooms[2].sessionId));await (world as any).work.idle();await until(()=>views[3]?.tasks[1].carriedBy===undefined);place(3,{x:-14,z:0});assert.equal((await send(3,{action:'pickup',code,taskId:'delivery-0'})).ok,true);
  place(3,views[3]!.tasks[1].steps[0].point);assert.equal((await send(3,{action:'work',code,taskId:'delivery-0',step:0})).ok,true);await until(()=>views[4]?.tasks[1].done===true);await until(()=>rooms[4].state.players.get(rooms[3].sessionId)?.heldItem==='');
  const publicData=JSON.stringify(objects[4]);assert.ok(!publicData.includes(code));for(const g of guests)assert.ok(!publicData.includes(g.profileId));assert.equal('credits' in rooms[4].state.players.get(rooms[0].sessionId)!,false);
 }finally{await Promise.all(rooms.filter(r=>r.connection.isOpen).map(r=>r.leave().catch(()=>{})));await server.gracefullyShutdown(false);}
});
