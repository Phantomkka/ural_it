import {caseTemplate,cableSpec} from "@netcity/shared";
import {initBusiness} from "./business.js";
import { randomUUID, createHash } from 'node:crypto';
import { CABLE_SOURCE, CABLE_TARGET, CABLE_MAX_ANCHORS, cableRouteValid, inOfficeRoom, type CablePoint, type ProgressResult } from '@netcity/shared';
import type { ProgressStore } from './store.js';
export interface CableActor extends CablePoint {
    sessionId: string;
    entryOpen: boolean;
}
const bad = (message: string): ProgressResult => ({ ok: false, message }), good = (message: string): ProgressResult => ({ ok: true, message });
export class CableService {
    constructor(readonly store: ProgressStore) { }
    command(id: string, value: unknown, actor: () => CableActor | null) {
        const a = value as Record<string, unknown>;
        if (!a || typeof a !== 'object' || typeof a.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(a.requestId) || !['take', 'anchor', 'drop', 'terminate', 'test', 'reset', 'mission'].includes(String(a.action)) || Object.keys(a).some(k => !['requestId', 'action'].includes(k)))
            return Promise.resolve({ result: bad('Некорректное действие с бухтой.'), data: null });
        const fingerprint = createHash('sha256').update(JSON.stringify(['cable', a.action])).digest('hex');
        return this.store.transaction(id, a.requestId, tx => {
            if (tx.operation)
                return tx.operation.fingerprint === fingerprint ? { ...tx.operation.result, replayed: true } : bad('Ключ операции уже использован.');
            const p = actor(), c = tx.data.cable,spec=cableSpec(c);
            const near = (target: CablePoint, inside = false) => !!p && (!inside || inOfficeRoom(p, target.x)) && Math.hypot(p.x - target.x, p.z - target.z) <= 2.5;
            const perform = () => {
                if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z))
                    return bad('Сеанс завершён.');
                if(a.action==='mission'){
  const job=tx.data.service?.cases.at(-1),mission=cableSpec({kind:'camera'});
  if(!job||caseTemplate(job).kind!=='camera'||!['DIAGNOSED','REPAIRED','VERIFIED'].includes(job.stage))return bad('Нет подходящей монтажной заявки.');
  if(c?.carrier||tx.data.service?.cases.some(c=>c.carrying))return bad('Для бухты нужны свободные руки.');
  if(c?.stage==='PULLING')return bad('Сначала закончите или уберите предыдущую линию.');
  if(!near(mission.source))return bad('Монтажная бухта выдаётся у Марата.');
  tx.data.cable={id:randomUUID(),kind:'camera',caseId:job.id,stage:'PULLING',points:[mission.source],endpoint:{x:p.x,z:p.z},carrier:p.sessionId};return good('Бухта 26 м в руках. Проложите линию вдоль тротуара к камере склада.');
 }
 if (a.action === 'take') {
                    if (tx.data.service?.cases.some(c => c.carrying))
                        return bad('Сначала положите запчасть: для бухты нужны свободные руки.');
                    if (c?.carrier)
                        return bad('Бухта уже в руках другого сеанса.');
                    if (c && c.stage !== 'PULLING')
                        return bad('Учебная линия уже подключена. Начните заново у кладовой.');
                    if (!near(c?.endpoint ?? spec.source, !c&&spec.indoor))
                        return bad('Подойдите к своей бухте в кладовой или точке, где оставили её.');
                    if (c) {
                        if (!cableRouteValid([c.endpoint, p], p.entryOpen,spec.budget) || !cableRouteValid([...c.points, p], p.entryOpen,spec.budget))
                            return bad('Кабель перекрыт дверью или натянут. Откройте дверь либо вернитесь к креплению.');
                        c.carrier = p.sessionId;
                    }
                    else
                        tx.data.cable = { id: randomUUID(), stage: 'PULLING', points: [{ ...CABLE_SOURCE }], endpoint: { x: p.x, z: p.z }, carrier: p.sessionId };
                    return good('Бухта в руках. Закрепляйте кабель на поворотах. Скорость снижена, длина ограничена 18 м.');
                }
                if (!c)
                    return bad('Сначала возьмите бухту у кладовой.');
                if (a.action === 'reset') {
                    if (!near(spec.source,spec.indoor))
                        return bad('Сброс учебной линии выполняется у кладовой.');
                    if (c.carrier && c.carrier !== p.sessionId)
                        return bad('Бухта в другом сеансе.');
                    tx.data.cable = undefined;
                    return good('Учебная линия убрана. Бухта вернулась в кладовую.');
                }
                if (a.action === 'test') {
                    if (!near(spec.target,spec.indoor) || c.stage !== 'TERMINATED')
                        return bad('Подключите кабель и подойдите к патч-панели.');
                    if (!cableRouteValid(c.points, p.entryOpen,spec.budget))
                        return bad('Маршрут перекрыт. Освободите кабель.');
                    c.stage = 'TESTED';if(!c.kind)initBusiness(tx.data).cableCertified=true;
                    return good('Учебный линк: 1 Гбит/с, потерь 0/4. Линия проверена. Награды и рабочие порты не изменяются.');
                }
                if (c.stage !== 'PULLING' || c.carrier !== p.sessionId)
                    return bad('В этом сеансе нет бухты в руках.');
                const end = a.action === 'terminate' ? spec.target : { x: p.x, z: p.z };
                if (!cableRouteValid([...c.points, end], p.entryOpen,spec.budget))
                    return bad('Кабель натянут или пересекает препятствие. Нужна другая точка крепления.');
                if (a.action === 'anchor') {
                    if (c.points.length >= CABLE_MAX_ANCHORS)
                        return bad('Достигнут предел креплений.');
                    const last = c.points.at(-1)!;
                    if (Math.hypot(last.x - end.x, last.z - end.z) < 0.5)
                        return bad('Крепление слишком близко к предыдущему.');
                    c.points.push({ ...end });
                    c.endpoint = { ...end };
                    return good('Кабель закреплён. Следующий участок начинается отсюда.');
                }
                if (a.action === 'drop') {
                    c.endpoint = { ...end };
                    c.carrier = undefined;
                    return good('Бухта оставлена у ног. Подбор доступен вашему профилю рядом с предметом.');
                }
                if (a.action === 'terminate') {
                    if (!near(spec.target,spec.indoor))
                        return bad('Подойдите к патч-панели в серверной.');
                    if (c.points.length >= CABLE_MAX_ANCHORS)
                        return bad('Нет места для конечного крепления.');
                    c.points.push({ ...spec.target });
                    c.endpoint = { ...spec.target };
                    c.carrier = undefined;
                    c.stage = 'TERMINATED';
                    return good('Коннектор установлен. Проверьте учебный линк.');
                }
                return bad('Недопустимое действие.');
            };
            const result = perform();
            tx.saveOperation = { fingerprint, result };
            return result;
        });
    }
}
