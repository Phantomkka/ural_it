import {cableSpec} from "@netcity/shared";
import { CABLE_BUDGET, CABLE_SOURCE, CABLE_TARGET, cableLength, type CableAction, type PrivateProfile } from '@netcity/shared';
import { DistrictMap } from './DistrictMap';
export function CablePanel({ profile, position, sessionId, send, pending, message, retry }: {
    profile: PrivateProfile | null;
    position: {
        x: number;
        z: number;
    };
    sessionId?: string;
    send: (action: CableAction['action']) => void;
    pending: boolean;
    message: string;
    retry: () => void;
}) {
    const c = profile?.cable,spec=cableSpec(c), held = c?.carrier === sessionId && !!sessionId;
    const length = c ? cableLength([...c.points, held ? position : c.endpoint]) : 0;
    return <section className="cable-panel"><div className="eyebrow">ИНСТРУМЕНТЫ · УЧЕБНАЯ ПРОКЛАДКА</div><h2>{c?.kind==="camera"?"Монтаж камеры · 26 м":"Бухта кабеля · 18 м"}</h2>{c?.kind==="camera"&&<p>Монтажная линия: Марат → северный тротуар → камера склада. Прокладывайте сегменты и закрепляйте повороты. Это рабочая линия текущей заявки.</p>}
    <p>Возьмите бухту у кладовой рядом с OFFICE-PC03. Проложите кабель через коридор и вторую дверь к учебному разъёму у патч-панели. На поворотах добавляйте крепления; стены и натяжение останавливают движение. С бухтой нельзя бежать.</p>
    <p>Маршрут: кладовая → угол коридора перед дверью → за дверью в серверной → патч-панель. Сначала закрепите поворот, затем продолжайте движение.</p>
    <progress aria-label="Использовано кабеля" max={spec.budget} value={length}/><p>{length.toFixed(1)} / {spec.budget} м · креплений: {c?.points.length ?? 0}/12 · {held ? 'бухта в руках' : c?.carrier ? 'бухта у другого сеанса профиля' : c?.stage === 'TESTED' ? 'линк проверен' : c?.stage === 'TERMINATED' ? 'коннектор установлен' : 'бухта на месте'}</p>
    <div className="case-actions">
      {(!c || c.stage === 'PULLING' && !c.carrier) && <button disabled={pending || !profile} onClick={() => send('take')}>{c ? 'Поднять бухту' : 'Взять бухту'}</button>}
      {held && <><button disabled={pending} onClick={() => send('anchor')}>Закрепить кабель здесь</button><button disabled={pending} onClick={() => send('drop')}>Положить бухту</button><button disabled={pending} onClick={() => send('terminate')}>Установить коннектор</button></>}
      {c?.stage === 'TERMINATED' && <button disabled={pending} onClick={() => send('test')}>Проверить учебный линк</button>}
      {c && <button disabled={pending} onClick={() => send('reset')}>Убрать линию у кладовой</button>}
    </div><p role="status">{message}</p>{pending && <p>Ожидание подтверждения… <button onClick={retry}>Повторить ту же операцию с бухтой</button></p>}
    {c?.stage === 'TESTED' && <p>✓ Учебная линия сохранена. Это упражнение не начисляет NET/XP и не меняет рабочие сетевые порты.</p>}
    <details><summary>Карта учебного маршрута</summary><DistrictMap {...position} destination={!c ? spec.source : c.carrier ? spec.target : c.endpoint}/></details>
    <small>Ограниченная модель креплений и сегментов, без свободной физики. После отключения бухта остаётся в последней серверной позиции; после аварии — у последнего сохранённого крепления.</small>
  </section>;
}
