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
      const rawX = event.clientX - rect.left;
      const rawY = event.clientY - rect.top;
      const originX = rawX;
      const originY = rawY;
      event.stopPropagation();

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
      className="absolute bottom-3.5 right-3 w-[178px] h-[178px] sm:w-[196px] sm:h-[196px] rounded-full z-15 touch-none select-none cursor-grab active:cursor-grabbing flex items-center justify-center"
    >
      {stick ? (
        <div
          data-testid="virtual-joystick-active"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/85 bg-white/20 flex items-center justify-center"
          style={{
            left: `${stick.originX}px`,
            top: `${stick.originY}px`,
            width: `${maxRadius * 2}px`,
            height: `${maxRadius * 2}px`,
            boxShadow: '0 8px 22px rgba(10, 62, 102, 0.28)',
          }}
        >
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-white to-[#ffe8a3] border-2 border-white"
            style={{
              transform: `translate(${stick.knobX}px, ${stick.knobY}px)`,
              boxShadow: '0 6px 14px rgba(12, 66, 108, 0.38)',
            }}
          />
        </div>
      ) : (
        <div className="pointer-events-none flex flex-col items-center gap-1.5 opacity-90">
          <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full border-2 border-dashed border-white/85 bg-white/18 flex items-center justify-center shadow-lg">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/92 shadow-md border border-[#ffe8a3]" />
          </div>
          <span
            className="text-[11px] font-extrabold text-white whitespace-nowrap"
            style={{ textShadow: '0 2px 4px rgba(10, 58, 94, 0.78)' }}
          >
            حرکت (لمس و کشیدن)
          </span>
        </div>
      )}
    </div>
  );
}
