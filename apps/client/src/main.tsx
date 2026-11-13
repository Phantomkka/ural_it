import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Room } from "@colyseus/sdk";
import { TICKET_STEPS, type ActionResult } from "@netcity/shared";
import { connect, sendEquipment, type NetworkState } from "./network";
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
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setStatus("Подключение…");
    setPanel(false);
    setMessage("");
    setStep(1);
    setRewards(0);
    touch.current.modal = false;
    void connect()
      .then((room) => {
        if (cancelled) {
          void room.leave();
          return;
        }
        roomRef.current = room;
        const world = createWorld(
          canvas.current!,
          room,
          touch.current,
          setTarget,
        );
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
          }
        });
        room.onMessage("actionResult", (result: ActionResult) => {
          if (cancelled) return;
          setMessage(result.message);
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
          roomRef.current = null;
        });
        room.onError((_code, message) => {
          if (!cancelled)
            setStatus(`Ошибка: ${message ?? "соединение потеряно"}`);
        });
        cleanup = () => {
          world.dispose();
          roomRef.current = null;
          worldRef.current = null;
          void room.leave();
        };
      })
      .catch((error) => {
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
  };
  return (
    <>
      <canvas ref={canvas} aria-label="Трёхмерная улица NETCITY" />
      <header>
        <b>
          NETCITY <span>ONLINE</span>
        </b>
        <small>Офис №001 · первая IT-заявка</small>
      </header>
      <aside>
        <i /> {status} <span>Игроков: {count}</span>
        <button onClick={() => setAttempt((v) => v + 1)}>
          Переподключиться
        </button>
      </aside>
      <section className="ticket" aria-label="Заявка №001">
        <details open>
          <summary>Заявка №001: «В офисе пропала сеть»</summary>
          <p>
            Сотрудники офиса жалуются на отсутствие интернета. Необходимо
            проверить сетевое оборудование и восстановить подключение.
          </p>
          <ol>
            {TICKET_STEPS.map((text, i) => (
              <li key={text} className={i < step || step === 6 ? "done" : ""}>
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
          input={touch.current}
          interact={() => worldRef.current?.interact()}
        />
      )}
      {panel && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Коммутатор на 8 портов"
            className="equipment-panel"
          >
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
            <p role="status">{message}</p>
            <button onClick={closePanel}>Закрыть</button>
          </section>
        </div>
      )}
      {!panel && message && (
        <div className="action-message" role="status">
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
