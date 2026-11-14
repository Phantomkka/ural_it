import { useEffect, useState, type FormEvent } from 'react';
import type { PrivateProfile } from '@netcity/shared';
import { accountSession, accountRequest, accountChanged, continueAsGuest, type AccountSession } from './auth';
import { guestIdentity } from './identity';
export function AccountPanel({ profile }: {
    profile: PrivateProfile | null;
}) {
    const [session, setSession] = useState<AccountSession | null>(null), [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
    const [login, setLogin] = useState(''), [password, setPassword] = useState(''), [key, setKey] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    const [bind, setBind] = useState(!!guestIdentity()), [confirm, setConfirm] = useState(false), [saved, setSaved] = useState(false);
    const [recovery, setRecovery] = useState<{
        code: string;
        login: string | null;
        guest?: string;
    } | null>(null);
    useEffect(() => { let alive = true; accountSession().then(s => { if (alive)
        setSession(s); }).catch(e => { if (alive)
        setMessage(e.message); }); return () => { alive = false; }; }, []);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (busy)
            return;
        setBusy(true);
        setMessage('');
        const guest = mode === 'register' && bind ? guestIdentity() ?? undefined : undefined;
        try {
            const result = await accountRequest(mode, { login, password, ...(mode === 'register' ? { confirm, guestToken: guest } : mode === 'reset' ? { recoveryCode: key } : {}) });
            setPassword('');
            setKey('');
            if (result.recoveryCode) {
                setRecovery({ code: result.recoveryCode, login: mode === 'reset' ? null : result.login!, guest });
                setSaved(false);
            }
            else
                accountChanged(result.login ?? null);
        }
        catch (e) {
            setPassword('');
            setMessage((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    };
    if (recovery)
        return <section className="account-panel"><div className="eyebrow">NETCITY ID · КЛЮЧ ВОССТАНОВЛЕНИЯ</div><h2>Сохраните ключ отдельно</h2><p>Этот ключ заменяет восстановление через почту. Сохраните его в менеджере паролей. Он показывается один раз; после использования выдаётся новый.</p><textarea aria-label="Ключ восстановления" readOnly value={recovery.code} onFocus={e => e.target.select()}/><label className="account-check"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)}/> Я сохранил ключ восстановления</label><button disabled={!saved} onClick={() => accountChanged(recovery.login, recovery.guest)}>{recovery.login ? 'Вернуться в город' : 'Перейти ко входу'}</button></section>;
    return <section className="account-panel"><div className="eyebrow">NETCITY ID · УЧЁТНАЯ ЗАПИСЬ</div><h2>{session?.login ? 'Ваш аккаунт' : mode === 'register' ? 'Создать аккаунт' : mode === 'reset' ? 'Восстановить доступ' : 'Войти в NETCITY'}</h2>
    {session?.persistence === 'temporary' && <p className="account-warning">Тестовый сервер без PostgreSQL: аккаунты и прогресс временные и исчезнут после перезапуска.</p>}
    {session?.login ? <><h3>{session.login}</h3><p>Один профиль на компьютере и телефоне. Вход на другом устройстве восстановит NET, XP, инвентарь, контракты и заявки. Сессия действует 7 дней.</p><button disabled={busy} onClick={async () => { setBusy(true); try {
            await accountRequest('logout', {});
            accountChanged(null);
        }
        catch (e) {
            setMessage((e as Error).message);
        }
        finally {
            setBusy(false);
        } }}>Выйти из аккаунта</button></> : <>
      <div className="account-tabs">{(['login', 'register', 'reset'] as const).map(m => <button key={m} aria-pressed={mode === m} disabled={busy} onClick={() => { setMode(m); setPassword(''); setKey(''); setMessage(''); setConfirm(false); }}>{m === 'login' ? 'Вход' : m === 'register' ? 'Регистрация' : 'Есть ключ восстановления'}</button>)}</div>
      <form onSubmit={submit}>
        <label>Логин<input aria-label="Логин" autoComplete="username" spellCheck={false} required minLength={3} maxLength={24} pattern="[A-Za-z][A-Za-z0-9_]{2,23}" value={login} onChange={e => setLogin(e.target.value)}/></label>
        <label>{mode === 'reset' ? 'Новый пароль' : 'Пароль'}<input aria-label={mode === 'reset' ? 'Новый пароль' : 'Пароль'} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)}/></label>
        <small>Логин: латиница, цифры и _, 3–24 символа. Пароль: 12–128 символов; вставка из менеджера паролей разрешена.</small>
        {mode === 'register' && <div className="account-migration">
          {guestIdentity() && <label className="account-check"><input type="checkbox" checked={bind} onChange={e => { setBind(e.target.checked); setConfirm(false); }}/> Привязать текущего гостя</label>}
          <p>{bind && guestIdentity() ? `Сохраняется тот же профиль: ${profile?.credits ?? '…'} NET, ${profile?.xp ?? '…'} XP, весь инвентарь, контракты и заявки. Старый гостевой ключ перестанет работать. Повторно привязать или объединить профили нельзя.` : 'Будет создан новый пустой профиль. Существующий непривязанный гость останется в этом браузере; профили не объединяются.'}</p>
          <label className="account-check"><input type="checkbox" required checked={confirm} onChange={e => setConfirm(e.target.checked)}/> Подтверждаю выбранный вариант сохранения прогресса</label>
        </div>}
        {mode === 'reset' && <label>Одноразовый ключ<input aria-label="Одноразовый ключ" autoComplete="off" required minLength={64} maxLength={64} value={key} onChange={e => setKey(e.target.value)}/><small>Все сессии аккаунта будут завершены. Старый ключ перестанет работать.</small></label>}
        {mode === 'login' && guestIdentity() && <p>Вход откроет профиль аккаунта. Непривязанный гость остаётся в браузере, его прогресс не прибавляется к аккаунту.</p>}
        <button type="submit" disabled={busy || mode === 'register' && !confirm}>{busy ? 'Подтверждение…' : mode === 'register' ? 'Создать и сохранить' : mode === 'reset' ? 'Сменить пароль по ключу' : 'Войти'}</button>
      </form><button disabled={busy} onClick={continueAsGuest}>Продолжить гостем</button>
    </>}
    <p role="status" className="account-message">{message}</p><p>Пароль не сохраняется в браузерном хранилище. Не передавайте никому пароль и ключ восстановления. Восстановление по почте не подключено.</p>
  </section>;
}
