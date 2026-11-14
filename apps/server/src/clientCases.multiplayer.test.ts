import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Client,type Room} from '@colyseus/sdk';
import {matchMaker} from '@colyseus/core';
import {ROOM_NAME,CLIENT_CASE_TEMPLATE as T,type ProgressResult} from '@netcity/shared';
import {createGameServer} from './server.js';
import {MemoryProgressStore} from './progress/store.js';
import {refreshCases} from './progress/clientCases.js';
import type {StreetRoom,StreetState} from './StreetRoom.js';
const until=async(check:()=>boolean)=>{const end=Date.now()+5000;while(!check()){if(Date.now()>end)throw Error('Replication timeout');await new Promise(r=>setTimeout(r,20));}};

test('carry ownership, disconnect recovery and shared door authority across real sessions',{timeout:15000},async()=>{
  const store=new MemoryProgressStore(),server=createGameServer({store});
  await server.listen(26796,'127.0.0.1');
  const rooms:Room<StreetState>[]=[];
  try{
    const guest=await store.register();
    await store.transaction(guest.profileId,null,tx=>{refreshCases(tx.data,0);tx.data.service!.cases[0].stage='DIAGNOSED';tx.data.inventory.patch_cord=1;return {ok:true,message:''};});
    const sdk=new Client('ws://127.0.0.1:26796');
    const a=await sdk.joinOrCreate<StreetState>(ROOM_NAME,{guestToken:guest.token});rooms.push(a);
    const b=await sdk.joinOrCreate<StreetState>(ROOM_NAME,{guestToken:guest.token});rooms.push(b);
    const ar:ProgressResult[]=[],br:ProgressResult[]=[],door:ProgressResult[]=[];
    a.onMessage('caseResult',r=>ar.push(r));b.onMessage('caseResult',r=>br.push(r));a.onMessage('interactionResult',r=>door.push(r));
    a.onMessage('profile',()=>{});b.onMessage('profile',()=>{});
    await until(()=>a.state.players.size===2);
    const world=matchMaker.getLocalRoomById(a.roomId) as StreetRoom;
    const pa=world.state.players.get(a.sessionId)!,pb=world.state.players.get(b.sessionId)!;
    const caseId=(await store.read(guest.profileId)).service!.cases[0].id;
    const send=(room:Room<StreetState>,action:string,extra={})=>room.send('case',{action,caseId,requestId:randomUUID(),...extra});
    pa.x=T.hardware.x;pa.z=T.hardware.z;pb.x=T.hardware.x;pb.z=T.hardware.z;
    send(a,'take');await until(()=>ar.length===1);assert.equal(ar[0].ok,true);
    await until(()=>b.state.players.get(a.sessionId)?.heldItem==='patch_cord');
    assert.equal(b.state.players.get(b.sessionId)!.heldItem,'');
    assert.equal('credits' in b.state.players.get(a.sessionId)!,false);
    send(b,'install',{port:2});await until(()=>br.length===1);assert.equal(br[0].ok,false);
    send(b,'drop');await until(()=>br.length===2);assert.equal(br[1].ok,false);
    await a.leave();rooms.splice(rooms.indexOf(a),1);await until(()=>!world.state.players.has(a.sessionId));await (world as any).work.idle();
    let c=(await store.read(guest.profileId)).service!.cases[0];
    assert.equal(c.carrying,false);assert.deepEqual(c.droppedAt,{...T.hardware});
    pb.x=0;pb.z=0;send(b,'take');await until(()=>br.length===3);assert.equal(br[2].ok,false);
    pb.x=T.hardware.x;pb.z=T.hardware.z;send(b,'take');await until(()=>br.length===4);assert.equal(br[3].ok,true);
    send(b,'install',{port:2});await until(()=>br.length===5);assert.equal(br[4].ok,true);
    c=(await store.read(guest.profileId)).service!.cases[0];assert.equal(c.stage,'REPAIRED');assert.equal(c.droppedAt,null);
    // A stale carrier persisted before a process crash must not strand a paid part.
    await store.transaction(guest.profileId,null,tx=>{const c=tx.data.service!.cases[0];c.stage='DIAGNOSED';c.carrying=true;c.carrier='dead-session';c.carryOrigin={...T.shop};return {ok:true,message:''};});
    const d=await sdk.joinOrCreate<StreetState>(ROOM_NAME,{guestToken:guest.token});rooms.push(d);
    await (world as any).work.idle();c=(await store.read(guest.profileId)).service!.cases[0];
    assert.equal(c.carrying,false);assert.deepEqual(c.droppedAt,{...T.shop});
    const dr:ProgressResult[]=[];d.onMessage('interactionResult',r=>dr.push(r));d.onMessage('profile',()=>{});
    const pd=world.state.players.get(d.sessionId)!;
    d.send('interaction',{kind:'door'});await until(()=>dr.length===1);assert.equal(dr[0].ok,false);
    pd.x=7;pd.z=0;pb.x=8;pb.z=0;
    d.send('interaction',{kind:'door'});await until(()=>dr.length===2);assert.equal(dr[1].ok,false);
    pb.x=11;d.send('interaction',{kind:'door'});await until(()=>dr.length===3);assert.equal(dr[2].ok,true);
    await until(()=>!b.state.equipment.officeDoorOpen);
    d.send('interaction',{kind:'liftHeavy'});await until(()=>dr.length===4);assert.equal(dr[3].ok,false);
  }finally{await Promise.all(rooms.map(r=>r.leave().catch(()=>{})));await server.gracefullyShutdown(false);}
});
