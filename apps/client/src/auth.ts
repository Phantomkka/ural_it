import { gameHttp } from './endpoint';
import { forgetGuestIdentity, setAccountIdentity } from './identity';
const HINT = 'netcity-account-hint';
let remembered = false;
export const accountExpected = () => { try {
    return localStorage.getItem(HINT) === '1' || remembered;
}
catch {
    return remembered;
} };
function mark(value: boolean) { remembered = value; try {
    if (value)
        localStorage.setItem(HINT, '1');
    else
        localStorage.removeItem(HINT);
}
catch { } }
export interface AccountSession {
    login: string | null;
    csrf: string;
    expiresAt?: number;
    persistence: 'temporary' | 'postgres';
}
export async function accountSession(): Promise<AccountSession> {
    const response = await fetch(gameHttp() + '/auth/session', { credentials: 'include', cache: 'no-store' }), value = await response.json();
    if (!response.ok)
        throw Error(value.message ?? 'Сервис аккаунтов недоступен.');
    setAccountIdentity(value.login);
    if (value.login)
        mark(true);
    return value;
}
export async function accountRequest(action: 'login' | 'register' | 'logout' | 'reset', body: object) {
    const session = await accountSession();
    const response = await fetch(gameHttp() + '/auth/' + action, { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Netcity-CSRF': session.csrf }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok)
        throw Error(result.message ?? 'Действие не подтверждено.');
    return result as {
        login?: string;
        recoveryCode?: string;
        expiresAt?: number;
    };
}
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('netcity-account-events') : null;
const refresh = () => window.dispatchEvent(new Event('netcity-auth-changed'));
channel?.addEventListener('message', () => refresh());
export function accountChanged(login: string | null, boundGuest?: string) {
    if (boundGuest)
        forgetGuestIdentity(boundGuest);
    setAccountIdentity(login);
    mark(true);
    // Pending financial commands belong to the old connection/profile, never replay them after a switch.
    try {
        for (const key of ['netcity-pending-operation', 'netcity-pending-progress', 'netcity-pending-case'])
            sessionStorage.removeItem(key);
    }
    catch { }
    channel?.postMessage('changed');
    refresh();
}
export function continueAsGuest() { setAccountIdentity(null); mark(false); refresh(); }
