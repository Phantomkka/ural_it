import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { ServerError, type AuthContext, type Client } from '@colyseus/core';
import { hashToken, validToken, type ProgressStore } from '../progress/store.js';
import { AuthConflict, type Account } from './store.js';
import { AuthError, hashPassword, verifyPassword, loginName, validPassword } from './password.js';
import {preferences} from './preferences.js';
export { AuthError };
export interface GameIdentity {
    profileId: string;
    sessionHash?: string;
    accountId?: string;
    guestToken?: string;
    expiresAt?: number;
}
export const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
export const nonce = () => randomBytes(32).toString('hex');
export const csrf = (token: string) => createHmac('sha256', token).update('NETCITY-CSRF-v1').digest('hex');
export const equal = (a: unknown, b: string) => typeof a === 'string' && /^[a-f0-9]{64}$/.test(a) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export class AuthService {
    readonly production = process.env.NODE_ENV === 'production';
    readonly cookie = this.production ? '__Host-netcity_session' : 'netcity_session';
    readonly gate = this.production ? '__Host-netcity_gate' : 'netcity_gate';
    private watches = new Set<{
        identity: GameIdentity;
        close: () => void;
    }>();
    constructor(readonly store: ProgressStore, readonly now = Date.now) {
        const origin = process.env.NETCITY_ORIGIN;
        if (origin) {
            const u = new URL(origin);
            if (u.origin !== origin || this.production && u.protocol !== 'https:')
                throw Error('NETCITY_ORIGIN must be an exact origin; HTTPS is required in production.');
        }
    }
    origin(origin: string | null | undefined, host: string | null | undefined) { return !!origin && origin === (process.env.NETCITY_ORIGIN || `${this.production ? 'https' : 'http'}://${host}`); }
    cookies(header: string | undefined | null) { const out: Record<string, string> = {}; for (const part of (header ?? '').split(';')) {
        const i = part.indexOf('=');
        if (i > 0)
            out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    } return out; }
    async current(token: string | undefined) { return token && validToken(token) ? this.store.accounts.session(hashToken(token), this.now()) : null; }
    async throttle(ip: string, login: string) {
        const ipOK = await this.store.accounts.consume(hashToken(`auth:ip:${ip}`), 30, 15 * 60000, this.now());
        if (!ipOK)
            throw new AuthError(429, 'Слишком много попыток. Повторите через 15 минут.');
        const loginOK = await this.store.accounts.consume(hashToken(`auth:login:${login}`), 8, 15 * 60000, this.now());
        if (!loginOK)
            throw new AuthError(429, 'Слишком много попыток. Повторите через 15 минут.');
    }
    private credentials(value: unknown, allowed: string[]) {
        if (!value || typeof value !== 'object' || Object.keys(value).some(k => !allowed.includes(k)))
            throw new AuthError(400, 'Некорректные поля формы.');
        const a = value as Record<string, unknown>, login = loginName(a.login);
        if (!login || !validPassword(a.password))
            throw new AuthError(400, 'Логин: 3–24 латинских символа, цифры и _. Пароль: 12–128 символов.');
        return { a, login, password: a.password };
    }
    private async session(account: Account) {
        const token = nonce(), createdAt = this.now(), expiresAt = createdAt + SESSION_AGE;
        if (!await this.store.accounts.addSession({ hash: hashToken(token), accountId: account.id, createdAt, expiresAt }, account.passwordHash))
            throw new AuthError(401, 'Пароль изменился. Повторите вход.');
        return { token, expiresAt, login: account.login };
    }
    async register(value: unknown, ip: string) {
        const { a, login, password } = this.credentials(value, ['login', 'password', 'guestToken', 'confirm','transferCode','preferences']);
        if (a.confirm !== true || a.guestToken !== undefined && !validToken(a.guestToken)||a.transferCode!==undefined&&!validToken(a.transferCode)||a.transferCode!==undefined&&a.guestToken!==undefined)
            throw new AuthError(400, 'Подтвердите создание аккаунта и выбор гостевого прогресса.');
        await this.throttle(ip, login);
        const recoveryCode = nonce(), passwordHash = await hashPassword(password);
        let account: Account;
        try {
            account = await this.store.accounts.create(login, passwordHash, hashToken(recoveryCode), a.guestToken as string | undefined,a.transferCode as string|undefined,preferences(a.preferences));
        }
        catch (e) {
            if (e instanceof AuthConflict)
                throw new AuthError(409, e.message);
            throw e;
        }
        if (account.guestHash)
            this.disconnect(i => !!i.guestToken && hashToken(i.guestToken) === account.guestHash);
        return { ...await this.session(account), recoveryCode,preferences:account.preferences??{} };
    }
    async login(value: unknown, ip: string) {
        const { login, password } = this.credentials(value, ['login', 'password']);
        await this.throttle(ip, login);
        const account = await this.store.accounts.find(login), valid = await verifyPassword(password, account?.passwordHash ?? null);
        if (!account || !valid)
            throw new AuthError(401, 'Неверный логин или пароль.');
        return this.session(account);
    }
    async reset(value: unknown, ip: string) {
        const { a, login, password } = this.credentials(value, ['login', 'password', 'recoveryCode']);
        await this.throttle(ip, login);
        if (!validToken(a.recoveryCode))
            throw new AuthError(401, 'Логин или ключ восстановления неверен.');
        const account = await this.store.accounts.find(login), passwordHash = await hashPassword(password), next = nonce();
        if (!account || !await this.store.accounts.reset(account.id, hashToken(a.recoveryCode), passwordHash, hashToken(next)))
            throw new AuthError(401, 'Логин или ключ восстановления неверен.');
        this.disconnect(i => i.accountId === account.id);
        return { recoveryCode: next };
    }
    async logout(token: string | undefined) { if (token && validToken(token)) {
        const hash = hashToken(token);
        await this.store.accounts.revoke(hash);
        this.disconnect(i => i.sessionHash === hash);
    } }
    async authenticate(options: {
        account?: unknown;
        guestToken?: unknown;
    }, context: AuthContext): Promise<GameIdentity | null> {
        const raw = this.cookies(context?.headers?.get('cookie'))[this.cookie];
        if (raw || options.account === true) {
            if (!this.origin(context.headers.get('origin'), context.headers.get('host')))
                throw new ServerError(403, 'Недопустимый источник входа.');
            const s = await this.current(raw);
            if (!s)
                throw new ServerError(401, 'Войдите в аккаунт повторно.');
            return { profileId: s.account.profileId, accountId: s.account.id, sessionHash: s.session.hash, expiresAt: s.session.expiresAt };
        }
        if (validToken(options.guestToken) && await this.store.accounts.wasGuest(hashToken(options.guestToken)))
            throw new ServerError(401, 'Гостевой профиль привязан к аккаунту. Войдите по логину.');
        return null;
    }
    async authorize(i: GameIdentity) {
        if (i.sessionHash) {
            const s = await this.store.accounts.session(i.sessionHash, this.now());
            return !!s && s.account.profileId === i.profileId;
        }
        return i.guestToken ? await this.store.identify(i.guestToken) === i.profileId : true;
    }
    watch(identity: GameIdentity, close: () => void) {
        const w = { identity, close };
        this.watches.add(w);
        let busy = false;
        const timer = setInterval(async () => { if (busy)
            return; busy = true; try {
            if (!await this.authorize(identity))
                close();
        }
        catch {
            close();
        }
        finally {
            busy = false;
        } }, 10000);
        timer.unref();
        return () => { clearInterval(timer); this.watches.delete(w); };
    }
    private disconnect(test: (i: GameIdentity) => boolean) { for (const w of this.watches)
        if (test(w.identity))
            w.close(); }
}
