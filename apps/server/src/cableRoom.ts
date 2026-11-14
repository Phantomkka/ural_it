import type { Client } from '@colyseus/core';
import { cableRouteValid, segmentHitsBox, ENTRY_DOOR_CLOSED, visibleCablePaths,cableSpec, type CableTask, type CablePoint } from '@netcity/shared';
import type { ProfileData } from './progress/store.js';
import type { StreetRoom } from './StreetRoom.js';
export class CableRoomController {
    private active = new Map<string, {
        task: CableTask;
        client: Client;
        hintAt: number;
    }>();
    constructor(private room: StreetRoom) { }
    sync(client: Client, data: ProfileData) {
        const player = this.room.state.players.get(client.sessionId);
        if (!player)
            return;
        const c = data.cable, held = c?.stage === 'PULLING' && c.carrier === client.sessionId;
        if (held) {
            // A delayed commit cannot strand the endpoint on the far side of a wall.
            if (!cableRouteValid([...c.points, player], this.room.state.equipment.officeDoorOpen,cableSpec(c).budget)) {
                player.x = c.endpoint.x;
                player.z = c.endpoint.z;
            }
            this.active.set(client.sessionId, { task: structuredClone(c), client, hintAt: 0 });
        }
        else
            this.active.delete(client.sessionId);
        player.cablePath = c && (!c.carrier || held) ? JSON.stringify({ id: c.id, revision: data.version, points: held ? c.points : [...c.points, c.endpoint] }) : '';
        player.heldItem = player.heldItem.startsWith('prop:')?player.heldItem:data.service?.cases.some(c => c.carrying && c.carrier === client.sessionId) ? 'patch_cord' : held ? 'cable_roll' : '';
    }
    forget(id: string) { this.active.delete(id); }
    constrain(id: string, from: CablePoint, next: CablePoint) {
        const active = this.active.get(id);
        if (!active || cableRouteValid([...active.task.points, next], this.room.state.equipment.officeDoorOpen,cableSpec(active.task).budget))
            return next;
        if (Date.now() - active.hintAt > 1200) {
            active.hintAt = Date.now();
            active.client.send('cableHint', { ok: false, message: 'Кабель натянут или упирается в препятствие. Вернитесь к креплению и закрепите поворот в планшете.' });
        }
        return { x: from.x, z: from.z };
    }
    blocksDoor() {
        for (const path of visibleCablePaths(this.room.state.players.values()).values()) {
            for (let i = 1; i < path.length; i++)
                if (segmentHitsBox(path[i - 1], path[i], ENTRY_DOOR_CLOSED))
                    return true;
        }
        return false;
    }
}
