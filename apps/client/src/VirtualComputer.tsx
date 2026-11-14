import { useEffect, useRef, useState, type RefObject } from "react";
import {
  COMMANDS,
  COMPUTERS,
  JOBS,
  type ComputerAction,
  type ComputerId,
  type ComputerResult,
  type DeviceView,
  type NetworkConfig,
  type ProgressView,
} from "@netcity/shared";
export interface ComputerSnapshot extends Omit<DeviceView, "interfaces"> {
  interfaces: Map<string, { id: string; connected: boolean } & NetworkConfig>;
}
export function VirtualComputer({
  device,
  uplink,
  progress,
  result,
  send,
  close,
  dialogRef,
}: {
  device: ComputerSnapshot;
  uplink: boolean;
  progress?: ProgressView;
  result: ComputerResult | null;
  send: (action: ComputerAction) => void;
  close: () => void;
  dialogRef: RefObject<HTMLElement | null>;
}) {
  const pcId = device.id as ComputerId,
    nic = device.interfaces.get("eth0")!;
  const [app, setApp] = useState<"desktop" | "terminal" | "settings" | "info">(
    "desktop",
  );
  const [command, setCommand] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);
  const [lines, setLines] = useState<string[]>([
    "NETCITY OS · учебный терминал. Введите help.",
  ]);
  const [config, setConfig] = useState<NetworkConfig>({ ...nic });
  const [dirty, setDirty] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [changed, setChanged] = useState(false);
  const job = JOBS.find((j) => j.pcId === pcId)!;
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!dirty)
      setConfig({
        ip: nic.ip,
        mask: nic.mask,
        gateway: nic.gateway,
        dns: nic.dns,
      });
    else setChanged(true);
  }, [device.revision]);
  useEffect(() => {
    if (result?.pcId !== pcId) return;
    if (result.clear) setLines([]);
    else if (result.output !== undefined)
      setLines((old) => [...old, result.output!].slice(-60));
  }, [result, pcId]);
  useEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [lines, app]);
  const openApp = (next: typeof app) => {
    setApp(next);
    if (next === "terminal" || next === "settings") send({ type: next, pcId });
  };
  const execute = (text: string) => {
    setLines((old) => [...old, `${device.name}> ${text}`].slice(-60));
    send({ type: "command", pcId, command: text });
    setCommand("");
  };
  return (
    <div className="modal-backdrop computer-backdrop">
      <section
        className="virtual-computer"
        role="dialog"
        aria-modal="true"
        aria-label={`Компьютер ${device.name}`}
        ref={dialogRef}
      >
        <div className="os-title">
          <div>
            <b>NETCITY OS</b>
            <small>
              {device.name} · {device.id}
            </small>
          </div>
          <button onClick={close} aria-label="Закрыть компьютер">
            ✕
          </button>
        </div>
        <div className="os-network" data-connected={nic.connected}>
          <span>● Кабель: {nic.connected ? "подключён" : "отключён"}</span>
          <span>
            Шлюз: {uplink ? "uplink подключён" : "uplink отключён (№001)"}
          </span>
          <span>IPv4: {nic.ip}</span>
        </div>
        <nav className="os-icons" aria-label="Приложения">
          <button onClick={() => openApp("desktop")}>▦ Рабочий стол</button>
          <button onClick={() => openApp("terminal")}>▣ Терминал</button>
          <button onClick={() => openApp("settings")}>
            ⚙ Сетевые настройки
          </button>
          <button onClick={() => openApp("info")}>ⓘ О компьютере</button>
        </nav>
        <main className="os-window" key={app}>
          {app === "desktop" && (
            <>
              <h2>Добро пожаловать, инженер</h2>
              <p>
                Откройте терминал для диагностики, проверьте кабель и сетевые
                настройки. Изменения видны всем игрокам.
              </p>
              <p>
                Общий uplink чинится через порт №3 коммутатора по заявке №001.
              </p>
              <h3>
                Заявка №{job.id}: {job.title}
              </h3>
              <p>{job.description}</p>
            </>
          )}
          {app === "terminal" && (
            <>
              <h2>Терминал · виртуальная сеть</h2>
              <pre
                ref={outputRef}
                className="terminal-output"
                role="log"
                aria-label="Вывод терминала"
              >
                {lines.join("\n\n")}
              </pre>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  execute(command);
                }}
                className="command-form"
              >
                <label htmlFor="terminal-command">Команда</label>
                <input
                  id="terminal-command"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={128}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="help"
                />
                <button type="submit">Выполнить</button>
              </form>
              <div className="command-shortcuts" aria-label="Быстрые команды">
                {COMMANDS.map((c) => (
                  <button key={c} onClick={() => execute(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
          {app === "settings" && (
            <>
              <h2>Сетевые настройки · {nic.id}</h2>
              <p>
                Ожидаемые настройки: {COMPUTERS.find((p) => p.id === pcId)!.ip}{" "}
                / 255.255.255.0. Шлюз и DNS: 192.168.10.1.
              </p>
              <form
                className="network-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  send({ type: "configure", pcId, config });
                  setDirty(false);
                  setChanged(false);
                }}
              >
                {(
                  [
                    ["ip", "IP-адрес"],
                    ["mask", "Маска подсети"],
                    ["gateway", "Основной шлюз"],
                    ["dns", "DNS-сервер"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      inputMode="decimal"
                      autoComplete="off"
                      value={config[key]}
                      maxLength={15}
                      onChange={(e) => {
                        setConfig((c) => ({ ...c, [key]: e.target.value }));
                        setDirty(true);
                      }}
                    />
                  </label>
                ))}
                <button type="submit">Сохранить настройки</button>
                <button
                  type="button"
                  onClick={() => {
                    setConfig({ ...nic });
                    setDirty(false);
                    setChanged(false);
                  }}
                >
                  Обновить с сервера
                </button>
              </form>
              {changed && (
                <p>
                  Настройки изменились у другого игрока. Обновите данные перед
                  сохранением.
                </p>
              )}
            </>
          )}
          {app === "info" && (
            <>
              <h2>{device.name}</h2>
              <dl>
                <dt>Идентификатор</dt>
                <dd>{device.id}</dd>
                <dt>Тип</dt>
                <dd>Рабочая станция</dd>
                <dt>Питание</dt>
                <dd>{device.powered ? "Включено" : "Выключено"}</dd>
                <dt>Сетевой интерфейс</dt>
                <dd>{nic.id}</dd>
                <dt>Порт коммутатора</dt>
                <dd>№{COMPUTERS.find((p) => p.id === pcId)!.port}</dd>
              </dl>
              <p>
                Сеть офиса: Интернет → маршрутизатор 192.168.10.1 → коммутатор
                (8 портов) → PC01 / PC02 / PC03.
              </p>
            </>
          )}
        </main>
        <section className="pc-service">
          <b>Физическое подключение</b>
          <button onClick={() => send({ type: "inspectCable", pcId })}>
            Проверить кабель
          </button>
          <button onClick={() => send({ type: "connectCable", pcId })}>
            {nic.connected ? "Подтвердить подключение" : "Подключить кабель"}
          </button>
          <p>
            №{job.id} · {progress?.status ?? "NEW"} ·{" "}
            {job.steps[progress?.stage ?? 0] ?? "Заявка завершена"}
          </p>
          <button
            disabled={progress?.status === "COMPLETED"}
            onClick={() => send({ type: "closeTicket", pcId })}
          >
            Закрыть заявку №{job.id}
          </button>
        </section>
        {result && (
          <p
            className={`notification ${result.ok ? "success" : "error"}`}
            role="status"
          >
            {result.message}
          </p>
        )}
        <div className="os-taskbar">
          <span>
            ▦ NETCITY OS ·{" "}
            {app === "desktop"
              ? "Рабочий стол"
              : app === "terminal"
                ? "Терминал"
                : app === "settings"
                  ? "Настройки"
                  : "Информация"}
          </span>
          <span>
            {nic.connected ? "● LAN" : "○ Нет кабеля"} ·{" "}
            {clock.toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </section>
    </div>
  );
}
