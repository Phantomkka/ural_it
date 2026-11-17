import {SIP_STATION} from './furniture.js';
export const WIRE_EQUIPMENT=[{id:'client-pc04',name:'CLIENT-PC04',x:11.5,z:-5.25,height:1.08},{id:'sip-01',name:'SIP-01',...SIP_STATION,height:.9}];
import { WORLD_COLLIDERS, OFFICE_DOORS, ENTRY_DOOR_CLOSED } from './index.js';
export interface CablePoint {y?:number;
    x: number;
    z: number;
}
export interface CableTask {routing?:'free';source?:CablePoint;sourceHeight?:number;sourceId?:string;port?:number;switchId?:string;
    kind?:'camera';caseId?:string;
    id: string;
    stage: 'PULLING' | 'TERMINATED' | 'TESTED';
    points: CablePoint[];
    endpoint: CablePoint;
    carrier?: string;
}
export type CableAction = {
    action: 'take' | 'anchor' | 'drop' | 'terminate' | 'test' | 'reset' | 'mission' | 'refresh';
    sourceId?:string;port?:number;
    requestId: string;
};
export const CABLE_SOURCE = { x: 11, z: 4.8 }, CABLE_TARGET = { x: 18, z: 0 };
export const CABLE_BUDGET = 18, CABLE_MAX_ANCHORS = 12;
export function cableSpec(c?:Pick<CableTask,'kind'|'routing'|'source'>){return c?.routing==='free'?{source:c.source??CABLE_SOURCE,target:CABLE_TARGET,budget:2000,indoor:true}:c?.kind==='camera'?{source:{x:-6,z:2},target:{x:-6,z:20},budget:26,indoor:false}:{source:CABLE_SOURCE,target:CABLE_TARGET,budget:CABLE_BUDGET,indoor:true};}
/** Deduplicate one physical line when the same profile is open on two devices. */
export function visibleCablePaths(players: Iterable<{
    x: number;
    z: number;
    heldItem?: string;
    cablePath?: string;
}>) {
    const selected = new Map<string, {
        revision: number;
        held: boolean;
        points: CablePoint[];
    }>();
    for (const p of players)
        if (p.cablePath) {
            const c = JSON.parse(p.cablePath) as {
                routing?:'free';id: string;
                revision: number;
                points: CablePoint[];
            }, held = p.heldItem === 'cable_roll', old = selected.get(c.id);
            if (old && (old.held && !held || old.held === held && old.revision > c.revision))
                continue;
            selected.set(c.id, { revision: c.revision, held, points: held ? [...c.points, { x: p.x, z: p.z,y:c.routing==='free'?1:.12 }] : c.points });
        }
    return new Map([...selected].map(([id, c]) => [id, c.points]));
}
/** Free routes are decorative geometry; only legacy tensioned lines can obstruct doors. */
export function blockingCablePaths(players:Parameters<typeof visibleCablePaths>[0]){
    return visibleCablePaths([...players].filter(p=>!p.cablePath||JSON.parse(p.cablePath).routing!=='free'));
}
export function segmentHitsBox(a: CablePoint, b: CablePoint, box: {
    x: number;
    z: number;
    width: number;
    depth: number;
}, padding = 0.04) {
    let low = 0, high = 1;
    for (const [axis, size] of [['x', 'width'], ['z', 'depth']] as const) {
        const delta = b[axis] - a[axis], min = box[axis] - box[size] / 2 - padding, max = box[axis] + box[size] / 2 + padding;
        if (Math.abs(delta) < 1e-9) {
            if (a[axis] < min || a[axis] > max)
                return false;
            continue;
        }
        const first = (min - a[axis]) / delta, last = (max - a[axis]) / delta;
        low = Math.max(low, Math.min(first, last));
        high = Math.min(high, Math.max(first, last));
        if (low > high)
            return false;
    }
    return true;
}
export function cableLength(points: CablePoint[]) { return points.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - points[i].x, p.z - points[i].z), 0); }
export function cableRouteValid(points: CablePoint[], entryOpen = true,budget=CABLE_BUDGET) {
    if (points.length < 1 || points.length > CABLE_MAX_ANCHORS + 1 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.abs(p.x) > 45 || Math.abs(p.z) > 45) || cableLength(points) > budget + 1e-6)
        return false;
    for (let i = 1; i < points.length; i++) {
        for (const box of WORLD_COLLIDERS) {
            if (!entryOpen && box === OFFICE_DOORS[0])
                continue;
            if (segmentHitsBox(points[i - 1], points[i], box))
                return false;
        }
        if (!entryOpen && segmentHitsBox(points[i - 1], points[i], ENTRY_DOOR_CLOSED))
            return false;
    }
    return true;
}
