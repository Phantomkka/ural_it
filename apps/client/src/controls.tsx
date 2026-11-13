import { useRef, type PointerEvent } from "react";
export interface TouchInput {
  x: number;
  y: number;
  lookX: number;
  lookY: number;
  modal: boolean;
}
export function MobileControls({
  input,
  interact,
}: {
  input: TouchInput;
  interact: () => void;
}) {
  const joystick = useRef<number | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
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
        onPointerUp={() => {
          look.current = null;
        }}
        onPointerCancel={() => {
          look.current = null;
        }}
      />
      <div
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
      <button className="touch-interact" onClick={interact}>
        Осмотреть
      </button>
    </div>
  );
}
