import {test} from 'node:test';import assert from 'node:assert/strict';
import {createProps,handleProp} from './propsState.js';import {propBlocks,propFloor} from '@netcity/shared';
import {Client} from '@colyseus/sdk';import {matchMaker} from '@colyseus/core';import {createGameServer} from './server.js';import type {StreetRoom,StreetState} from './StreetRoom.js';
test('carry objects reserve once, reject remote or occupied hands and use safe authoritative drops',()=>{
 const props=createProps(),p={x:0,z:0,yaw:0,heldItem:''},v={kind:'takeProp',id:'toolbox'};
 assert.equal(handleProp(props,p,'a',v,true,[]).ok,false);
 Object.assign(p,{x:18,z:-4.5});assert.equal(handleProp(props,p,'a',v,true,[]).ok,true);
 assert.equal(propBlocks(p,props.get('toolbox')!),false);
 assert.equal(handleProp(props,{...p,heldItem:''},'b',v,true,[]).ok,false);
 assert.equal(handleProp(props,p,'a',{kind:'takeProp',id:'parcel'},true,[]).ok,false);
 assert.equal(handleProp(props,p,'a',{kind:'dropProp',x:100},true,[]).ok,false);
 assert.equal(handleProp(props,p,'a',{kind:'dropProp'},true,[]).ok,true);
 const box=props.get('toolbox')!;assert.equal(box.holder,'');assert.equal(p.heldItem,'');assert.equal(propFloor(box,true),true);assert.equal(propBlocks(box,box),true);
 assert.equal(propFloor({x:8,z:0},false),false);assert.equal(propFloor({x:100,z:0},true),false);
});
test('two real clients share traffic and prop authority, release on disconnect', {timeout:15000},async()=>{
 const server=createGameServer();await server.listen(26810,'127.0.0.1');const rooms=[];
 const until=async(f:()=>boolean)=>{const end=Date.now()+4000;while(!f()){if(Date.now()>end)throw Error('timeout');await new Promise(r=>setTimeout(r,20));}};
 try{const sdk=new Client('ws://127.0.0.1:26810'),a=await sdk.joinOrCreate<StreetState>('street'),b=await sdk.joinOrCreate<StreetState>('street');rooms.push(a,b);
 const world=matchMaker.getLocalRoomById(a.roomId) as StreetRoom;const p=world.state.players.get(a.sessionId)!,q=world.state.players.get(b.sessionId)!;Object.assign(p,{x:18,z:-4.5});Object.assign(q,{x:18,z:-4.5});
 const ar:any[]=[],br:any[]=[];a.onMessage('interactionResult',r=>ar.push(r));b.onMessage('interactionResult',r=>br.push(r));a.send('interaction',{kind:'takeProp',id:'toolbox'});await until(()=>ar.length===1);assert.equal(ar[0].ok,true);
 b.send('interaction',{kind:'takeProp',id:'toolbox'});await until(()=>br.length===1);assert.equal(br[0].ok,false);await until(()=>b.state.props?.get('toolbox')?.holder===a.sessionId);assert.equal(b.state.cars.size,6);assert.equal(a.state.cars.size,6);
 const result:any[]=[];a.onMessage('cableResult',r=>result.push(r));a.send('cable',{action:'take',requestId:'00000000-0000-4000-8000-000000000001'});await until(()=>result.length===1);assert.equal(result[0].ok,false);
 await a.leave();await until(()=>world.state.props.get('toolbox')?.holder==='');assert.equal(world.state.props.get('toolbox')?.x,p.x);
 }finally{for(const r of rooms)if(r.connection.isOpen)await r.leave();await server.gracefullyShutdown(false);}
});
