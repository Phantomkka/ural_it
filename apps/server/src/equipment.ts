import {
  canReachSwitch,
  type PlayerView,
  type EquipmentView,
  type ActionResult,
} from "@netcity/shared";
/** All actions use the authoritative player position, never message coordinates. */
export function handleEquipment(
  player: PlayerView,
  equipment: EquipmentView,
  value: unknown,
): ActionResult {
  if (!canReachSwitch(player))
    return {
      ok: false,
      message: "Подойдите к коммутатору на расстояние до 2,5 м.",
    };
  if (!value || typeof value !== "object")
    return { ok: false, message: "Недопустимое действие." };
  const action = value as { type?: unknown; port?: unknown };
  if (action.type === "inspect") {
    player.ticketStep = Math.max(player.ticketStep, 5);
    return {
      ok: true,
      inspected: true,
      message: equipment.port3Connected
        ? "Сеть уже восстановлена. Подтвердите порт №3 для своей заявки."
        : "Обнаружен отключённый патч-корд. Подключите его в порт №3.",
    };
  }
  if (action.type !== "connect" || action.port !== 3)
    return { ok: false, message: "Нужен порт №3. Другие порты уже заняты." };
  if (player.ticketStep < 5)
    return { ok: false, message: "Сначала осмотрите коммутатор." };
  if (player.ticketStep >= 6)
    return {
      ok: false,
      message: "Заявка уже выполнена. Повторная награда недоступна.",
    };
  equipment.port3Connected = true;
  player.ticketStep = 6;
  player.rewards += 1;
  return { ok: true, message: "✅ Заявка выполнена! Сеть восстановлена." };
}
