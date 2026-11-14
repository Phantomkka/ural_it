import {
  COMPUTERS,
  JOBS,
  GATEWAY,
  MASK,
  canReachComputer,
  type ComputerId,
  type ComputerResult,
  type EquipmentView,
} from "@netcity/shared";
import {
  gatewayReachable,
  dnsReachable,
  simulateCommand,
  validConfig,
} from "./networkSimulator.js";
import type { Player } from "./StreetRoom.js";
import type { NetworkDevice } from "./networkState.js";
export function handleComputer(
  player: Player,
  devices: Map<string, NetworkDevice>,
  equipment: EquipmentView,
  value: unknown,
): ComputerResult {
  const fail = (message: string): ComputerResult => ({ ok: false, message });
  if (!value || typeof value !== "object")
    return fail("Некорректное действие компьютера.");
  const action = value as Record<string, unknown>;
  const pc = COMPUTERS.find((p) => p.id === action.pcId);
  if (!pc) return fail("Неизвестный компьютер.");
  if (!canReachComputer(player, pc.id))
    return fail(
      "Подойдите к компьютеру на расстояние до 2,5 метра в той же комнате.",
    );
  const device = devices.get(pc.id)!;
  const nic = device.interfaces.get("eth0")!;
  const job = JOBS.find((j) => j.pcId === pc.id)!;
  const progress = player.jobs.get(job.id)!;
  let event = "",
    output: string | undefined,
    clear = false,
    open = false;
  let message = "",
    ok = true;
  switch (action.type) {
    case "open":
      event = "open";
      open = true;
      message = `Рабочий стол ${pc.name}`;
      break;
    case "terminal":
      event = "terminal";
      message = "Терминал открыт. Введите help для справки.";
      break;
    case "settings":
      event = "settings";
      message =
        "Рекомендуется: IPv4 " +
        pc.ip +
        ", маска " +
        MASK +
        ", шлюз и DNS " +
        GATEWAY;
      break;
    case "inspectCable":
      event = "inspectCable";
      message = `${pc.name} → коммутатор, порт №${pc.port}: кабель ${nic.connected ? "подключён" : "отключён"}.`;
      break;
    case "connectCable":
      if (!nic.connected) {
        nic.connected = true;
        device.revision++;
      }
      event = "connectCable";
      message = `Физическое подключение ${pc.name} подтверждено.`;
      break;
    case "configure": {
      if (!validConfig(action.config))
        return fail(
          "Введите корректные IPv4-адреса. Поддерживается маска 255.255.255.0; адрес узла не может оканчиваться на 0 или 255.",
        );
      const config = action.config;
      if (
        ["192.168.10.1", "192.168.10.2", "192.168.10.10"].includes(config.ip) ||
        [...devices.values()].some(
          (d) =>
            d.id !== device.id && d.interfaces.get("eth0")?.ip === config.ip,
        )
      )
        return fail("IP-адрес занят другим устройством.");
      if (
        (["ip", "mask", "gateway", "dns"] as const).some(
          (key) => nic[key] !== config[key],
        )
      ) {
        nic.ip = config.ip;
        nic.mask = config.mask;
        nic.gateway = config.gateway;
        nic.dns = config.dns;
        device.revision++;
      }
      event = "configure";
      message = "Сетевые настройки сохранены на сервере.";
      break;
    }
    case "command": {
      if (typeof action.command !== "string" || action.command.length > 128)
        return fail("Команда должна содержать не более 128 символов.");
      const result = simulateCommand(
        device,
        devices,
        equipment,
        action.command,
      );
      output = result.output;
      clear = !!result.clear;
      ok = result.ok;
      event = result.command;
      message = result.ok
        ? "Команда выполнена игровым симулятором."
        : "Диагностика: обнаружена проблема. См. вывод терминала.";
      break;
    }
    case "closeTicket": {
      if (progress.status === "COMPLETED")
        return fail("Заявка уже выполнена. Повторная награда недоступна.");
      const healthy =
        job.id === "004"
          ? dnsReachable(device, devices, equipment)
          : gatewayReachable(device, devices, equipment);
      if (
        progress.stage !== job.steps.length - 1 ||
        progress.verifiedRevision !== device.revision ||
        !healthy
      )
        return fail(
          "Пройдите все этапы и повторите проверку после изменения сети.",
        );
      progress.stage++;
      progress.status = "COMPLETED";
      player.rewards++;
      return {
        ok: true,
        pcId: pc.id,
        message: `✅ Заявка №${job.id} выполнена! Неисправность устранена.`,
      };
    }
    default:
      return fail("Недопустимое действие компьютера.");
  }
  const correctAddress =
    nic.ip === pc.ip && nic.mask === MASK && nic.gateway === GATEWAY;
  const ping = event === "ping 192.168.10.1" && ok;
  const lookup = event === "nslookup intranet.netcity.local";
  const steps =
    job.id === "002"
      ? [
          event === "open",
          event === "terminal",
          [
            "ipconfig",
            "ping 192.168.10.1",
            "ping 192.168.10.102",
            "tracert 192.168.10.1",
          ].includes(event),
          event === "inspectCable",
          event === "connectCable" && nic.connected,
          ping,
        ]
      : job.id === "003"
        ? [
            event === "open",
            event === "terminal",
            event === "ipconfig",
            event === "settings",
            event === "configure" && correctAddress,
            ping,
          ]
        : [
            event === "open",
            event === "terminal",
            ping,
            lookup,
            event === "settings",
            event === "configure" && nic.dns === GATEWAY,
            lookup && ok,
          ];
  if (progress.status !== "COMPLETED") {
    if (steps[progress.stage]) {
      progress.stage++;
      progress.status = "IN_PROGRESS";
      message += ` Этап №${job.id}: ${progress.stage}/${job.steps.length}. Далее: ${job.steps[progress.stage]}.`;
    }
    // Re-running verification refreshes evidence after any shared configuration change.
    if (
      progress.stage === job.steps.length - 1 &&
      (job.id === "004" ? lookup && ok : ping)
    )
      progress.verifiedRevision = device.revision;
  }
  return { ok, message, pcId: pc.id as ComputerId, open, output, clear };
}
