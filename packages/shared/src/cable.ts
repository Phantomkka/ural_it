import { WORLD_COLLIDERS, OFFICE_DOORS, ENTRY_DOOR_CLOSED } from './index.js';
export interface CablePoint {
    x: number;
    z: number;
}
export interface CableTask {
    id: string;
    stage: 'PULLING' | 'TERMINATED' | 'TESTED';
    points: CablePoint[];
    endpoint: CablePoint;
    carrier?: string;
}
export type CableAction = {
    action: 'take' | 'anchor' | 'drop' | 'terminate' | 'test' | 'reset';
    requestId: string;
};
export const CABLE_SOURCE = { x: 11, z: 4.8 }, CABLE_TARGET = { x: 18, z: 0 };
export const CABLE_BUDGET = 18, CABLE_MAX_ANCHORS = 12;
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
                id: string;
                revision: number;
                points: CablePoint[];
            }, held = p.heldItem === 'cable_roll', old = selected.get(c.id);
            if (old && (old.held && !held || old.held === held && old.revision > c.revision))
                continue;
            selected.set(c.id, { revision: c.revision, held, points: held ? [...c.points, { x: p.x, z: p.z }] : c.points });
        }
    return new Map([...selected].map(([id, c]) => [id, c.points]));
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
export function cableRouteValid(points: CablePoint[], entryOpen = true) {
    if (points.length < 1 || points.length > CABLE_MAX_ANCHORS + 1 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.abs(p.x) > 45 || Math.abs(p.z) > 45) || cableLength(points) > CABLE_BUDGET + 1e-6)
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
