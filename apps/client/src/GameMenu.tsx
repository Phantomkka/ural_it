import { useState, type RefObject } from "react";
import { DEFAULT_SETTINGS, keyLabel, type Binding, type Settings } from "./settings";
import type { Quality } from "./quality";
import { DistrictMap } from "./DistrictMap";
export type Menu = "settings" | "help" | "map" | "main" | "dispatcher";
const LABELS: Record<Binding, string> = {
  tablet:"Планшет",drop:"Положить деталь",
  forward:"Вперёд", back:"Назад", left:"Влево", right:"Вправо", sprint:"Бег",
  interact:"Взаимодействие", inventory:"Инвентарь", journal:"Журнал", map:"Карта", help:"Помощь",
};
export function GameMenu({ menu, settings, change, quality, setQuality, close, repeat, dialogRef, position, navigate, work, track }: {
  menu: Menu; settings: Settings; change: (s: Settings) => void; quality: Quality;
  setQuality: (q: Quality) => void; close: () => void; repeat: () => void;
  dialogRef: RefObject<HTMLElement | null>;
  position: {x:number;z:number};
  navigate: (next:Menu)=>void; work:()=>void; track:(id:string)=>void;
}) {
  const [capture, setCapture] = useState<Binding | null>(null);
  const [error, setError] = useState("");
  if(menu === "main" || menu === "dispatcher") return <div className="modal-backdrop"><section className="progress-panel welcome-menu" ref={dialogRef} role="dialog" aria-modal="true" aria-label={menu==="main"?"Главное меню":"Диспетчер Алина"}>
    <div className="eyebrow">НОВОЛИНСК · IT-КВАРТАЛ</div><h1>{menu==="main"?"NETCITY 2.0":"Алина · Service Desk"}</h1>
    <p>{menu==="main"?"Ваша смена: находите неисправности, помогайте офисам и развивайтесь вместе с другими инженерами.":"Привет! Офис справа остался без сети. Пройди через вход по центру, затем в серверную. Найди коммутатор, осмотри его и подключи свободный кабель в порт №3."}</p>
    <p>После ремонта загляните в снабжение: баллон для очистки пригодится для охлаждения. Кабель, адреса и DNS на рабочих ПК проверяются разными способами.</p>
    <div className="menu-actions"><button onClick={close}>Продолжить смену</button><button onClick={()=>{track("001");close();}}>Отследить первую заявку</button><button onClick={work}>Доска работ и снабжение</button><button onClick={()=>navigate("map")}>Карта района</button><button onClick={()=>navigate("settings")}>Открыть настройки</button><button onClick={repeat}>Пройти обучение</button></div>
  </section></div>;
  if(menu === "map") return <div className="modal-backdrop"><section className="progress-panel" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Карта района"><div className="progress-heading"><h2>Новолинск · IT-квартал</h2><button onClick={close}>Закрыть карту</button></div><DistrictMap {...position}/></section></div>;
  return <div className="modal-backdrop"><section ref={dialogRef} role="dialog" aria-modal="true"
    aria-label={menu === "settings" ? "Настройки" : "Справка управления"} className="progress-panel game-menu">
    <div className="progress-heading"><h2>{menu === "settings" ? "Настройки" : "Как играть"}</h2><button onClick={close}>Продолжить</button></div>
    <button onClick={()=>navigate("main")}>Главное меню</button>
    <p>Движение остановлено. Другие инженеры продолжают работу в общем мире.</p>
    <p>ПК: нажмите на улицу для обзора мышью. Esc освобождает курсор и открывает меню. Клики по интерфейсу не захватывают мышь.</p>
    <p>Телефон: стик слева — движение, свайп справа — камера, «Осмотреть» — действие. Два пальца работают одновременно.</p>
    <p>Гостевой профиль запоминается в этом браузере на этом устройстве. Очистка данных сайта или приватный режим могут удалить ключ доступа. Для входа с другого устройства откройте приложение «Аккаунт» в планшете и привяжите гостевой профиль. Если хранилище недоступно, срок доступа явно указан в HUD.</p>
    <div className="bindings">{(Object.keys(LABELS) as Binding[]).map(action => <label key={action}>
      {LABELS[action]}<button aria-label={`Клавиша: ${LABELS[action]}`} onClick={() => {setCapture(action); setError("");}}
        onKeyDown={event => {
          if (capture !== action) return;
          event.preventDefault(); event.stopPropagation();
          if (event.code === "Escape") { setCapture(null); return; }
          if (!/^(Tab|Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(event.code)) {setError("Выберите Tab, букву, цифру, стрелку или Shift."); return;}
          if (Object.entries(settings.bindings).some(([a,k]) => a !== action && k === event.code)) {setError("Эта клавиша уже назначена. Выберите другую."); return;}
          change({...settings, bindings:{...settings.bindings,[action]:event.code}}); setCapture(null); setError("");
        }}>{capture === action ? "Нажмите клавишу…" : keyLabel(settings.bindings[action])}</button>
    </label>)}</div>
    {error && <p role="alert">{error}</p>}
    <p>Справка также открывается клавишей ?. Прыжок и фонарик пока не реализованы.</p>
    <label>Чувствительность мыши<input aria-label="Чувствительность мыши" type="range" min="0.25" max="3" step="0.05" value={settings.sensitivity} onChange={e=>change({...settings,sensitivity:Number(e.target.value)})}/><output>{settings.sensitivity.toFixed(2)}</output></label>
    <label><input type="checkbox" checked={settings.invertY} onChange={e=>change({...settings,invertY:e.target.checked})}/> Инверсия Y</label>
    <label>Громкость звуков<input aria-label="Громкость звуков" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={e=>change({...settings,volume:Number(e.target.value)})}/></label>
    <label>Графика<select aria-label="Графика в настройках" value={quality} onChange={e=>setQuality(e.target.value as Quality)}><option value="low">Низкое / телефон</option><option value="medium">Среднее</option><option value="high">Высокое</option></select></label>
    <div className="menu-actions"><button onClick={()=> { change(structuredClone(DEFAULT_SETTINGS)); setCapture(null); setError(""); }}>Сбросить управление</button>
      <button onClick={repeat}>Повторить обучение</button>
      <button onClick={()=> { const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); void request?.catch(()=>setError("Полноэкранный режим недоступен в этом браузере.")); }}>Полный экран</button></div>
  </section></div>;
}
