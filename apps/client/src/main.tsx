import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { connect } from './network';
import { createWorld } from './world';
import './style.css';
function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('Подключение…');
  const [count, setCount] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false; let cleanup: (() => void) | undefined;
    void connect().then(room => {
      if (cancelled) { void room.leave(); return; }
      const dispose = createWorld(canvas.current!, room);
      setStatus('В сети');
      room.onStateChange(state => setCount(state.players.size));
      room.onLeave(() => { setStatus('Соединение закрыто'); setCount(0); });
      room.onError((_code, message) => setStatus(`Ошибка: ${message ?? 'соединение потеряно'}`));
      cleanup = () => { dispose(); void room.leave(); };
    }).catch(error => { if (!cancelled) setStatus(`Ошибка подключения: ${error.message}`); });
    return () => { cancelled = true; cleanup?.(); };
  }, [attempt]);
  return <><canvas ref={canvas} aria-label="Трёхмерная улица NETCITY"/><header><b>NETCITY <span>ONLINE</span></b><small>Первый район · прототип 0.1</small></header><aside><i/> {status} <span>Игроков: {count}</span><button onClick={() => setAttempt(v => v + 1)}>Переподключиться</button></aside><div className="crosshair">+</div><footer><strong>Добро пожаловать в город</strong><p>Нажмите на улицу, чтобы начать</p><small>W A S D — движение · мышь — обзор · Esc — освободить курсор</small></footer></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
