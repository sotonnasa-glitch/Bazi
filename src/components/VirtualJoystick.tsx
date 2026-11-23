import { useCallback, useRef, useState } from 'react';
import { CONFIG } from '../game/config';
import { computeVirtualJoystickVector } from '../game/world';

interface ActiveStickState {
  pointerId: number;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
}

interface VirtualJoystickProps {
  enabled: boolean;
  onChange: (dx: number, dy: number) => void;
}

export function VirtualJoystick({ enabled, onChange }: VirtualJoystickProps) {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const [stick, setStick] = useState<ActiveStickState | null>(null);
  const stickRef = useRef<ActiveStickState | null>(null);

  const maxRadius = CONFIG.JOYSTICK.MAX_RADIUS_PX;

  const updateStick = useCallback(
    (next: ActiveStickState | null, dx: number, dy: number) => {
      stickRef.current = next;
      setStick(next);
      onChange(dx, dy);
    },
    [onChange]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (stickRef.current !== null) return;
      const zone = zoneRef.current;
      if (!zone) return;

      const rect = zone.getBoundingClientRect();
      const pad = maxRadius + 12;
      const rawX = event.clientX - rect.left;
      const rawY = event.clientY - rect.top;
      const originX = Math.max(pad, Math.min(rect.width - pad, rawX));
      const originY = Math.max(pad, Math.min(rect.height - pad, rawY));

      try {
        zone.setPointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable in synthetic test environments
      }

      const vec = computeVirtualJoystickVector(originX, originY, rawX, rawY, maxRadius);
      updateStick(
        {
          pointerId: event.pointerId,
          originX,
          originY,
          knobX: vec.knobX,
          knobY: vec.knobY,
        },
        vec.dx,
        vec.dy
      );
    },
    [enabled, maxRadius, updateStick]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = stickRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const zone = zoneRef.current;
      if (!zone) return;

      const rect = zone.getBoundingClientRect();
      const rawX = event.clientX - rect.left;
      const rawY = event.clientY - rect.top;
      const vec = computeVirtualJoystickVector(
        current.originX,
        current.originY,
        rawX,
        rawY,
        maxRadius
      );

      updateStick(
        {
          pointerId: current.pointerId,
          originX: current.originX,
          originY: current.originY,
          knobX: vec.knobX,
          knobY: vec.knobY,
        },
        vec.dx,
        vec.dy
      );
    },
    [maxRadius, updateStick]
  );

  const handlePointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = stickRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const zone = zoneRef.current;
      if (zone) {
        try {
          if (zone.hasPointerCapture(event.pointerId)) {
            zone.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Safe cleanup
        }
      }
      updateStick(null, 0, 0);
    },
    [updateStick]
  );

  if (!enabled) return null;

  return (
    <div
      ref={zoneRef}
      data-testid="virtual-joystick-zone"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="absolute bottom-0 inset-x-0 h-1/2 z-10 touch-none select-none cursor-grab active:cursor-grabbing"
    >
      {stick ? (
        <div
          data-testid="virtual-joystick-active"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 bg-white/18 flex items-center justify-center"
          style={{
            left: `${stick.originX}px`,
            top: `${stick.originY}px`,
            width: `${maxRadius * 2}px`,
            height: `${maxRadius * 2}px`,
            boxShadow: '0 6px 18px rgba(10, 62, 102, 0.25)',
          }}
        >
          <div
            className="w-12 h-12 rounded-full bg-gradient-to-b from-white to-[#ffe8a3] border-2 border-white"
            style={{
              transform: `translate(${stick.knobX}px, ${stick.knobY}px)`,
              boxShadow: '0 4px 10px rgba(12, 66, 108, 0.35)',
            }}
          />
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-[108px] sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-85">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/75 bg-white/12 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-white/85 shadow-md" />
          </div>
          <span
            className="text-[11px] font-extrabold text-white whitespace-nowrap"
            style={{ textShadow: '0 2px 4px rgba(10, 58, 94, 0.65)' }}
          >
            لمس و کشیدن برای حرکت
          </span>
        </div>
      )}
    </div>
  );
}
