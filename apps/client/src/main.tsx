import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Room } from "@colyseus/sdk";
import {
  TICKET_STEPS,
  type ActionResult,
  type PrivateProfile,
  type ProgressResult,
  type ProgressIntent,
  type ProgressAction,
} from "@netcity/shared";
import {
  connect,
  sendEquipment,
  sendProgress,
  leaveRoom,
  type NetworkState,
} from "./network";
import { MODEL_COUNT, type GraphicsProgress } from "./assets";
import { defaultQuality, type Quality } from "./quality";
import { createWorld } from "./world";
import { MobileControls, type TouchInput } from "./controls";
import { ProgressPanel } from "./ProgressPanel";
import { pendingProgress, savePending, operationId } from "./pendingProgress";
import "./style.css";
function App() {
  const [quality, setQuality] = useState<Quality>(defaultQuality);
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const [graphics, setGraphics] = useState<GraphicsProgress>({
    state: "loading",
    loaded: 0,
    total: MODEL_COUNT,
    failed: [],
  });
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
  const [economy, setEconomy] = useState(false);
  const [profile, setProfile] = useState<PrivateProfile | null>(null);
  const [progressResult, setProgressResult] = useState<ProgressResult | null>(
    null,
  );
  const [pending, setPending] = useState<ProgressAction | null>(
    pendingProgress,
  );
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [rackServiced, setRackServiced] = useState(false);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);
  const [nickname, setNickname] = useState("");
  const [expanded, setExpanded] = useState(
    () => !matchMedia("(pointer: coarse)").matches,
  );
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!panel && !economy) return;
    const dialog = dialogRef.current!;
    const buttons = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button"),
    );
    buttons[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        setEconomy(false);
        setPanel(false);
        touch.current.modal = false;
        canvas.current?.focus();
      }
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
      if (event.code === "Tab" && focusable.length) {
        const first = focusable[0],
          last = focusable[focusable.length - 1];
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
  }, [panel, economy]);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setStatus("Подключение…");
    setGraphics({
      state: "loading",
      loaded: 0,
      total: MODEL_COUNT,
      failed: [],
    });
    setPanel(false);
    setEconomy(false);
    setProfile(null);
    setProgressResult(null);
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
        world = createWorld(
          canvas.current!,
          room,
          touch.current,
          setTarget,
          (progress) => {
            if (!cancelled) setGraphics(progress);
          },
          qualityRef.current,
        );
        worldRef.current = world;
        room.onMessage("profile", (value: PrivateProfile) => {
          if (!cancelled) setProfile(value);
        });
        room.onMessage("progressResult", (value: ProgressResult) => {
          if (cancelled) return;
          if (value.message !== "Профиль обновлён.") setProgressResult(value);
          const prior = pendingRef.current;
          if (
            value.requestId &&
            prior &&
            "requestId" in prior &&
            value.requestId === prior.requestId
          ) {
            savePending(null);
            pendingRef.current = null;
            setPending(null);
          }
        });
        sendProgress(room, { type: "refresh" });
        const refresh = window.setInterval(() => {
          if (room.connection.isOpen) sendProgress(room, { type: "refresh" });
        }, 5000);
        const previousCleanup = cleanup;
        cleanup = () => {
          clearInterval(refresh);
          previousCleanup?.();
        };
        setStatus("В сети");
        const syncState = (state: NetworkState) => {
          if (cancelled || !state?.players || !state?.equipment) return;
          setCount(state.players.size);
          setConnected(state.equipment.port3Connected);
          setRackServiced(state.equipment.rackServiced ?? false);
          const me = state.players.get(room.sessionId);
          if (me) {
            setStep(me.ticketStep);
            setRewards(me.rewards);
            setNickname(me.nickname);
          }
        };
        room.onStateChange(syncState);
        syncState(room.state);
        room.onMessage("actionResult", (result: ActionResult) => {
          if (cancelled) return;
          setMessage(result.message);
          setMessageOk(result.ok);
          if (result.ok && result.inspected) {
            setEconomy(false);
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
          setEconomy(false);
          setProfile(null);
          clearInterval(refresh);
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
    setEconomy(false);
    setPanel(false);
    touch.current.modal = false;
    canvas.current?.focus();
  };
  const act = (intent: ProgressIntent) => {
    if (!roomRef.current || pendingRef.current) return;
    const action = { ...intent, requestId: operationId() };
    savePending(action);
    pendingRef.current = action;
    setPending(action);
    sendProgress(roomRef.current, action);
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
        <div className="profile-summary" aria-label="Деньги и опыт">
          {profile ? (
            <>
              <b>{profile.credits} NET</b> · Ур. {profile.level}
              <small>
                {profile.xp} XP ·{" "}
                {profile.persistence === "temporary"
                  ? "Временные данные"
                  : "PostgreSQL"}
              </small>
            </>
          ) : (
            <small>Загрузка профиля…</small>
          )}
        </div>
        <button
          className="open-progress"
          onClick={() => {
            setEconomy(true);
            setPanel(false);
            touch.current.modal = true;
            if (document.pointerLockElement) document.exitPointerLock();
          }}
          disabled={status !== "В сети"}
        >
          Работа и снабжение
        </button>
        <button onClick={() => setAttempt((v) => v + 1)}>
          Переподключиться
        </button>
        <label className="quality-setting">
          Качество графики
          <select
            aria-label="Качество графики"
            value={quality}
            onChange={(event) => {
              const next = event.target.value as Quality;
              setQuality(next);
              worldRef.current?.setQuality(next);
            }}
          >
            <option value="low">Низкое</option>
            <option value="medium">Среднее</option>
            <option value="high">Высокое</option>
          </select>
        </label>
        <div
          className="asset-status"
          data-state={graphics.state}
          aria-live="polite"
        >
          {graphics.state === "loading"
            ? graphics.loaded === graphics.total
              ? "Подготовка освещения…"
              : `Загрузка моделей: ${graphics.loaded}/${graphics.total}`
            : graphics.state === "ready"
              ? "✓ Модели загружены"
              : `⚠ Резервная графика: ${graphics.failed.length} ошибок`}
          {graphics.state === "loading" && (
            <progress
              aria-label="Загрузка моделей"
              value={graphics.loaded}
              max={graphics.total}
            />
          )}
          {graphics.failed.length > 0 && (
            <details>
              <summary>Не загружено</summary>
              {graphics.failed.join(", ")}. Можно переподключиться для повтора.
            </details>
          )}
        </div>
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
      {target && !panel && !economy && (
        <div className="interaction-hint">[E] Осмотреть коммутатор</div>
      )}
      {!panel && !economy && (
        <MobileControls
          key={attempt}
          enabled={target}
          input={touch.current}
          interact={() => worldRef.current?.interact()}
        />
      )}
      {economy && (
        <ProgressPanel
          profile={profile}
          pending={pending}
          result={progressResult}
          act={act}
          retry={() => {
            if (roomRef.current && pendingRef.current)
              sendProgress(roomRef.current, pendingRef.current);
          }}
          close={closePanel}
          dialogRef={dialogRef}
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
            <section className="rack-maintenance">
              <h3>Охлаждение серверной стойки</h3>
              <p>{rackServiced ? "✓ Обслужено" : "Требуется очистка"}</p>
              <button
                onClick={() =>
                  roomRef.current &&
                  sendEquipment(roomRef.current, { type: "inspectRack" })
                }
              >
                Осмотреть охлаждение
              </button>
              <button
                onClick={() =>
                  roomRef.current &&
                  sendEquipment(roomRef.current, { type: "serviceRack" })
                }
              >
                Очистить охлаждение
              </button>
            </section>
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
      {!panel && !economy && message && (
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
