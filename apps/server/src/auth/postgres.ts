import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { hashToken, newProfile } from '../progress/store.js';
import { AuthConflict, type Account, type AccountStore, type Session } from './store.js';
const account = (r: any): Account => ({ id: r.id, login: r.login, profileId: r.profile_id, passwordHash: r.password_hash, recoveryHash: r.recovery_hash, guestHash: r.guest_hash,preferences:r.preferences??{} });
export class PostgresAccountStore implements AccountStore {
    constructor(private pool: Pool) { }
    async create(login: string, passwordHash: string, recoveryHash: string, guestToken?: string,transferCode?:string,prefs:Record<string,unknown>={}) {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            let profileId: string, guestHash: string | null = null;
            // Always lock the profile before a transfer row, matching issueTransfer.
            // Recheck the code after locking: a second redemption must never create a profile.
            if(transferCode){
                const preview=await c.query('SELECT profile_id FROM guest_transfers WHERE token_hash=$1',[hashToken(transferCode)]);
                if(!preview.rowCount)throw new AuthConflict('Код переноса истёк или уже использован.');
                await c.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[preview.rows[0].profile_id]);
                const transfer=await c.query('SELECT * FROM guest_transfers WHERE token_hash=$1 AND expires_at>$2 FOR UPDATE',[hashToken(transferCode),Date.now()]);
                if(!transfer.rowCount)throw new AuthConflict('Код переноса истёк или уже использован.');
                guestHash=transfer.rows[0].guest_hash;prefs=transfer.rows[0].preferences;
            }
            if (guestToken||guestHash) {
                guestHash = guestHash??hashToken(guestToken!);
                const r = await c.query('SELECT id FROM profiles WHERE token_hash=$1 FOR UPDATE', [guestHash]);
                if (!r.rowCount)
                    throw new AuthConflict('Логин занят или гостевой профиль уже привязан.');
                profileId = r.rows[0].id;
                await c.query('UPDATE profiles SET token_hash=$2 WHERE id=$1', [profileId, hashToken(randomBytes(32).toString('hex'))]);
            }
            else {
                const p = newProfile();
                profileId = p.id;
                await c.query('INSERT INTO profiles(id,token_hash,nickname,inventory,jobs) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)', [p.id, hashToken(randomBytes(32).toString('hex')), p.nickname, JSON.stringify(p.inventory), JSON.stringify(p.jobs)]);
            }
            const r = await c.query('INSERT INTO accounts(id,login,profile_id,password_hash,recovery_hash,guest_hash,preferences) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *', [randomUUID(), login, profileId, passwordHash, recoveryHash, guestHash,JSON.stringify(prefs)]);
            if(guestHash)await c.query("DELETE FROM guest_transfers WHERE guest_hash=$1",[guestHash]);
            await c.query('COMMIT');
            return account(r.rows[0]);
        }
        catch (e) {
            await c.query('ROLLBACK');
            if ((e as {
                code?: string;
            }).code === '23505')
                throw new AuthConflict('Логин занят или гостевой профиль уже привязан.');
            throw e;
        }
        finally {
            c.release();
        }
    }
    async issueTransfer(token:string,prefs:Record<string,unknown>){const c=await this.pool.connect();try{await c.query('BEGIN');const rows=await c.query('SELECT id FROM profiles WHERE token_hash=$1 FOR UPDATE',[hashToken(token)]);if(!rows.rowCount)throw new AuthConflict('Гость уже привязан или не найден.');const code=randomBytes(32).toString('hex');await c.query('DELETE FROM guest_transfers WHERE profile_id=$1 OR expires_at<=$2',[rows.rows[0].id,Date.now()]);await c.query('INSERT INTO guest_transfers(token_hash,guest_hash,profile_id,preferences,expires_at) VALUES($1,$2,$3,$4::jsonb,$5)',[hashToken(code),hashToken(token),rows.rows[0].id,JSON.stringify(prefs),Date.now()+300000]);await c.query('COMMIT');return code;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
    async find(login: string) { const r = await this.pool.query('SELECT * FROM accounts WHERE login=$1', [login]); return r.rowCount ? account(r.rows[0]) : null; }
    async wasGuest(hash: string) { return !!(await this.pool.query('SELECT 1 FROM accounts WHERE guest_hash=$1', [hash])).rowCount; }
    async addSession(s: Session, passwordHash: string) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        const a = await c.query('SELECT password_hash FROM accounts WHERE id=$1 FOR UPDATE', [s.accountId]);
        if (a.rows[0]?.password_hash !== passwordHash) {
            await c.query('ROLLBACK');
            return false;
        }
        await c.query('DELETE FROM account_sessions WHERE expires_at <= $1', [Date.now()]);
        await c.query('INSERT INTO account_sessions(token_hash,account_id,created_at,expires_at) VALUES($1,$2,$3,$4)', [s.hash, s.accountId, s.createdAt, s.expiresAt]);
        await c.query('COMMIT');
        return true;
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    } }
    async session(hash: string, now: number) { const r = await this.pool.query('SELECT a.*,s.token_hash,s.created_at,s.expires_at FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>$2', [hash, now]); if (!r.rowCount)
        return null; const row = r.rows[0]; return { account: account(row), session: { hash: row.token_hash, accountId: row.id, createdAt: Number(row.created_at), expiresAt: Number(row.expires_at) } }; }
    async revoke(hash: string) { await this.pool.query('DELETE FROM account_sessions WHERE token_hash=$1', [hash]); }
    async reset(id: string, recoveryHash: string, passwordHash: string, nextRecoveryHash: string) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        const r = await c.query('UPDATE accounts SET password_hash=$3,recovery_hash=$4 WHERE id=$1 AND recovery_hash=$2 RETURNING id', [id, recoveryHash, passwordHash, nextRecoveryHash]);
        if (r.rowCount)
            await c.query('DELETE FROM account_sessions WHERE account_id=$1', [id]);
        await c.query('COMMIT');
        return !!r.rowCount;
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    } }
    async consume(key: string, limit: number, windowMs: number, now: number) {
        await this.pool.query('DELETE FROM auth_buckets WHERE expires_at <= $1', [now]);
        const r = await this.pool.query('INSERT INTO auth_buckets(bucket,count,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN auth_buckets.expires_at<=$3 THEN 1 ELSE LEAST(auth_buckets.count+1,$4+1) END,expires_at=CASE WHEN auth_buckets.expires_at<=$3 THEN $2 ELSE auth_buckets.expires_at END RETURNING count', [key, now + windowMs, now, limit]);
        return r.rows[0].count <= limit;
    }
}
