import {caseTemplate,cableSpec,WIRE_EQUIPMENT,insideBuilding} from "@netcity/shared";
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
        if (!a || typeof a !== 'object' || typeof a.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(a.requestId) || !['take', 'anchor', 'drop', 'terminate', 'test', 'reset', 'mission','refresh'].includes(String(a.action)) || (a.sourceId!==undefined&&(typeof a.sourceId!=='string'||a.sourceId.length>64)) || (a.port!==undefined&&(!Number.isInteger(a.port)||Number(a.port)<5||Number(a.port)>8)) || Object.keys(a).some(k => !['requestId', 'action','sourceId','port'].includes(k)))
            return Promise.resolve({ result: bad('Некорректное действие с бухтой.'), data: null, ports:[] as number[],physicalChanged:false });
        const fingerprint = createHash('sha256').update(JSON.stringify(['cable', a.action,a.sourceId,a.port])).digest('hex');
        let ports:number[]=[],physicalChanged=false;
        return this.store.transaction(id, a.action==='refresh'?null:a.requestId, tx => {
            ports=[...(tx.wirePorts??[])];if(tx.data.cable?.port&&tx.data.cable.stage!=='PULLING')ports.push(tx.data.cable.port);
            if(a.action==='refresh')return good('Состояние портов обновлено.');
            if (tx.operation)
                return tx.operation.fingerprint === fingerprint ? { ...tx.operation.result, replayed: true } : bad('Ключ операции уже использован.');
            const p = actor(), c = tx.data.cable,spec=cableSpec(c);
            const near = (target: CablePoint, inside = false) => !!p && (!inside || inOfficeRoom(p, target.x)) && Math.hypot(p.x - target.x, p.z - target.z) <= 2.5;
            const perform = () => {
                if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z))
                    return bad('Сеанс завершён.');
                if(c?.routing==='free'||a.sourceId!==undefined)return this.free(tx,a,p);
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
            const wasFree=c?.routing==='free';
            const result = perform();
            physicalChanged=result.ok&&wasFree&&['terminate','reset'].includes(String(a.action));
            ports=[...(tx.wirePorts??[])];if(tx.data.cable?.port&&tx.data.cable.stage!=='PULLING')ports.push(tx.data.cable.port);
            tx.saveOperation = { fingerprint, result };
            return result;
        },undefined,undefined,undefined,true).then(outcome=>({...outcome,ports,physicalChanged}));
    }
    private free(tx:import('./store.js').Transaction,a:Record<string,unknown>,p:CableActor):ProgressResult {
        const c=tx.data.cable,near=(v:CablePoint)=>Math.hypot(p.x-v.x,p.z-v.z)<=2.5;
        if(a.sourceId!==undefined&&(!c||a.action==='mission'||a.action==='take'&&c.stage!=='PULLING')){
            if(c)return bad('Сначала уберите предыдущую линию у оборудования или свича.');
            if(!['take','mission'].includes(String(a.action)))return bad('Выберите оборудование перед началом линии.');
            const job=tx.data.service?.cases.at(-1),t=job&&caseTemplate(job),source=a.sourceId==='active-ticket'?t?.hardware:WIRE_EQUIPMENT.find(v=>v.id===a.sourceId);
            if(!source||a.sourceId==='active-ticket'&&(!job||!t||t.floor||!['DIAGNOSED','REPAIRED','VERIFIED'].includes(job.stage)))return bad('Нет подходящей диагностированной заявки первого этажа.');
            const sameRoom=a.sourceId!=='active-ticket'?inOfficeRoom(p,source.x):!t?.indoor||(t.buildingId?insideBuilding(p,t.buildingId):inOfficeRoom(p,source.x));
            if(!sameRoom||tx.data.service?.cases.some(v=>v.carrying)||!near(source))return bad('Освободите руки и подойдите к выбранному оборудованию.');
            tx.data.cable={id:randomUUID(),routing:'free',sourceId:String(a.sourceId),source:{x:source.x,z:source.z},sourceHeight:a.sourceId==='active-ticket'?(t?.kind==='camera'?2.55:.9):WIRE_EQUIPMENT.find(v=>v.id===a.sourceId)!.height,kind:t?.kind==='camera'&&a.sourceId==='active-ticket'?'camera':undefined,caseId:a.sourceId==='active-ticket'?job!.id:undefined,stage:'PULLING',points:[{x:source.x,z:source.z,y:a.sourceId==='active-ticket'?(t?.kind==='camera'?2.55:.9):WIRE_EQUIPMENT.find(v=>v.id===a.sourceId)!.height}],endpoint:{x:p.x,z:p.z},carrier:p.sessionId};
            return good('Кабель подключён к оборудованию. Выберите свободный порт SW-01 и проложите любой маршрут.');
        }
        if(!c||c.routing!=='free')return bad('Сначала выберите оборудование.');
        if(c.carrier&&c.carrier!==p.sessionId)return bad('Бухта в другом сеансе.');
        if(a.action==='reset'){
            if(!near(c.source!)&&!near(CABLE_TARGET))return bad('Подойдите к оборудованию или SW-01 для отключения.');
            tx.data.cable=undefined;return good('Линия отключена, порт освобождён.');
        }
        if(a.action==='test'){
            if(c.stage!=='TERMINATED'||!near(CABLE_TARGET)||!inOfficeRoom(p,CABLE_TARGET.x))return bad('Подключите линию и подойдите к SW-01.');
            c.stage='TESTED';if(!c.kind)initBusiness(tx.data).cableCertified=true;return good('Линк 1 Гбит/с, потерь нет. Оба конца подключены.');
        }
        if(a.action==='take'){
            if(c.stage!=='PULLING'||c.carrier||!near(c.endpoint)||tx.data.service?.cases.some(v=>v.carrying))return bad('Подойдите к оставленной бухте со свободными руками.');
            c.carrier=p.sessionId;return good('Бухта поднята.');
        }
        if(c.stage!=='PULLING'||c.carrier!==p.sessionId)return bad('Возьмите бухту в этом сеансе.');
        if(a.action==='terminate'){
            if(!near(CABLE_TARGET)||!inOfficeRoom(p,CABLE_TARGET.x))return bad('Подойдите к SW-01 в серверной.');
            const port=Number(a.port);if(!Number.isInteger(port)||port<5||port>8||(tx.wirePorts??[]).includes(port))return bad('Выберите свободный порт 5–8.');
            if(c.points.length>=CABLE_MAX_ANCHORS)return bad('Уберите линию: для конца требуется одно свободное крепление.');
            c.port=port;c.switchId='hq-ground';c.stage='TERMINATED';c.carrier=undefined;c.endpoint={x:17.85,z:(port-4.5)*.16,y:1.7};c.points.push({...c.endpoint});return good('Оборудование подключено к SW-01, порт '+port+'. Проверьте линк.');
        }
        if(a.action==='drop'){c.endpoint={x:p.x,z:p.z};c.carrier=undefined;return good('Бухта оставлена у ног.');}
        if(a.action==='anchor'){
            if(c.points.length>=CABLE_MAX_ANCHORS-1)return bad('Оставьте последнее крепление для порта.');
            if(Math.hypot(c.points.at(-1)!.x-p.x,c.points.at(-1)!.z-p.z)<.5)return bad('Отойдите от предыдущего крепления.');
            c.points.push({x:p.x,z:p.z,y:.12});c.endpoint={x:p.x,z:p.z};return good('Кабель закреплён. Маршрут выбираете вы.');
        }
        return bad('Недопустимое действие с линией.');
    }
}
