import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  ITEMS,
  levelFor,
  type ItemId,
  type WorkOrder,
  type PrivateProfile,
  type ProgressResult,
} from "@netcity/shared";
export interface ProfileData {
  id: string;
  nickname: string;
  credits: number;
  xp: number;
  inventory: Record<ItemId, number>;
  jobs: WorkOrder[];
  tutorialCompleted: boolean;
  version: number;
}
export interface Operation {
  fingerprint: string;
  result: ProgressResult;
}
export interface Reward {
  jobId: string;
  credits: number;
  xp: number;
}
export interface Transaction {
  data: ProfileData;
  operation?: Operation;
  reward?: Reward;
  saveOperation?: Operation;
}
export interface ProgressStore {
  mode: PrivateProfile["persistence"];
  register(): Promise<{ token: string; profileId: string }>;
  identify(token: string): Promise<string | null>;
  read(id: string): Promise<ProfileData>;
  transaction(
    id: string,
    key: string | null,
    work: (tx: Transaction) => ProgressResult,
  ): Promise<{ result: ProgressResult; data: ProfileData }>;
  health(): Promise<void>;
  close(): Promise<void>;
}
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const validToken = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const newJob = (
  kind: WorkOrder["kind"],
  tutorial = false,
): WorkOrder => ({
  id: randomUUID(),
  kind,
  status: "AVAILABLE",
  stage: 0,
  tutorial,
  availableAt: 0,
  completedAt: null,
});
export function newProfile(): ProfileData {
  const id = randomUUID();
  return {
    id,
    nickname: `Инженер ${id.slice(0, 6)}`,
    credits: 0,
    xp: 0,
    inventory: { patch_cord: 0, cleaner: 0, toolkit: 1 },
    jobs: [newJob("patch", true), newJob("rack")],
    tutorialCompleted: false,
    version: 0,
  };
}
export function snapshot(
  data: ProfileData,
  mode: ProgressStore["mode"],
): PrivateProfile {
  const { id: _id, ...privateData } = structuredClone(data);
  return { ...privateData, ...levelFor(data.xp), persistence: mode };
}
export function assertProfile(data: ProfileData) {
  if (
    ![
      data.credits,
      data.xp,
      data.version,
      ...Object.values(data.inventory),
    ].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 2_147_483_647) ||
    Object.keys(ITEMS).some(
      (id) => !Number.isInteger(data.inventory[id as ItemId]),
    ) ||
    data.jobs.filter((j) => j.status === "ACTIVE").length > 1 ||
    new Set(data.jobs.map((j) => j.id)).size !== data.jobs.length
  )
    throw Error("Profile invariant violation");
}
/** In-memory adapter obeys the same transaction and uniqueness contract as PostgreSQL. */
export class MemoryProgressStore implements ProgressStore {
  mode = "temporary" as const;
  private profiles = new Map<string, ProfileData>();
  private identities = new Map<string, string>();
  private operations = new Map<string, Operation>();
  private rewards = new Set<string>();
  private tail: Promise<unknown> = Promise.resolve();
  async register() {
    const token = randomBytes(32).toString("hex"),
      data = newProfile();
    this.profiles.set(data.id, data);
    this.identities.set(hashToken(token), data.id);
    return { token, profileId: data.id };
  }
  async identify(token: string) {
    return validToken(token)
      ? (this.identities.get(hashToken(token)) ?? null)
      : null;
  }
  async read(id: string) {
    await this.tail;
    const data = this.profiles.get(id);
    if (!data) throw Error("Unknown profile");
    return structuredClone(data);
  }
  async transaction(
    id: string,
    key: string | null,
    work: (tx: Transaction) => ProgressResult,
  ) {
    const task = this.tail.then(() => {
      const original = this.profiles.get(id);
      if (!original) throw Error("Unknown profile");
      const data = structuredClone(original),
        opKey = `${id}:${key}`,
        tx: Transaction = {
          data,
          operation: key ? this.operations.get(opKey) : undefined,
        };
      const result = work(tx);
      assertProfile(data);
      if (tx.reward && this.rewards.has(tx.reward.jobId))
        throw Error("Duplicate reward");
      if (JSON.stringify(data) !== JSON.stringify(original)) data.version++;
      this.profiles.set(id, data);
      if (tx.saveOperation && key)
        this.operations.set(opKey, structuredClone(tx.saveOperation));
      if (tx.reward) this.rewards.add(tx.reward.jobId);
      return { result, data: structuredClone(data) };
    });
    this.tail = task.catch(() => {});
    return task;
  }
  async health() {}
  async close() {}
}
