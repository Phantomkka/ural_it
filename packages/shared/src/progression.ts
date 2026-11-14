/** Rules for virtual NET credits only. The server is the authority. */
export const LEVELS = [0, 60, 180, 360] as const;
export const REPEAT_DELAY_MS = 30_000;
export const ITEMS = {
  patch_cord: { name: "Патч-корд", price: 30, consumable: true },
  cleaner: { name: "Баллон для очистки", price: 20, consumable: true },
  toolkit: { name: "Набор инструментов", price: 50, consumable: false },
} as const;
export type ItemId = keyof typeof ITEMS;
export const WORK = {
  patch: {
    title: "Восстановить сетевой порт №3",
    goal: "Осмотреть коммутатор и подключить патч-корд в порт №3.",
    credits: 100,
    xp: 60,
    item: "patch_cord",
  },
  rack: {
    title: "Обслужить охлаждение стойки",
    goal: "Осмотреть стойку и очистить систему охлаждения. Нужны инструменты и баллон для очистки.",
    credits: 80,
    xp: 50,
    item: "cleaner",
  },
} as const;
export type WorkKind = keyof typeof WORK;
export interface WorkOrder {
  id: string;
  kind: WorkKind;
  status: "AVAILABLE" | "ACTIVE" | "COMPLETED";
  stage: number;
  tutorial: boolean;
  availableAt: number;
  completedAt: number | null;
}
export interface PrivateProfile {
  /** Paid computer diagnostics, once per profile. Older clients ignore this additive field. */
  diagnostics?: string[];
  nickname: string;
  credits: number;
  xp: number;
  level: number;
  levelStart: number;
  nextLevelXp: number | null;
  inventory: Record<ItemId, number>;
  jobs: WorkOrder[];
  tutorialCompleted: boolean;
  version: number;
  persistence: "temporary" | "postgres";
}
export const DIAGNOSTIC_REWARD = { credits: 60, xp: 40 } as const;
export type ProgressIntent =
  | { type: "buy"; itemId: ItemId }
  | { type: "accept" | "cancel"; jobId: string };
export type ProgressAction =
  | { type: "refresh" }
  | (ProgressIntent & { requestId: string });
export interface ProgressResult {
  ok: boolean;
  message: string;
  replayed?: boolean;
  requestId?: string;
}
export function levelFor(xp: number) {
  let index = 0;
  while (index + 1 < LEVELS.length && xp >= LEVELS[index + 1]) index++;
  return {
    level: index + 1,
    levelStart: LEVELS[index],
    nextLevelXp: LEVELS[index + 1] ?? null,
  };
}
