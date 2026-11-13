import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Room } from "@colyseus/sdk";
import { TICKET_STEPS, type ActionResult } from "@netcity/shared";
import {
  connect,
  sendEquipment,
  leaveRoom,
  type NetworkState,
} from "./network";
import { createWorld } from "./world";
import { MobileControls, type TouchInput } from "./controls";
import "./style.css";
function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef<Room<NetworkState> | null>(null);
  const worldRef = useRef<ReturnType<typeof createWorld> | null>(null);
  const touch = useRef<TouchInput>({
    x: 0,
    y: 0,
    lookX: 0,
    lookY: 0,
    modal: false,
  });
  const [status, setStatus] = useState("Подключение…");
  const [count, setCount] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState(1);
  const [rewards, setRewards] = useState(0);
  const [target, setTarget] = useState(false);
  const [panel, setPanel] = useState(false);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);
  const [nickname, setNickname] = useState("");
  const [expanded, setExpanded] = useState(
    () => !matchMedia("(pointer: coarse)").matches,
  );
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!panel) return;
    const dialog = dialogRef.current!;
    const buttons = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button"),
    );
    buttons[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        setPanel(false);
        touch.current.modal = false;
        canvas.current?.focus();
      }
      if (event.code === "Tab" && buttons.length) {
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setStatus("Подключение…");
    setPanel(false);
    setMessage("");
    setStep(1);
    setRewards(0);
    setCount(0);
    setConnected(false);
    setNickname("");
    setTarget(false);
    Object.assign(touch.current, {
      x: 0,
      y: 0,
      lookX: 0,
      lookY: 0,
      modal: false,
    });
    void connect()
      .then((room) => {
        if (cancelled) {
          leaveRoom(room);
          return;
        }
        roomRef.current = room;
        // Register cleanup before constructing WebGL resources so setup failures also release the room.
        let world: ReturnType<typeof createWorld> | undefined;
        cleanup = () => {
          world?.dispose();
          if (worldRef.current === world) worldRef.current = null;
          if (roomRef.current === room) roomRef.current = null;
          leaveRoom(room);
        };
        world = createWorld(canvas.current!, room, touch.current, setTarget);
        worldRef.current = world;
        setStatus("В сети");
        room.onStateChange((state) => {
          if (cancelled) return;
          setCount(state.players.size);
          setConnected(state.equipment.port3Connected);
          const me = state.players.get(room.sessionId);
          if (me) {
            setStep(me.ticketStep);
            setRewards(me.rewards);
            setNickname(me.nickname);
          }
        });
        room.onMessage("actionResult", (result: ActionResult) => {
          if (cancelled) return;
          setMessage(result.message);
          setMessageOk(result.ok);
          if (result.ok && result.inspected) {
            touch.current.modal = true;
            setPanel(true);
            if (document.pointerLockElement) document.exitPointerLock();
          }
        });
        room.onLeave(() => {
          if (cancelled) return;
          setStatus("Соединение закрыто");
          setCount(0);
          setPanel(false);
          touch.current.modal = false;
          worldRef.current = null;
          roomRef.current = null;
          setTarget(false);
        });
        room.onError((_code, message) => {
          if (!cancelled)
            setStatus(`Ошибка: ${message ?? "соединение потеряно"}`);
        });
      })
      .catch((error) => {
        cleanup?.();
        if (!cancelled) setStatus(`Ошибка подключения: ${error.message}`);
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [attempt]);
  const closePanel = () => {
    setPanel(false);
    touch.current.modal = false;
    canvas.current?.focus();
  };
  return (
    <>
      <canvas tabIndex={0} ref={canvas} aria-label="Трёхмерная улица NETCITY" />
      <header>
        <b>
          NETCITY <span>ONLINE</span>
        </b>
        <small>IT DISTRICT / ОФИС №001</small>
      </header>
      <aside data-online={status === "В сети"}>
        <div className="connection">
          <i /> {status}
        </div>
        <span>
          {nickname || "Инженер"} · Игроков: {count}
        </span>
        <button onClick={() => setAttempt((v) => v + 1)}>
          Переподключиться
        </button>
      </aside>
      <section className="ticket" aria-label="Заявка №001">
        <div className="eyebrow">SERVICE DESK / #001</div>
        <h2>В офисе пропала сеть</h2>
        <div
          className="ticket-progress"
          role="progressbar"
          aria-label="Прогресс заявки"
          aria-valuemin={0}
          aria-valuemax={6}
          aria-valuenow={step}
          style={
            { "--progress": `${(step / 6) * 100}%` } as React.CSSProperties
          }
        />
        <p className="next-step">
          {step === 6 ? "Все этапы пройдены" : TICKET_STEPS[step]}
        </p>
        <details
          open={expanded}
          onToggle={(e) => setExpanded(e.currentTarget.open)}
        >
          <summary>Описание и этапы</summary>
          <p>
            Сотрудники офиса жалуются на отсутствие интернета. Необходимо
            проверить сетевое оборудование и восстановить подключение.
          </p>
          <ol>
            {TICKET_STEPS.map((text, i) => (
              <li
                key={text}
                className={
                  i < step || step === 6 ? "done" : i === step ? "current" : ""
                }
              >
                {i < step || step === 6 ? "✓ " : ""}
                {text}
              </li>
            ))}
          </ol>
          <small>Награды за заявку: {rewards}/1</small>
        </details>
        {step === 6 && (
          <strong role="status">
            ✅ Заявка выполнена! Сеть восстановлена.
          </strong>
        )}
      </section>
      <div className="crosshair">+</div>
      {target && !panel && (
        <div className="interaction-hint">[E] Осмотреть коммутатор</div>
      )}
      {!panel && (
        <MobileControls
          key={attempt}
          enabled={target}
          input={touch.current}
          interact={() => worldRef.current?.interact()}
        />
      )}
      {panel && (
        <div className="modal-backdrop">
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Коммутатор на 8 портов"
            className="equipment-panel"
          >
            <div className="eyebrow">SERVER ROOM / SW-001</div>
            <h2>Коммутатор · 8 портов</h2>
            <p>Патч-панель → коммутатор</p>
            <div className="ports">
              {Array.from({ length: 8 }, (_, i) => {
                const port = i + 1;
                const online = port !== 3 || connected;
                return (
                  <button
                    key={port}
                    data-port={port}
                    className={online ? "online" : "offline"}
                    onClick={() =>
                      roomRef.current &&
                      sendEquipment(roomRef.current, {
                        type: "connect",
                        port,
                      })
                    }
                  >
                    Порт №{port}
                    <small>{online ? "Подключён" : "Отключён"}</small>
                  </button>
                );
              })}
            </div>
            <p
              role="status"
              className={`notification ${messageOk ? "success" : "error"}`}
            >
              {messageOk ? "✓ " : "! "}
              {message}
            </p>
            <button onClick={closePanel}>Закрыть</button>
          </section>
        </div>
      )}
      {!panel && message && (
        <div
          className={`action-message notification ${messageOk ? "success" : "error"}`}
          role="status"
        >
          {message}
        </div>
      )}
      <footer>
        <small>
          WASD — движение · мышь — обзор · E — осмотр · Esc — курсор
          <br />
          На смартфоне: джойстик слева, обзор свайпом справа.
        </small>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
