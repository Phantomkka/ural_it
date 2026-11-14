export const DEFAULT_BINDINGS = {
  forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD",
  sprint: "ShiftLeft", interact: "KeyE", inventory: "KeyI",
  journal: "KeyJ", map: "KeyM", help: "KeyH",
} as const;
export type Binding = keyof typeof DEFAULT_BINDINGS;
export interface Settings {
  sensitivity: number;
  invertY: boolean;
  volume: number;
  bindings: Record<Binding, string>;
}
export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1, invertY: false, volume: 0.35, bindings: { ...DEFAULT_BINDINGS },
};
export function readSettings(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem("netcity-settings-v2") ?? "null");
    if (!value) return structuredClone(DEFAULT_SETTINGS);
    const bindings = { ...DEFAULT_BINDINGS } as Record<Binding, string>;
    const candidate = value.bindings;
    if (candidate && Object.keys(bindings).every(k =>
      /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(candidate[k])) &&
      new Set(Object.keys(bindings).map(k => candidate[k])).size === Object.keys(bindings).length)
      Object.assign(bindings, candidate);
    return {
      sensitivity: typeof value.sensitivity === "number" && Number.isFinite(value.sensitivity)
        ? Math.max(0.25, Math.min(3, value.sensitivity)) : 1,
      invertY: value.invertY === true,
      volume: typeof value.volume === "number" && Number.isFinite(value.volume)
        ? Math.max(0, Math.min(1, value.volume)) : 0.35,
      bindings,
    };
  } catch { return structuredClone(DEFAULT_SETTINGS); }
}
export function saveSettings(settings: Settings) {
  try { localStorage.setItem("netcity-settings-v2", JSON.stringify(settings)); } catch { /* Session settings still work. */ }
}
export function keyLabel(code: string) {
  return code.replace("Key", "").replace("Digit", "").replace("ShiftLeft", "Shift").replace("ShiftRight", "Shift R")
    .replace("ArrowUp", "↑").replace("ArrowDown", "↓").replace("ArrowLeft", "←").replace("ArrowRight", "→");
}
export function isEditing(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest("input,textarea,select,[contenteditable=true]");
}
