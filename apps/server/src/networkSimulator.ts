import {
  COMMANDS,
  COMPUTERS,
  GATEWAY,
  INTRANET,
  MASK,
  type DeviceView,
  type EquipmentView,
  type NetworkConfig,
} from "@netcity/shared";
export const ipv4 = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 15 &&
  /^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value) &&
  value.split(".").every((n) => Number(n) <= 255);
export function validConfig(value: unknown): value is NetworkConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as NetworkConfig;
  return (
    [c.ip, c.mask, c.gateway, c.dns].every(ipv4) &&
    c.mask === MASK &&
    !["0", "255"].includes(c.ip.split(".")[3])
  );
}
export function localLink(
  device: DeviceView,
  devices: Map<string, DeviceView>,
) {
  return (
    device.powered &&
    device.interfaces.get("eth0")!.connected &&
    !!devices.get("switch")?.powered &&
    !!devices.get("switch")?.interfaces.get("eth0")?.connected
  );
}
export function gatewayReachable(
  device: DeviceView,
  devices: Map<string, DeviceView>,
  equipment: EquipmentView,
) {
  const nic = device.interfaces.get("eth0")!;
  return (
    localLink(device, devices) &&
    nic.ip.startsWith("192.168.10.") &&
    nic.mask === MASK &&
    nic.gateway === GATEWAY &&
    equipment.port3Connected &&
    !!devices.get("router")?.powered &&
    !!devices.get("router")?.interfaces.get("eth0")?.connected
  );
}
export function dnsReachable(
  device: DeviceView,
  devices: Map<string, DeviceView>,
  equipment: EquipmentView,
) {
  return (
    gatewayReachable(device, devices, equipment) &&
    device.interfaces.get("eth0")!.dns === GATEWAY
  );
}
/** Pure allowlisted virtual commands. Strings never leave the simulator. */
export function simulateCommand(
  device: DeviceView,
  devices: Map<string, DeviceView>,
  equipment: EquipmentView,
  input: string,
) {
  const command = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!COMMANDS.includes(command))
    return {
      ok: false,
      command,
      output: "Неизвестная игровая команда. Введите help.",
    };
  if (command === "clear")
    return { ok: true, command, output: "", clear: true };
  if (command === "help")
    return {
      ok: true,
      command,
      output: `Учебный симулятор сети. Доступные команды:\n${COMMANDS.join("\n")}\nРеальная оболочка и внешняя сеть недоступны.`,
    };
  const nic = device.interfaces.get("eth0")!;
  if (command === "ipconfig")
    return {
      ok: true,
      command,
      output: `${device.name} / ${device.id}\nИнтерфейс: ${nic.id}\nПитание: ${device.powered ? "включено" : "выключено"}\nКабель: ${nic.connected ? "подключён" : "отключён"}\nIPv4: ${nic.ip}\nМаска: ${nic.mask}\nШлюз: ${nic.gateway}\nDNS: ${nic.dns}`,
    };
  const gateway = gatewayReachable(device, devices, equipment);
  if (command.startsWith("nslookup")) {
    const ok = dnsReachable(device, devices, equipment);
    return {
      ok,
      command,
      output: ok
        ? `Сервер DNS: ${nic.dns}\nИмя: ${INTRANET}\nАдрес: 192.168.10.10`
        : `Сервер DNS: ${nic.dns}\nНе удалось разрешить ${INTRANET}. Проверьте DNS и связь со шлюзом.`,
    };
  }
  const target = command.split(" ")[1];
  const remote = devices.get("pc02")!;
  const remoteNic = remote.interfaces.get("eth0")!;
  const ok =
    target === GATEWAY
      ? gateway
      : localLink(device, devices) &&
        nic.ip.startsWith("192.168.10.") &&
        nic.mask === MASK &&
        localLink(remote, devices) &&
        remoteNic.ip === COMPUTERS[1].ip &&
        remoteNic.mask === MASK;
  const reason = !nic.connected
    ? "Сетевой кабель отключён."
    : !equipment.port3Connected
      ? "Проверьте общий uplink: заявка №001, порт №3."
      : "Проверьте питание, адрес, маску, шлюз и кабель целевого устройства.";
  return {
    ok,
    command,
    output: ok
      ? command.startsWith("tracert")
        ? `Трассировка ${target}\n1   <1 мс   ${GATEWAY}\nТрассировка завершена.`
        : `Ответ от ${target}: байт=32 время<1 мс TTL=64\nОтправлено: 4, получено: 4, потеряно: 0 (0%)`
      : `Узел ${target} недоступен. ${reason}\nОтправлено: 4, получено: 0, потеряно: 4 (100%)`,
  };
}
