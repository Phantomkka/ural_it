import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AuthService, AuthError, SESSION_AGE } from './auth/service.js';
import { hashToken, type ProgressStore } from './progress/store.js';
import { refreshCases } from './progress/clientCases.js';
export async function authContract(store: ProgressStore) {
    let now = Date.now();
    const auth = new AuthService(store, () => now), name = 'user_' + randomUUID().slice(0, 8), password = 'Correct horse battery 27!';
    const guest = await store.register();
    await store.transaction(guest.profileId, null, tx => { tx.data.credits = 321; tx.data.xp = 160; tx.data.inventory.patch_cord = 3; tx.data.inventory.cleaner = 2; tx.data.tutorialCompleted = true; tx.data.diagnostics = ['003']; refreshCases(tx.data, now); const c = tx.data.service!.cases[0]; c.stage = 'COMPLETED'; c.completedAt = now; c.availableAt = now + 60000; tx.data.service!.completed = 1; return { ok: true, message: '' }; });
    await store.transaction(guest.profileId,null,tx=>{tx.data.cable={id:randomUUID(),stage:'TESTED',points:[{x:11,z:4.8},{x:11,z:0},{x:16,z:0},{x:18,z:0}],endpoint:{x:18,z:0}};return {ok:true,message:''};});
    const before = await store.read(guest.profileId);
    const created = await auth.register({ login: name.toUpperCase(), password, guestToken: guest.token, confirm: true }, 'contract');
    assert.equal(created.login, name);
    assert.equal(await store.identify(guest.token), null);
    assert.deepEqual(await store.read(guest.profileId), before);
    const account = (await store.accounts.find(name))!;
    assert.match(account.passwordHash, /^scrypt\$131072\$8\$1\$/);
    assert.equal(account.passwordHash.includes(password), false);
    assert.equal(account.recoveryHash, hashToken(created.recoveryCode));
    assert.notEqual(account.recoveryHash, created.recoveryCode);
    assert.equal((await auth.current(created.token))?.account.profileId, guest.profileId);
    await assert.rejects(auth.register({ login: name + 'x', password, guestToken: guest.token, confirm: true }, 'contract'), (e: unknown) => e instanceof AuthError && e.status === 409);
    const other = await auth.login({ login: name, password }, 'second-device');
    assert.notEqual(other.token, created.token);
    await auth.logout(created.token);
    assert.equal(await auth.current(created.token), null);
    assert.ok(await auth.current(other.token));
    await assert.rejects(auth.reset({ login: name, password, recoveryCode: '0'.repeat(64) }, 'contract'));
    const reset = await auth.reset({ login: name, password: password + 'new', recoveryCode: created.recoveryCode }, 'contract');
    assert.equal(await auth.current(other.token), null);
    await assert.rejects(auth.login({ login: name, password }, 'contract'), (e: unknown) => e instanceof AuthError && e.status === 401);
    const renewed = await auth.login({ login: name, password: password + 'new' }, 'contract');
    await assert.rejects(auth.reset({ login: name, password, recoveryCode: created.recoveryCode }, 'contract'));
    // Password reset and session insertion serialize on the account record.
    assert.equal(await store.accounts.addSession({ hash: hashToken('old-verification'), accountId: account.id, createdAt: now, expiresAt: now + 1000 }, account.passwordHash), false);
    now += SESSION_AGE;
    assert.equal(await auth.current(renewed.token), null);
    assert.deepEqual(await store.read(guest.profileId), before);
    const fresh = await store.register(), prefix = 'race_' + randomUUID().slice(0, 7);
    const race = await Promise.allSettled([0, 1].map(i => auth.register({ login: prefix + i, password, guestToken: fresh.token, confirm: true }, 'race')));
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(race.filter(r => r.status === 'rejected' && r.reason instanceof AuthError && r.reason.status === 409).length, 1);
    // Origin migration is one-use, preserves the same profile, and never merges balances.
    const migrant=await store.register(), migrantBefore=await store.read(migrant.profileId);
    const oldCode=await store.accounts.issueTransfer(migrant.token,{quality:'low'});
    const code=await store.accounts.issueTransfer(migrant.token,{quality:'high',tutorialDone:true});
    await assert.rejects(auth.register({login:prefix+'old',password,transferCode:oldCode,confirm:true},'transfer-old'));
    assert.equal(await store.identify(migrant.token),migrant.profileId);
    // A login conflict rolls the claim back, leaving its one-use code usable.
    await assert.rejects(auth.register({login:name,password,transferCode:code,confirm:true},'transfer-conflict'));
    assert.equal(await store.identify(migrant.token),migrant.profileId);
    const transfers=await Promise.allSettled([0,1].map(i=>auth.register({login:prefix+'t'+i,password,transferCode:code,confirm:true},'transfer-race')));
    assert.equal(transfers.filter(r=>r.status==='fulfilled').length,1);
    const winner=transfers.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<AuthService['register']>>>;
    assert.deepEqual(winner.value.preferences,{quality:'high',tutorialDone:true});
    assert.equal((await auth.current(winner.value.token))?.account.profileId,migrant.profileId);
    assert.equal(await store.identify(migrant.token),null);
    assert.deepEqual(await store.read(migrant.profileId),migrantBefore);
    await assert.rejects(store.accounts.issueTransfer(migrant.token,{}));
    await assert.rejects(auth.register({login:prefix+'again',password,transferCode:code,confirm:true},'transfer-reuse'));
    await assert.rejects(auth.register({login:prefix+'bad',password,confirm:true,preferences:{password:'forbidden'}},'transfer-prefs'));
    const bounded = 'limit_' + randomUUID().slice(0, 7);
    for (let i = 0; i < 8; i++)
        await auth.throttle('rate-ip', bounded);
    await assert.rejects(new AuthService(store, () => now).throttle('other-ip', bounded), (e: unknown) => e instanceof AuthError && e.status === 429);
    for (let i = 0; i < 30; i++)
        await auth.throttle('shared-ip', 'different-' + i);
    await assert.rejects(auth.throttle('shared-ip', 'last'), (e: unknown) => e instanceof AuthError && e.status === 429);
}
