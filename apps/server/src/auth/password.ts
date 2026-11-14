import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const COST = 131072, MAXMEM = 192 * 1024 * 1024;
let active = 0;
export class AuthError extends Error {
    constructor(readonly status: number, message: string, readonly retryAfter = 900) { super(message); }
}
export const loginName = (v: unknown) => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(v) ? v.toLowerCase() : null;
export const validPassword = (v: unknown): v is string => typeof v === 'string' && v.length >= 12 && v.length <= 128 && Buffer.byteLength(v, 'utf8') <= 512;
function derive(password: string, salt: string) {
    if (active >= 2)
        throw new AuthError(429, 'Сервис входа занят. Повторите через несколько секунд.', 5);
    active++;
    return new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 32, { N: COST, r: 8, p: 1, maxmem: MAXMEM }, (e, key) => { active--; if (e)
        reject(e);
    else
        resolve(key); }));
}
export async function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `scrypt$${COST}$8$1$${salt}$${(await derive(password, salt)).toString('hex')}`; }
// Unknown accounts perform the same expensive verification as an existing account.
const DUMMY = `scrypt$${COST}$8$1$${'0'.repeat(32)}$${'0'.repeat(64)}`;
export async function verifyPassword(password: string, hash: string | null) { const fields = (hash ?? DUMMY).split('$'); if (fields.length !== 6 || fields.slice(0, 4).join('$') !== `scrypt$${COST}$8$1` || !/^[a-f0-9]{32}$/.test(fields[4]) || !/^[a-f0-9]{64}$/.test(fields[5]))
    throw new AuthError(503, 'Вход временно недоступен.'); const key = await derive(password, fields[4]); return timingSafeEqual(key, Buffer.from(fields[5], 'hex')); }
