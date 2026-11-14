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
  type ComputerResult,
  type ProgressView,
} from "@netcity/shared";
import {
  connect,
  sendEquipment,
  sendProgress,
  sendComputer,
  leaveRoom,
  type NetworkState,
} from "./network";
import { MODEL_COUNT, type GraphicsProgress } from "./assets";
import { defaultQuality, type Quality } from "./quality";
import { createWorld, type WorldView } from "./world";
import { GameMenu, type Menu } from "./GameMenu";
import { Tutorial } from "./Tutorial";
import { isEditing, keyLabel, readSettings, saveSettings, type Settings } from "./settings";
import { playFeedback } from "./sound";
import { identityStatus } from "./identity";
import { MobileControls, type TouchInput } from "./controls";
import { ProgressPanel } from "./ProgressPanel";
import { pendingProgress, savePending, operationId } from "./pendingProgress";
import { VirtualComputer, type ComputerSnapshot } from "./VirtualComputer";
import { TicketJournal } from "./TicketJournal";
import { MissionHud } from "./MissionHud";
import {Tablet,type TabletApp} from "./Tablet";
import {CaseDesk} from "./CaseDesk";
import {DistrictMap} from "./DistrictMap";
import {CLIENT_CASE_TEMPLATE as CASE,clientCaseTarget,type CaseIntent} from "@netcity/shared";
import "./style.css";
function App() {
  const [tablet,setTablet]=useState(false),[tabletApp,setTabletApp]=useState<TabletApp>("calls");
  const tabletRef=useRef(false);
  const [caseMessage,setCaseMessage]=useState(""),[casePending,setCasePending]=useState(false);
  const casePendingRef=useRef(false);
  const pendingCaseId=useRef<string|null>(null);
  const retryCase=()=>{try{const raw=sessionStorage.getItem("netcity-pending-case");if(raw&&roomRef.current?.connection.isOpen)roomRef.current.send("case",JSON.parse(raw));}catch{setCaseMessage("Не удалось повторить операцию. Переподключитесь.");}};
  function openTablet(page:TabletApp="calls") {
    tabletRef.current=true;setTablet(true);setTabletApp(page);setEconomy(false);setPanel(false);setPcId(null);setMenu(page==="settings"?"settings":null);
    touch.current.modal=true;if(document.pointerLockElement)document.exitPointerLock();
  }
  function closeTablet() {
    tabletRef.current=false;setTablet(false);setEconomy(false);setPanel(false);setPcId(null);setMenu(null);touch.current.modal=false;canvas.current?.focus();
  }
  function caseAct(intent:CaseIntent) {
    if(!roomRef.current||casePendingRef.current)return;
    casePendingRef.current=true;setCasePending(true);setCaseMessage("");
    const action={...intent,requestId:operationId()};pendingCaseId.current=action.requestId;
    try{sessionStorage.setItem("netcity-pending-case",JSON.stringify(action));}catch{}
    try {roomRef.current.send("case",action);} catch {setCaseMessage("Связь потеряна. Переподключитесь и повторите ту же операцию.");}
  }

  const [identity,setIdentity]=useState<ReturnType<typeof identityStatus>>({mode:"memory",notice:"",conflict:false});
  const [settings, setSettings] = useState(readSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const changeSettings = (next: Settings) => { setSettings(next); saveSettings(next); };
  const [menu, setMenu] = useState<Menu | null>(null);
  const [tracked,setTracked]=useState("001");
  const [view, setView] = useState<WorldView>({x:0,z:-10,yaw:0,moved:false,looked:false,locked:false,fps:0,activeMeshes:0});
  const [tutorial, setTutorial] = useState(() => {try {return localStorage.getItem("netcity-tutorial-v2")!=="done";} catch {return true;}});
  const dismissTutorial = () => { setTutorial(false); try {localStorage.setItem("netcity-tutorial-v2","done");} catch { /* optional */ } };
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
  const [targetLabel, setTargetLabel] = useState("Осмотреть коммутатор");
  const [pcId, setPcId] = useState<string | null>(null);
  const [devices, setDevices] = useState<ComputerSnapshot[]>([]);
  const [jobs, setJobs] = useState(new Map<string, ProgressView>());
  const [pcResult, setPcResult] = useState<ComputerResult | null>(null);
  const [panel, setPanel] = useState(false);
  const [economy, setEconomy] = useState(false);
  const [profile, setProfile] = useState<PrivateProfile | null>(null);
  const latestProfile=useRef(profile);latestProfile.current=profile;
  useEffect(()=>{worldRef.current?.setClientCase(profile?.service?.cases.at(-1));},[profile]);
  useEffect(()=>{if(profile?.service?.cases.at(-1)?.stage!=="RINGING")return;const ring=()=>{if(!document.hidden)playFeedback(true,settingsRef.current.volume);};window.addEventListener("pointerdown",ring,{once:true});const t=setInterval(ring,7000);return()=>{clearInterval(t);window.removeEventListener("pointerdown",ring);};},[profile?.service?.cases.at(-1)?.id,profile?.service?.cases.at(-1)?.stage]);
  const previousProfile=useRef<PrivateProfile|null>(null);
  const [reward,setReward]=useState<{credits:number;xp:number}|null>(null);
  useEffect(()=> {
    const previous=previousProfile.current;
    previousProfile.current=profile;
    if(!profile) {setReward(null);return;}
    if(previous && profile.credits>previous.credits) setReward({credits:profile.credits-previous.credits,xp:profile.xp-previous.xp});
  },[profile]);
  useEffect(()=>{if(!reward)return; const timer=setTimeout(()=>setReward(null),7000);return()=>clearTimeout(timer);},[reward]);
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
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!tablet && !panel && !economy && !pcId && !menu) return;
    const dialog = dialogRef.current!;
    const buttons = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, [tabindex="0"]',
      ),
    );
    buttons[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if(event.defaultPrevented)return;
      if (event.code === "Escape") {
        event.preventDefault();
        setEconomy(false);
        setPcId(null);
        setPanel(false);
        setMenu(null);
        tabletRef.current=false;setTablet(false);
        touch.current.modal = false;
        canvas.current?.focus();
      }
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ),
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
  }, [panel, economy, pcId, menu, tablet]);
  const openMenu = (next: Menu) => {
    tabletRef.current=true;setTablet(true);setTabletApp(next==="map"?"map":"settings");
    touch.current.modal = true;
    setPanel(false); setEconomy(false); setPcId(null); setMenu(next);
    if (document.pointerLockElement) document.exitPointerLock();
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditing(event.target)) return;
      if (event.code === "Escape") {
        if (!touch.current.modal) {event.preventDefault(); openMenu("settings");}
        return;
      }
      if (touch.current.modal) return;
      const b=settingsRef.current.bindings;
      if (event.code===b.help || event.key==="?") {event.preventDefault(); openMenu("help");}
      if (event.code===b.map) {event.preventDefault(); openTablet("map");}
      if (event.code===b.inventory || event.code===b.journal) {
        event.preventDefault(); openTablet(event.code===b.inventory?"bag":"tickets");
        if(document.pointerLockElement) document.exitPointerLock();
      }
    };
    window.addEventListener("keydown",handler);
    const unlock=()=>{if(!touch.current.modal)openMenu("settings");};
    window.addEventListener("netcity-unlock",unlock);
    return ()=>{window.removeEventListener("keydown",handler);window.removeEventListener("netcity-unlock",unlock);};
  }, []);
  useEffect(()=>{
    const keyboard=(e:KeyboardEvent)=>{
      if(e.repeat||isEditing(e.target))return;
      const b=settingsRef.current.bindings;
      if(e.code===b.tablet && (!tabletRef.current || b.tablet!=="Tab")){e.preventDefault();e.stopPropagation();if(tabletRef.current)closeTablet();else openTablet();}
      if(e.code===b.drop && !touch.current.modal){const c=roomRef.current && latestProfile.current?.service?.cases.at(-1);if(c?.carrying){e.preventDefault();caseAct({action:"drop",caseId:c.id});}}
    };
    window.addEventListener("keydown",keyboard,true);return()=>window.removeEventListener("keydown",keyboard,true);
  },[]);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setStatus("Подключение…");tabletRef.current=false;setTablet(false);
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
    setPcId(null);
    setDevices([]);
    setJobs(new Map());
    setPcResult(null);
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
        casePendingRef.current=false;setCasePending(false);
        room.onMessage("interactionResult",(r:ProgressResult)=>{setMessage(r.message);setMessageOk(r.ok);});
        room.onMessage("caseResult",(result:ProgressResult)=>{
          if(pendingCaseId.current && result.requestId!==pendingCaseId.current){setCaseMessage(result.message);return;}
          pendingCaseId.current=null;casePendingRef.current=false;setCasePending(false);setCaseMessage(result.message);
          try{sessionStorage.removeItem("netcity-pending-case");}catch{}
        });
        try{const raw=sessionStorage.getItem("netcity-pending-case");if(raw){casePendingRef.current=true;setCasePending(true);const action=JSON.parse(raw);pendingCaseId.current=action.requestId;room.send("case",action);}}catch{}
        const identityInfo=identityStatus();setIdentity(identityInfo);
        if(identityInfo.notice) {
          savePending(null);pendingRef.current=null;setPending(null);
          setMessage(identityInfo.notice);setMessageOk(false);
        }
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
          (value, label) => {
            setTarget(value);
            setTargetLabel(label ?? "Осмотреть коммутатор");
          },
          (progress) => {
            if (!cancelled) setGraphics(progress);
          },
          qualityRef.current,
          () => settingsRef.current,
          setView,
          id=>{
            if(id==="case-hardware"){openTablet("tickets");return;}
            if(id==="case-dropped"){const c=latestProfile.current?.service?.cases.at(-1);if(c)caseAct({action:"take",caseId:c.id});return;}
            if(id==="client"){openTablet("tickets");return;}
            if(id==="supplier"){openTablet("bag");return;}
            tabletRef.current=true;setTablet(true);
            touch.current.modal=true;
            if(id==="supplier") {setEconomy(true);setMenu(null);} else setMenu("dispatcher");
            if(document.pointerLockElement) document.exitPointerLock();
          },
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
        let deviceVersion = "",
          jobVersion = "";
        const syncState = (state: NetworkState) => {
          if (cancelled || !state?.players || !state?.equipment) return;
          setCount(state.players.size);
          setConnected(state.equipment.port3Connected);
          setRackServiced(state.equipment.rackServiced ?? false);
          const version = Array.from(
            state.devices?.values() ?? [],
            (d) => `${d.id}:${d.revision}:${d.powered}`,
          ).join("|");
          if (version !== deviceVersion) {
            deviceVersion = version;
            setDevices(
              Array.from(state.devices?.values() ?? [], (d) => ({
                id: d.id,
                name: d.name,
                kind: d.kind,
                powered: d.powered,
                revision: d.revision,
                interfaces: new Map(
                  Array.from(d.interfaces.values(), (n) => [
                    n.id,
                    {
                      id: n.id,
                      ip: n.ip,
                      mask: n.mask,
                      gateway: n.gateway,
                      dns: n.dns,
                      connected: n.connected,
                    },
                  ]),
                ),
              })),
            );
          }
          const me = state.players.get(room.sessionId);
          if (me) {
            const nextJobs = Array.from(
              me.jobs?.entries() ?? [],
              ([id, p]) =>
                [
                  id,
                  {
                    stage: p.stage,
                    status: p.status,
                    verifiedRevision: p.verifiedRevision,
                  },
                ] as const,
            );
            const version = JSON.stringify(nextJobs);
            if (version !== jobVersion) {
              jobVersion = version;
              setJobs(new Map(nextJobs));
            }
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
          playFeedback(result.ok, settingsRef.current.volume);
          if (result.ok && result.inspected) {
            setPcId(null);
            setEconomy(false);
            touch.current.modal = true;
            setPanel(true);tabletRef.current=true;setTablet(true);
            if (document.pointerLockElement) document.exitPointerLock();
          }
        });
        room.onMessage("computerResult", (result: ComputerResult) => {
          if (cancelled) return;
          setPcResult(result);
          setMessage(result.message);
          setMessageOk(result.ok);
          if (result.ok && result.open && result.pcId) {
            setEconomy(false);
            setPcId(result.pcId);tabletRef.current=true;setTablet(true);
            setPanel(false);
            touch.current.modal = true;
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
          setPcId(null);
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
    tabletRef.current=false;setTablet(false);
    setEconomy(false);
    setPcId(null);
    setPanel(false);
    setMenu(null);
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
  const homeView=(<>
      {tutorial && status === "В сети" && <Tutorial
        journey={{moved:view.moved,looked:view.looked,inspected:step>=4}} completed={profile?.tutorialCompleted??false}
        settings={settings} dismiss={dismissTutorial}/>}
      <aside data-online={status === "В сети"}>
        <div className="connection">
          <i /> {status}
        </div>
        <span>
          {nickname || "Инженер"} · Игроков: {count}
        </span>
        <div className="home-profile-summary" aria-label="Деньги и опыт">
          {profile ? (
            <>
              <b>{profile.credits} NET</b> · Ур. {profile.level}
              <small>
                {profile.xp} XP ·{" "}
                {profile.persistence === "temporary"
                  ? "Временные данные"
                  : "Прогресс сохраняется"}
              </small>
            </>
          ) : (
            <small>Загрузка профиля…</small>
          )}
        </div>
        <small className="home-identity-status" data-mode={identity.mode}>{identity.conflict?"В этой вкладке другой профиль — сохранённый профиль не заменён.":identity.mode==="device"?"Профиль запомнен на этом устройстве":identity.mode==="tab"?"Ключ профиля доступен только в этой вкладке":"Ключ профиля хранится только до закрытия игры"}</small>
        <button
          className="open-progress"
          onClick={() => {
            setPcId(null);
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
        <button onClick={()=>openMenu("settings")}>Настройки</button>
        <button onClick={()=>openMenu("map")}>Карта</button>
        <button onClick={()=>openMenu("help")} aria-label="Помощь и управление">?</button>
        <details className="diagnostics"><summary>Графика и загрузка</summary>
        <p aria-label="Производительность">{Math.round(view.fps)} FPS · объектов в кадре: {view.activeMeshes}</p>
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
          className="home-asset-status"
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
        </details>
      </aside>
</>);
  const journalView=(<>
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
        </details>
        <small>Награды за заявку: {step === 6 ? 1 : 0}/1</small>
        {step === 6 && (
          <strong role="status">
            ✅ Заявка выполнена! Сеть восстановлена.
          </strong>
        )}
        <TicketJournal
          jobs={jobs}
          rewards={
            Number(step === 6) +
            Array.from(jobs.values()).filter((j) => j.status === "COMPLETED")
              .length
          }
          step={step}
        />
        <MissionHud tracked={tracked} track={setTracked} view={view} profile={profile} jobs={jobs} step={step}/>
      </section>
</>);
  return (
    <>
      <canvas tabIndex={0} ref={canvas} aria-label="Трёхмерная улица NETCITY" />

      {tablet && <Tablet wallet={profile?`${profile.credits} NET · Ур. ${profile.level} · ${profile.xp} XP · ${profile.persistence==="temporary"?"Временные данные":"Прогресс сохраняется"}`:"Загрузка профиля…"} page={tabletApp} change={openTablet} close={closeTablet} dialogRef={dialogRef} overlay={!!(menu||economy||pcId||panel)}>
        {(menu||economy||pcId||panel)?<>      {menu && <GameMenu menu={menu} settings={settings} change={changeSettings} quality={quality}
        setQuality={q=>{setQuality(q);worldRef.current?.setQuality(q);}} close={closePanel}
        repeat={()=>{setTutorial(true);openTablet("home");}} dialogRef={dialogRef} position={view}
        navigate={setMenu} track={setTracked} work={()=>{setMenu(null);setEconomy(true);touch.current.modal=true;}}/>}
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
          track={id=>{setTracked(id);closePanel();}}
        />
      )}
      {pcId && devices.find((d) => d.id === pcId) && (
        <VirtualComputer
          key={pcId}
          device={devices.find((d) => d.id === pcId)!}
          uplink={connected}
          progress={jobs.get(
            pcId === "pc01" ? "004" : pcId === "pc02" ? "002" : "003",
          )}
          result={pcResult}
          send={(action) =>
            roomRef.current && sendComputer(roomRef.current, action)
          }
          close={closePanel}
          dialogRef={dialogRef}
          paid={profile?.diagnostics?.includes(pcId === "pc01" ? "004" : pcId === "pc02" ? "002" : "003") ?? false}
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
                const online =
                  port === 3
                    ? connected
                    : port === 2
                      ? (devices
                          .find((d) => d.id === "pc02")
                          ?.interfaces.get("eth0")?.connected ?? false)
                      : true;
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
</>:tabletApp==="home"?homeView:tabletApp==="map"?<section><h2>GPS · {CASE.address}</h2><p>До цели {Math.ceil(Math.hypot(view.x-clientCaseTarget(profile?.service?.cases.at(-1),profile?.inventory??{}).x,view.z-clientCaseTarget(profile?.service?.cases.at(-1),profile?.inventory??{}).z))} м</p><DistrictMap x={view.x} z={view.z} destination={clientCaseTarget(profile?.service?.cases.at(-1),profile?.inventory??{})}/></section>:tabletApp==="tickets"?<><CaseDesk sessionId={roomRef.current?.sessionId} profile={profile} page={tabletApp} retry={retryCase} send={caseAct} pending={casePending} message={caseMessage} openLegacy={()=>setEconomy(true)}/><details><summary>Заявки NETCITY 2.0</summary>{journalView}</details></>:<CaseDesk sessionId={roomRef.current?.sessionId} profile={profile} page={tabletApp} retry={retryCase} send={caseAct} pending={casePending} message={caseMessage} openLegacy={()=>setEconomy(true)}/>}
      </Tablet>}
      <output className="asset-status" hidden data-state={graphics.state}>{graphics.state==="degraded"?"Резервная графика":""}</output>
      {!tablet && <div className="minimal-hud"><small className="connection-status">{nickname} · {status} · Игроков: {count}</small><button onClick={()=>openTablet("calls")} aria-label="Открыть планшет">{profile?.service?.cases.at(-1)?.stage==="RINGING"?"☎ Входящий звонок":"▣ Планшет"}</button></div>}
      <small hidden className="identity-status" data-mode={identity.mode}>{identity.conflict?"другой профиль":identity.mode==="tab"?"только в этой вкладке":""}</small>
      <header className="legacy-header">
        <button className="brand-link" aria-label="Главное меню" onClick={()=>openMenu("main")}><b>
          NETCITY <span>ONLINE</span>
        </b></button>
        <small>IT DISTRICT / ОФИС №001</small>
      </header>


      <div className="crosshair">+</div>
      {reward && <div className="reward-toast" role="status" aria-label="Получена награда"><b>Работа принята!</b><span>+{reward.credits} NET · +{reward.xp} XP</span><small>Баланс подтверждён сервером</small></div>}
      {target && !tablet && !panel && !economy && !pcId && !menu && (
        <div className="interaction-hint"><span>[{keyLabel(settings.bindings.interact)}] {targetLabel}</span><small>Дистанция действия: до 2,5 м</small></div>
      )}
      {!tablet && !panel && !economy && !pcId && !menu && (
        <MobileControls
          key={attempt}
          enabled={target}
          input={touch.current}
          interact={() => worldRef.current?.interact()}
        />
      )}
      {!view.locked && !matchMedia("(pointer: coarse)").matches && !tablet && !panel && !economy && !pcId && !menu && <div className="capture-hint">Нажмите на улицу для обзора мышью · Esc — меню</div>}
      {!tablet && !panel && !economy && !pcId && !menu && message && (
        <div
          className={`action-message notification ${messageOk ? "success" : "error"}`}
          role="status"
        >
          {message}
        </div>
      )}
      <footer className="legacy-footer">
        <small>
          {Object.values(settings.bindings).slice(0,4).map(keyLabel).join("/")} — движение · {keyLabel(settings.bindings.sprint)} — бег · {keyLabel(settings.bindings.interact)} — осмотр · Esc — меню
          <br />
          На смартфоне: джойстик слева, обзор свайпом справа.
        </small>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
