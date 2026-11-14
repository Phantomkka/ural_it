import { useEffect, useRef, type PointerEvent } from "react";
export interface TouchInput {
  x: number;
  y: number;
  lookX: number;
  lookY: number;
  modal: boolean;
  sprint?: boolean;
}
export function MobileControls({
  input,
  interact,
  enabled,
}: {
  input: TouchInput;
  interact: () => void;
  enabled: boolean;
}) {
  const joystick = useRef<number | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const joystickElement = useRef<HTMLDivElement>(null);
  const endLook = (e: PointerEvent<HTMLDivElement>) => {
    if (look.current?.id === e.pointerId) look.current = null;
  };
  useEffect(() => {
    const reset = () => {
      joystick.current = null;
      look.current = null;
      input.x = 0;
      input.y = 0;
      input.lookX = 0;
      input.lookY = 0;
      input.sprint = false;
      joystickElement.current?.style.setProperty("--stick-x", "0px");
      joystickElement.current?.style.setProperty("--stick-y", "0px");
    };
    const visibility = () => {
      if (document.hidden) reset();
    };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibility);
      reset();
    };
  }, [input]);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (joystick.current !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 45,
      y = (rect.top + rect.height / 2 - e.clientY) / 45;
    const length = Math.max(1, Math.hypot(x, y));
    input.x = x / length;
    input.y = y / length;
    e.currentTarget.style.setProperty("--stick-x", `${input.x * 35}px`);
    e.currentTarget.style.setProperty("--stick-y", `${-input.y * 35}px`);
  };
  const stop = (e: PointerEvent<HTMLDivElement>) => {
    if (joystick.current === e.pointerId) {
      joystick.current = null;
      input.x = 0;
      input.y = 0;
      e.currentTarget.style.setProperty("--stick-x", "0px");
      e.currentTarget.style.setProperty("--stick-y", "0px");
    }
  };
  return (
    <div className="mobile-controls">
      <div
        aria-label="Обзор свайпом"
        className="look-zone"
        onPointerDown={(e) => {
          if (look.current) return;
          look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const old = look.current;
          if (old?.id !== e.pointerId) return;
          input.lookX += e.clientX - old.x;
          input.lookY += e.clientY - old.y;
          look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerUp={endLook}
        onPointerCancel={endLook}
        onLostPointerCapture={endLook}
      />
      <div
        ref={joystickElement}
        aria-label="Джойстик движения"
        className="joystick"
        onPointerDown={(e) => {
          if (joystick.current !== null) return;
          joystick.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      >
        <div />
      </div>
      <button className="touch-interact" disabled={!enabled} onClick={interact}>
        Осмотреть
      </button>
      <button className="touch-sprint" aria-pressed={input.sprint === true}
        onPointerDown={e=>{ e.currentTarget.setPointerCapture(e.pointerId); input.sprint=true; }}
        onPointerUp={()=>{input.sprint=false;}} onPointerCancel={()=>{input.sprint=false;}}
        onLostPointerCapture={()=>{input.sprint=false;}}>Бег</button>
    </div>
  );
}
