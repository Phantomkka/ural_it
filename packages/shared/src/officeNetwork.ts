/** Serializable game protocol. No renderer or real networking is involved. */
export const COMPUTERS = [
  {
    id: "pc01",
    name: "OFFICE-PC01",
    ip: "192.168.10.101",
    x: 10,
    z: -4,
    port: 1,
  },
  {
    id: "pc02",
    name: "OFFICE-PC02",
    ip: "192.168.10.102",
    x: 15,
    z: 4,
    port: 2,
  },
  {
    id: "pc03",
    name: "OFFICE-PC03",
    ip: "192.168.10.103",
    x: 10,
    z: 4,
    port: 4,
  },
] as const;
export type ComputerId = (typeof COMPUTERS)[number]["id"];
export const GATEWAY = "192.168.10.1";
export const MASK = "255.255.255.0";
export const INTRANET = "intranet.netcity.local";
export interface NetworkConfig {
  ip: string;
  mask: string;
  gateway: string;
  dns: string;
}
export interface InterfaceView extends NetworkConfig {
  id: string;
  connected: boolean;
}
export interface DeviceView {
  id: string;
  name: string;
  kind: string;
  powered: boolean;
  revision: number;
  interfaces: Map<string, InterfaceView>;
}
export interface ProgressView {
  stage: number;
  status: string;
  verifiedRevision: number;
}
export const JOBS = [
  {
    id: "002",
    pcId: "pc02",
    title: "Компьютер без сети",
    description:
      "OFFICE-PC02 не подключается к локальной сети. Проверьте физическое соединение и доступность шлюза.",
    steps: [
      "Найти и открыть OFFICE-PC02",
      "Открыть терминал",
      "Выполнить диагностику (ipconfig или ping)",
      "Проверить физическое подключение",
      "Подключить или подтвердить кабель",
      "Проверить шлюз командой ping 192.168.10.1",
      "Закрыть заявку",
    ],
  },
  {
    id: "003",
    pcId: "pc03",
    title: "Неправильный IP-адрес",
    description:
      "OFFICE-PC03 не подключается к корпоративной сети. Проверьте адрес, маску и шлюз.",
    steps: [
      "Найти и открыть OFFICE-PC03",
      "Открыть терминал",
      "Проверить ipconfig",
      "Открыть сетевые настройки",
      "Сохранить правильные IP, маску и шлюз",
      "Проверить шлюз командой ping 192.168.10.1",
      "Закрыть заявку",
    ],
  },
  {
    id: "004",
    pcId: "pc01",
    title: "Проблема с DNS",
    description:
      "OFFICE-PC01 не открывает внутренний ресурс. Проверьте шлюз и разрешение intranet.netcity.local.",
    steps: [
      "Найти и открыть OFFICE-PC01",
      "Открыть терминал",
      "Успешно проверить ping 192.168.10.1",
      "Проверить nslookup intranet.netcity.local",
      "Открыть сетевые настройки",
      "Сохранить правильный DNS-сервер",
      "Повторить nslookup intranet.netcity.local",
      "Закрыть заявку",
    ],
  },
] as const;
export type JobId = (typeof JOBS)[number]["id"];
export type ComputerAction =
  | {
      type:
        | "open"
        | "terminal"
        | "settings"
        | "inspectCable"
        | "connectCable"
        | "closeTicket";
      pcId: ComputerId;
    }
  | { type: "command"; pcId: ComputerId; command: string }
  | { type: "configure"; pcId: ComputerId; config: NetworkConfig };
export interface ComputerResult {
  ok: boolean;
  message: string;
  pcId?: ComputerId;
  open?: boolean;
  output?: string;
  clear?: boolean;
}
export function canReachComputer(
  player: { x: number; z: number },
  id: ComputerId,
) {
  const pc = COMPUTERS.find((p) => p.id === id);
  if (!pc || !Number.isFinite(player.x) || !Number.isFinite(player.z))
    return false;
  const sameRoom =
    pc.x < 13
      ? player.x > 8.55 && player.x < 12.45
      : player.x > 13.55 && player.x < 19.45;
  return (
    sameRoom &&
    Math.abs(player.z) < 5.45 &&
    Math.hypot(player.x - pc.x, player.z - pc.z) <= 2.5
  );
}
export const COMMANDS = [
  "ipconfig",
  "ping 192.168.10.1",
  "ping 192.168.10.102",
  "tracert 192.168.10.1",
  "nslookup intranet.netcity.local",
  "help",
  "clear",
];
