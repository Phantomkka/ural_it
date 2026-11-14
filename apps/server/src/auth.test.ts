import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client, type Room } from '@colyseus/sdk';
import { ROOM_NAME } from '@netcity/shared';
import { authContract } from './auth.contract.js';
import { MemoryProgressStore } from './progress/store.js';
import { createGameServer } from './server.js';
import { equal } from './auth/service.js';
import type { StreetState } from './StreetRoom.js';
test('accounts preserve guest progress, hash credentials, reject duplicate binding, expire and revoke sessions', () => authContract(new MemoryProgressStore()));
test('HTTP CSRF, cookie flags and real WebSocket authority survive login, binding and logout', { timeout: 30000 }, async () => {
    const store = new MemoryProgressStore(), server = createGameServer({ store }), base = 'http://127.0.0.1:26807', rooms: Room<StreetState>[] = [];
    await server.listen(26807, '127.0.0.1');
    const until = async (check: () => boolean) => { const end = Date.now() + 5000; while (!check()) {
        if (Date.now() > end)
            throw Error('Timed out');
        await new Promise(r => setTimeout(r, 20));
    } };
    try {
        const guest = await store.register();
        await store.transaction(guest.profileId, null, tx => { tx.data.credits = 91; return { ok: true, message: '' }; });
        const g = await new Client(base).joinOrCreate<StreetState>(ROOM_NAME, { guestToken: guest.token });
        rooms.push(g);
        let guestLeft = false;
        g.onLeave(() => guestLeft = true);
        const gate = await fetch(base + '/auth/session'), preCookie = gate.headers.getSetCookie()[0].split(';')[0], pre = await gate.json() as any;
        assert.equal(gate.headers.get('cache-control'), 'no-store');
        assert.match(gate.headers.getSetCookie()[0], /HttpOnly/);
        assert.match(gate.headers.getSetCookie()[0], /SameSite=Strict/);
        const cross = await fetch(base + '/auth/session', { headers: { Origin: 'https://evil.example' } });
        assert.equal(cross.headers.get('access-control-allow-origin'), null);
        const post = (path: string, body: unknown, cookie = preCookie, token = pre.csrf, origin = base) => fetch(base + '/auth/' + path, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'X-Netcity-CSRF': token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const migrate=await store.register();
        assert.equal((await post('transfer',{guestToken:migrate.token},preCookie,pre.csrf,'https://evil.example')).status,403);
        assert.equal((await post('transfer',{guestToken:migrate.token,preferences:{password:'secret'}})).status,400);
        const transferred=await post('transfer',{guestToken:migrate.token,preferences:{quality:'low'}});assert.equal(transferred.status,200);assert.equal(transferred.headers.get('cache-control'),'no-store');const transfer=await transferred.json() as any;assert.match(transfer.code,/^[a-f0-9]{64}$/);assert.equal(transfer.expiresIn,300);
        const credentials = { login: 'http_' + randomUUID().slice(0, 8), password: 'Long test password 123!', guestToken: guest.token, confirm: true };
        assert.equal((await post('register', credentials, preCookie, 'wrong')).status, 403);
        assert.equal(equal('я'.repeat(64), pre.csrf), false);
        assert.equal((await post('register', credentials, preCookie, pre.csrf, 'https://evil.example')).status, 403);
        assert.equal((await post('register', { ...credentials, profileId: guest.profileId })).status, 400);
        assert.equal((await post('register', { ...credentials, password: 'short' })).status, 400);
        const response = await post('register', credentials), body = await response.json() as any;
        assert.equal(response.status, 200);
        assert.equal(body.token, undefined);
        assert.equal(body.login, credentials.login);
        const cookie = response.headers.getSetCookie().find(c => c.startsWith('netcity_session='))!.split(';')[0];
        assert.match(response.headers.getSetCookie()[0], /HttpOnly/);
        await until(() => guestLeft);
        await assert.rejects(new Client(base).joinOrCreate(ROOM_NAME, { guestToken: guest.token }), (e: any) => e.code === 401);
        const sdk = new Client(base, { headers: { Cookie: cookie, Origin: base } });
        const a = await sdk.joinOrCreate<StreetState>(ROOM_NAME, { account: true, profileId: randomUUID() });
        rooms.push(a);
        let accountLeft = false;
        a.onLeave(() => accountLeft = true);
        const profiles: any[] = [];
        a.onMessage('profile', p => profiles.push(p));
        a.onMessage('progressResult', () => { });
        a.send('progress', { type: 'refresh' });
        await until(() => profiles.length > 0);
        assert.equal(profiles[0].credits, 91);
        const login = await post('login', { login: credentials.login, password: credentials.password }), signed = await login.json() as any;
        assert.equal(login.status, 200);
        const cookie2 = login.headers.getSetCookie().find(c => c.startsWith('netcity_session='))!.split(';')[0];
        assert.notEqual(cookie2, cookie);
        const b = await new Client(base, { headers: { Cookie: cookie2, Origin: base } }).joinOrCreate<StreetState>(ROOM_NAME, { account: true });
        rooms.push(b);
        assert.equal((await post('logout', {}, cookie, body.csrf)).status, 200);
        await until(() => accountLeft);
        assert.ok(b.connection.isOpen);
        await assert.rejects(new Client(base, { headers: { Cookie: cookie, Origin: base } }).joinOrCreate(ROOM_NAME, { account: true }), (e: any) => e.code === 401);
        assert.equal((await post('login', { login: credentials.login, password: 'Definitely incorrect password' })).status, 401);
        assert.equal((await post('login', { login: 'unknown_user', password: 'Definitely incorrect password' })).status, 401);
        const me = await fetch(base + '/auth/session', { headers: { Cookie: cookie2 } });
        assert.equal((await me.json() as any).login, signed.login);
    }
    finally {
        for (const r of rooms)
            if (r.connection.isOpen)
                await r.leave().catch(() => { });
        await server.gracefullyShutdown(false);
    }
});
test('production auth cookies are host-only, Secure and HttpOnly', async () => {
    const old = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let server: ReturnType<typeof createGameServer> | undefined;
    try {
        server = createGameServer();
        await server.listen(26808, '127.0.0.1');
        const r = await fetch('http://127.0.0.1:26808/auth/session');
        const cookie = r.headers.getSetCookie()[0];
        assert.match(cookie, /^__Host-netcity_gate=/);
        assert.match(cookie, /; Secure/);
        assert.match(cookie, /; HttpOnly/);
        assert.match(cookie, /; Path=\//);
        assert.equal(cookie.includes('Domain='), false);
    }
    finally {
        if (old === undefined)
            delete process.env.NODE_ENV;
        else
            process.env.NODE_ENV = old;
        await server?.gracefullyShutdown(false);
    }
});
