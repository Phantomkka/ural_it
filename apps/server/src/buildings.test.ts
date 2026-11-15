import {test} from 'node:test';import assert from 'node:assert/strict';import {Client} from '@colyseus/sdk';import {matchMaker} from '@colyseus/core';
import {CITY_BUILDINGS,CITY_DOORS,advance,TICK_RATE,insideBuilding} from '@netcity/shared';import {createDoors} from './doorsState.js';import {createGameServer} from './server.js';import type {StreetRoom,StreetState} from './StreetRoom.js';
test('every district building has a walkable entrance, solid walls and a closing door',()=>{
 const doors=createDoors();for(const b of CITY_BUILDINGS.filter(b=>b.id!=='hq')){
  const side=Math.sign(b.x),d=doors.get(b.id)!;let p={x:side*6.7,z:b.z};const input={forward:1,strafe:0,yaw:side*Math.PI/2};
  for(let i=0;i<30;i++)p=advance(p,input,1/TICK_RATE,true,doors);assert.equal(insideBuilding(p,b.id),false,b.id+' closed');
  d.open=true;for(let i=0;i<24;i++)p=advance(p,input,1/TICK_RATE,true,doors);assert.equal(insideBuilding(p,b.id),true,b.id+' entered');
  let wall={x:side*6.7,z:b.z+3};for(let i=0;i<30;i++)wall=advance(wall,input,1/TICK_RATE,true,doors);assert.equal(insideBuilding(wall,b.id),false,'cannot phase through facade');
 }
});
test('two clients replicate district doors; remote toggles and closing on a player are rejected',{timeout:15000},async()=>{
 const server=createGameServer();await server.listen(26812,'127.0.0.1');const rooms=[];const until=async(f:()=>boolean)=>{const end=Date.now()+5000;while(!f()){if(Date.now()>end)throw Error('timeout');await new Promise(r=>setTimeout(r,20));}};
 try{const sdk=new Client('ws://127.0.0.1:26812'),a=await sdk.joinOrCreate<StreetState>('street'),b=await sdk.joinOrCreate<StreetState>('street');rooms.push(a,b);const w=matchMaker.getLocalRoomById(a.roomId) as StreetRoom,p=w.state.players.get(a.sessionId)!,q=w.state.players.get(b.sessionId)!,d=CITY_DOORS[0];const result:any[]=[];a.onMessage('interactionResult',r=>result.push(r));
 a.send('interaction',{kind:'cityDoor',id:d.id});await until(()=>result.length===1);assert.equal(result[0].ok,false);await new Promise(r=>setTimeout(r,810));
 Object.assign(p,{x:d.x-Math.sign(d.x)*1.2,z:d.z});a.send('interaction',{kind:'cityDoor',id:d.id});await until(()=>result.length===2);assert.equal(result[1].ok,true);await until(()=>b.state.doors.get(d.id)?.open===true);
 Object.assign(q,{x:d.x,z:d.z});await new Promise(r=>setTimeout(r,810));a.send('interaction',{kind:'cityDoor',id:d.id});await until(()=>result.length===3);assert.equal(result[2].ok,false);assert.equal(w.state.doors.get(d.id)?.open,true);
 }finally{for(const r of rooms)if(r.connection.isOpen)await r.leave();await server.gracefullyShutdown(false);}
});
