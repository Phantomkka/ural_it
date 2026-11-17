import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client, type Room } from '@colyseus/sdk';
import { matchMaker } from '@colyseus/core';
import { ROOM_NAME, CABLE_SOURCE } from '@netcity/shared';
import { cableContract,physicalCableContract } from './cable.contract.js';
import { MemoryProgressStore } from './progress/store.js';
import { createGameServer } from './server.js';
import type { StreetState, StreetRoom } from './StreetRoom.js';
test('cable route, length, ownership, persistence and replay contract', () => cableContract(new MemoryProgressStore()));
test('real session cannot stretch cable through walls; disconnect saves its physical endpoint', { timeout: 15000 }, async () => {
    const store = new MemoryProgressStore(), server = createGameServer({ store }), guest = await store.register();
    let a: Room<StreetState> | undefined, b: Room<StreetState> | undefined;
    await server.listen(26809, '127.0.0.1');
    const until = async (f: () => boolean) => { const end = Date.now() + 5000; while (!f()) {
        if (Date.now() > end)
            throw Error('timeout');
        await new Promise(r => setTimeout(r, 20));
    } };
    try {
        const sdk = new Client('ws://127.0.0.1:26809');
        a = await sdk.joinOrCreate(ROOM_NAME, { guestToken: guest.token });
        const world = matchMaker.getLocalRoomById(a.roomId) as StreetRoom, p = world.state.players.get(a.sessionId)!;
        Object.assign(p, CABLE_SOURCE);
        const results: any[] = [];
        a.onMessage('cableResult', r => results.push(r));
        a.onMessage('cableHint', () => { });
        a.onMessage('profile', () => { });
        a.send('cable', { action: 'take', requestId: randomUUID() });
        await until(() => results.length === 1);
        assert.equal(results[0].ok, true);
        const next = (world as any).work.constrainMove(a.sessionId, p, { x: 16, z: 0 });
        assert.deepEqual(next, { ...CABLE_SOURCE });
        assert.equal(p.heldItem, 'cable_roll');
        assert.ok(p.cablePath.length < 1000);
        p.z = 2;
        await a.leave();
        a = undefined;
        await (world as any).work.idle();
        const saved = (await store.read(guest.profileId)).cable!;
        assert.equal(saved.carrier, undefined);
        assert.deepEqual(saved.endpoint, { x: 11, z: 2 });
        b = await sdk.joinOrCreate(ROOM_NAME, { guestToken: guest.token });
        b.onMessage('profile', () => { });
        const br: any[] = [];
        b.onMessage('cableResult', r => br.push(r));
        b.send('cable', { action: 'take', requestId: randomUUID() });
        await until(() => br.length === 1);
        assert.equal(br[0].ok, false);
    }
    finally {
        if (a?.connection.isOpen)
            await a.leave();
        if (b?.connection.isOpen)
            await b.leave();
        await server.gracefullyShutdown(false);
    }
});

test('physical cable free routing and transactional switch ports',()=>physicalCableContract(new MemoryProgressStore()));

test('free cable keeps movement unrestricted and updates authoritative switch revision once',async()=>{
 const store=new MemoryProgressStore(),server=createGameServer({store}),guest=await store.register();let client:Room<StreetState>|undefined;
 await server.listen(26819,'127.0.0.1');
 try{
  client=await new Client('ws://127.0.0.1:26819').joinOrCreate(ROOM_NAME,{guestToken:guest.token});
  const room=matchMaker.getLocalRoomById(client.roomId) as StreetRoom,p=room.state.players.get(client.sessionId)!;
  const replies:any[]=[];client.onMessage('cableResult',r=>replies.push(r));client.onMessage('cablePorts',()=>{});client.onMessage('profile',()=>{});
  const send=async(value:unknown)=>{const before=replies.length;client!.send('cable',value);const end=Date.now()+5000;while(replies.length===before){assert.ok(Date.now()<end);await new Promise(r=>setTimeout(r,15));}return replies.at(-1);};
  Object.assign(p,{x:11.5,z:-5.25});assert.equal((await send({action:'take',sourceId:'client-pc04',requestId:randomUUID()})).ok,true);
  assert.deepEqual((room as any).work.constrainMove(client.sessionId,p,{x:18,z:0}),{x:18,z:0});
  Object.assign(p,{x:18,z:0});const sw=room.state.devices.get('switch')!,before=sw.revision,request={action:'terminate',port:5,requestId:randomUUID()};
  assert.equal((await send(request)).ok,true);assert.equal(sw.revision,before+1);
  assert.equal((await send(request)).replayed,true);assert.equal(sw.revision,before+1);
  assert.equal(JSON.parse(p.cablePath).routing,'free');assert.equal(JSON.parse(p.cablePath).caseId,undefined);
  await send({action:'reset',requestId:randomUUID()});assert.equal(sw.revision,before+2);
 }finally{if(client?.connection.isOpen)await client.leave();await server.gracefullyShutdown(false);}
});
