import express, { type Application, type Request, type Response } from 'express';
import { AuthService, AuthError, csrf, nonce, equal } from './service.js';
import { validToken } from '../progress/store.js';
export function mountAuth(app: Application, auth: AuthService) {
    const cookieOptions = { httpOnly: true, secure: auth.production, sameSite: 'strict' as const, path: '/' };
    app.use('/auth', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Pragma', 'no-cache'); res.removeHeader('Access-Control-Allow-Origin'); res.removeHeader('Access-Control-Allow-Credentials'); next(); }, express.json({ limit: '4kb', strict: true }));
    app.get('/auth/session', async (req, res) => {
        try {
            const cookies = auth.cookies(req.headers.cookie), token = cookies[auth.cookie], session = await auth.current(token);
            if (session) {
                res.json({ login: session.account.login, csrf: csrf(token), expiresAt: session.session.expiresAt, persistence: auth.store.mode });
                return;
            }
            if (token)
                res.clearCookie(auth.cookie, cookieOptions);
            const gate = validToken(cookies[auth.gate]) ? cookies[auth.gate] : nonce();
            res.cookie(auth.gate, gate, { ...cookieOptions, maxAge: 3600000 });
            res.json({ login: null, csrf: csrf(gate), persistence: auth.store.mode });
        }
        catch {
            res.status(503).json({ message: 'Хранилище аккаунтов недоступно.' });
        }
    });
    const post = (path: string, run: (req: Request, res: Response) => Promise<void>) => app.post('/auth/' + path, async (req, res) => {
        try {
            if (!auth.origin(req.get('Origin'), req.get('Host')))
                throw new AuthError(403, 'Недопустимый источник запроса.');
            const cookies = auth.cookies(req.headers.cookie), token = cookies[auth.cookie] ?? cookies[auth.gate];
            if (!validToken(token) || !equal(req.get('X-Netcity-CSRF'), csrf(token)))
                throw new AuthError(403, 'Защита формы устарела. Обновите форму и повторите.');
            if (!req.is('application/json'))
                throw new AuthError(415, 'Требуется JSON.');
            await run(req, res);
        }
        catch (e) {
            const error = e instanceof AuthError ? e : new AuthError(503, 'Действие не подтверждено. При регистрации попробуйте вход с выбранным паролем.');
            if (error.status === 429)
                res.setHeader('Retry-After', String(error.retryAfter));
            res.status(error.status).json({ message: error.message });
        }
    });
    const sign = (path: 'register' | 'login') => post(path, async (req, res) => {
        const cookies = auth.cookies(req.headers.cookie);
        if (await auth.current(cookies[auth.cookie]))
            throw new AuthError(409, 'Сначала выйдите из текущего аккаунта.');
        const result = await auth[path](req.body, req.ip ?? 'unknown');
        // A successful login replaces this browser's previous session, preventing fixation.
        await auth.logout(cookies[auth.cookie]);
        res.cookie(auth.cookie, result.token, { ...cookieOptions, maxAge: result.expiresAt - Date.now() });
        res.clearCookie(auth.gate, cookieOptions);
        const { token, ...safe } = result;
        res.json({ ...safe, csrf: csrf(token) });
    });
    sign('register');
    sign('login');
    post('logout', async (req, res) => { await auth.logout(auth.cookies(req.headers.cookie)[auth.cookie]); res.clearCookie(auth.cookie, cookieOptions); res.json({ ok: true }); });
    post('reset', async (req, res) => { res.json(await auth.reset(req.body, req.ip ?? 'unknown')); });
    app.use('/auth', (error: unknown, _req: Request, res: Response, _next: unknown) => { res.status(400).json({ message: 'Некорректная или слишком большая форма.' }); });
}
