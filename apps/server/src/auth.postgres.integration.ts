import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresProgressStore } from './progress/postgres.js';
import { AuthService } from './auth/service.js';
import { authContract } from './auth.contract.js';
test('PostgreSQL accounts migrate once, bind transactionally and retain hashed sessions across pool restart', { timeout: 60000 }, async () => {
    const base = process.env.TEST_DATABASE_URL;
    if (!base)
        throw Error('TEST_DATABASE_URL required');
    const admin = new Pool({ connectionString: base }), schema = 'auth_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(base);
    url.searchParams.set('options', `-c search_path=${schema}`);
    let store = new PostgresProgressStore(url.toString());
    try {
        await store.migrate();
        await store.migrate();
        await authContract(store);
        const expiring=await store.register(),expired=await store.accounts.issueTransfer(expiring.token,{});
        await store.pool.query('UPDATE guest_transfers SET expires_at=$1 WHERE token_hash=$2',[Date.now()-1,(await import('./progress/store.js')).hashToken(expired)]);
        await assert.rejects(new AuthService(store).register({login:'expired_transfer',password:'Expired transfer secret 123!',transferCode:expired,confirm:true},'expire'));
        assert.equal(await store.identify(expiring.token),expiring.profileId);
        const auth = new AuthService(store), name = 'persist_' + randomUUID().slice(0, 8), guest = await store.register();
        const r = await auth.register({ login: name, password: 'Persistence secret 123!', confirm: true, guestToken: guest.token }, 'persist');
        const row = (await store.pool.query('SELECT * FROM account_sessions WHERE account_id=(SELECT id FROM accounts WHERE login=$1)', [name])).rows[0];
        assert.notEqual(row.token_hash, r.token);
        assert.equal(JSON.stringify(row).includes(r.token), false);
        const counts = await store.pool.query('SELECT count(*)::int AS n FROM profiles WHERE id=$1', [guest.profileId]);
        assert.equal(counts.rows[0].n, 1);
        await store.close();
        store = new PostgresProgressStore(url.toString());
        const restarted = new AuthService(store);
        assert.equal((await restarted.current(r.token))?.account.profileId, guest.profileId);
        assert.equal(await store.identify(guest.token), null);
        await restarted.logout(r.token);
        assert.equal(await restarted.current(r.token), null);
    }
    finally {
        await store.close();
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        await admin.end();
    }
});
