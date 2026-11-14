import { randomUUID } from 'node:crypto';
export interface Account {
    id: string;
    login: string;
    profileId: string;
    passwordHash: string;
    recoveryHash: string;
    guestHash: string | null;
}
export interface Session {
    hash: string;
    accountId: string;
    createdAt: number;
    expiresAt: number;
}
export interface AccountStore {
    create(login: string, passwordHash: string, recoveryHash: string, guestToken?: string): Promise<Account>;
    find(login: string): Promise<Account | null>;
    wasGuest(hash: string): Promise<boolean>;
    addSession(session: Session, passwordHash: string): Promise<boolean>;
    session(hash: string, now: number): Promise<{
        account: Account;
        session: Session;
    } | null>;
    revoke(hash: string): Promise<void>;
    reset(id: string, recoveryHash: string, passwordHash: string, nextRecoveryHash: string): Promise<boolean>;
    consume(key: string, limit: number, windowMs: number, now: number): Promise<boolean>;
}
export class AuthConflict extends Error {
}
/** The profile callback runs on the progress adapter's transaction queue. */
export class MemoryAccountStore implements AccountStore {
    private accounts = new Map<string, Account>();
    private sessions = new Map<string, Session>();
    private buckets = new Map<string, {
        count: number;
        expires: number;
    }>();
    private tail: Promise<unknown> = Promise.resolve();
    constructor(private claim: (token?: string) => Promise<{
        profileId: string;
        guestHash: string | null;
    }>) { }
    async create(login: string, passwordHash: string, recoveryHash: string, guestToken?: string) {
        const task = this.tail.then(async () => {
            if (this.accounts.has(login))
                throw new AuthConflict('Логин занят или гостевой профиль уже привязан.');
            const profile = await this.claim(guestToken);
            const account = { id: randomUUID(), login, passwordHash, recoveryHash, ...profile };
            this.accounts.set(login, account);
            return structuredClone(account);
        });
        this.tail = task.catch(() => { });
        return task;
    }
    async find(login: string) { await this.tail; return structuredClone(this.accounts.get(login) ?? null); }
    async wasGuest(hash: string) { await this.tail; return [...this.accounts.values()].some(a => a.guestHash === hash); }
    async addSession(s: Session, passwordHash: string) { const a = [...this.accounts.values()].find(a => a.id === s.accountId); if (!a || a.passwordHash !== passwordHash)
        return false; this.sessions.set(s.hash, structuredClone(s)); return true; }
    async session(hash: string, now: number) { const s = this.sessions.get(hash); if (!s || s.expiresAt <= now) {
        this.sessions.delete(hash);
        return null;
    } const a = [...this.accounts.values()].find(a => a.id === s.accountId); return a ? structuredClone({ account: a, session: s }) : null; }
    async revoke(hash: string) { this.sessions.delete(hash); }
    async reset(id: string, recoveryHash: string, passwordHash: string, nextRecoveryHash: string) {
        const a = [...this.accounts.values()].find(a => a.id === id && a.recoveryHash === recoveryHash);
        if (!a)
            return false;
        a.passwordHash = passwordHash;
        a.recoveryHash = nextRecoveryHash;
        for (const [key, s] of this.sessions)
            if (s.accountId === id)
                this.sessions.delete(key);
        return true;
    }
    async consume(key: string, limit: number, windowMs: number, now: number) {
        for (const [k, b] of this.buckets)
            if (b.expires <= now)
                this.buckets.delete(k);
        if (this.buckets.size >= 10000 && !this.buckets.has(key))
            return false;
        const b = this.buckets.get(key) ?? { count: 0, expires: now + windowMs };
        b.count = Math.min(limit + 1, b.count + 1);
        this.buckets.set(key, b);
        return b.count <= limit;
    }
}
