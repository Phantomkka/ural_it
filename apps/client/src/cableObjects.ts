import { MeshBuilder, TransformNode, Vector3, type Mesh, type Scene } from './babylon';
import { CABLE_SOURCE, CABLE_TARGET, visibleCablePaths, type CableTask, type PlayerView } from '@netcity/shared';
import { sign, type Palette } from './visuals';
export function createCableRoll(scene: Scene, mat: Palette, name: string) {
    const root = new TransformNode(name, scene);
    for (const [i, x] of [-0.15, 0, 0.15].entries()) {
        const part = MeshBuilder.CreateCylinder(name + '-' + i, { diameter: i === 1 ? 0.4 : 0.55, height: i === 1 ? 0.28 : 0.04, tessellation: 12 }, scene);
        part.rotation.z = Math.PI / 2;
        part.position.x = x;
        part.parent = root;
        part.material = mat(i === 1 ? 'cable-roll' : 'cable-roll-flange', i === 1 ? '#4fd9be' : '#c09b65');
        part.metadata = { cableTarget: true, cableDynamic: true };
    }
    return root;
}
export function buildCableObjects(scene: Scene, mat: Palette) {
    const roll = createCableRoll(scene, mat, 'training-roll');
    roll.position.set(CABLE_SOURCE.x, 0.3, CABLE_SOURCE.z);
    const label = sign(scene, 'training-roll-label', 'КЛАДОВАЯ · БУХТА 18 М', 2.5, 0.35);
    label.mesh.position.set(CABLE_SOURCE.x, 1.8, CABLE_SOURCE.z);
    label.mesh.billboardMode = 7;
    label.mesh.isPickable = false;
    const end = sign(scene, 'training-port-label', 'УЧЕБНЫЙ КАБЕЛЬ', 1.6, 0.24);
    end.mesh.position.set(CABLE_TARGET.x, 2.6, CABLE_TARGET.z);
    end.mesh.billboardMode = 7;
    end.mesh.isPickable = false;
    let task: CableTask | undefined;
    const meshes = new Map<string, {
        mesh: Mesh;
        count: number;
        signature: string;
    }>();
    const material = mat('laid-cable', '#43d4bb');
    return { setTask(c: CableTask | undefined) { task = c; }, update(players: Map<string, PlayerView>) {
            roll.setEnabled(!task?.carrier);
            const pos = task?.endpoint ?? CABLE_SOURCE;
            roll.position.set(pos.x, 0.3, pos.z);
            const seen = new Set<string>();
            for (const [id, raw] of visibleCablePaths(players.values())) {
                const path: Vector3[] = [];
                for (const point of raw) {
                    const v = new Vector3(point.x, 0.12, point.z);
                    if (!path.length || Vector3.Distance(path.at(-1)!, v) > 0.02)
                        path.push(v);
                }
                if (path.length < 2)
                    continue;
                seen.add(id);
                const signature = path.map(p => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join(';');
                let prior = meshes.get(id);
                if (prior?.signature === signature)
                    continue;
                if (prior && prior.count !== path.length) {
                    prior.mesh.dispose();
                    meshes.delete(id);
                    prior = undefined;
                }
                const mesh = MeshBuilder.CreateTube('physical-cable-' + id, { path, radius: 0.025, tessellation: 5, updatable: true, ...(prior ? { instance: prior.mesh } : {}) }, scene);
                mesh.material = material;
                mesh.isPickable = false;
                meshes.set(id, { mesh, count: path.length, signature });
            }
            for (const [id, entry] of meshes)
                if (!seen.has(id)) {
                    entry.mesh.dispose();
                    meshes.delete(id);
                }
        } };
}
