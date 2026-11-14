import type { ProgressAction } from "@netcity/shared";
const KEY = "netcity-pending-operation";
let memory: ProgressAction | null = null;
export function pendingProgress(): ProgressAction | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const action = JSON.parse(raw);
      if (
        ["buy", "accept", "cancel"].includes(action.type) &&
        typeof action.requestId === "string"
      )
        return action;
    }
  } catch {}
  return memory;
}
export function savePending(action: ProgressAction | null) {
  memory = action;
  try {
    if (action) sessionStorage.setItem(KEY, JSON.stringify(action));
    else sessionStorage.removeItem(KEY);
  } catch {}
}

// getRandomValues also works on a LAN HTTP origin, unlike randomUUID in some browsers.
export function operationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
