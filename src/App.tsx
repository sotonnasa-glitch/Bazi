import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VirtualJoystick } from './components/VirtualJoystick';
import { CONFIG, type AppScreenState, type BiomeId, type GameMode } from './game/config';
import {
  createThreeIslandGame,
  type ActiveRunInfo,
  type HudSnapshot,
  type ThreeIslandController,
} from './game/threeScene';
import { formatDailyLabel, toPersianDigits } from './game/utils';

const BIOME_LABELS: Record<BiomeId, string> = {
  center: 'ساحل مرکزی',
  ruins: 'خرابه‌های باستانی',
  volcano: 'دهانه آتشفشان',
  mushroom: 'جنگل قارچ‌ها',
  shipwreck: 'خلیج کشتی‌شکسته',
  bridge: 'روی پل ساحلی',
};

const INITIAL_HUD: HudSnapshot = {
  coins: 0,
  wood: 0,
  stone: 0,
  berries: 0,
  energy: CONFIG.PLAYER.MAX_ENERGY,
  maxEnergy: CONFIG.PLAYER.MAX_ENERGY,
  backpackUsed: 0,
  backpackCapacity: CONFIG.PLAYER.BACKPACK_CAPACITY,
  biome: 'center',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ThreeIslandController | null>(null);

  const [screen, setScreen] = useState<AppScreenState>('loading');
  const [activeRun, setActiveRun] = useState<ActiveRunInfo | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  const dailyLabel = useMemo(() => formatDailyLabel(), []);

  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';

    const controller = createThreeIslandGame(
      container,
      {
        onScreenChange: (nextScreen, runInfo) => {
          setScreen(nextScreen);
          if (runInfo) {
            setActiveRun(runInfo);
          } else if (nextScreen === 'title') {
            setActiveRun(null);
          }
        },
        onHudUpdate: (snapshot) => {
          setHud(snapshot);
        },
      },
      'normal',
      autostart
    );

    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const handleStartMode = useCallback((mode: GameMode, forceNewIsland = false) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    controllerRef.current?.startRun(mode, forceNewIsland);
  }, []);

  const handleReturnToMenu = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    controllerRef.current?.returnToMenu();
  }, []);

  const handleJoystickChange = useCallback((dx: number, dy: number) => {
    controllerRef.current?.setJoystickInput(dx, dy);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen === 'title' && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        handleStartMode('normal', false);
      } else if (screen === 'playing' && event.key === 'Escape') {
        event.preventDefault();
        handleReturnToMenu();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, handleStartMode, handleReturnToMenu]);

  const energyRatio = Math.max(0, Math.min(1, hud.energy / Math.max(1, hud.maxEnergy)));

  return (
    <main className="game-stage-shell" dir="rtl" lang="fa">
      <div className="game-viewport-frame" data-testid="game-viewport">
        {/* Three.js 3D Island Viewport */}
        <div
          ref={mountRef}
          className="three-mount absolute inset-0 w-full h-full"
          data-testid="three-canvas-container"
        />

        {/* Lower-Half Virtual Joystick Overlay */}
        <VirtualJoystick enabled={screen === 'playing'} onChange={handleJoystickChange} />

        {/* Title Screen Overlay (Compact so bright 3D island shines behind) */}
        {screen === 'title' && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-5 pt-7 pb-5">
            <div className="flex flex-col items-center text-center">
              <h1
                className="text-4xl font-extrabold text-white leading-tight tracking-tight"
                style={{
                  textShadow: '0 4px 0 #1875ad, 0 10px 20px rgba(12, 66, 108, 0.42)',
                }}
              >
                {CONFIG.GAME_TITLE}
              </h1>
              <p
                className="mt-1.5 text-xs font-extrabold text-[#114f78]"
                style={{ textShadow: '0 1px 0 rgba(255, 255, 255, 0.7)' }}
              >
                جزیره سه‌بعدی بقا · حرکت با جویستیک لمسی
              </p>
            </div>

            <div className="pointer-events-auto self-center w-full max-w-[280px] flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => handleStartMode('normal', false)}
                className="wood-btn-primary w-full min-h-[54px] px-5 py-3 rounded-2xl text-white font-extrabold text-lg transition-all cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{ textShadow: '0 2px 0 rgba(153, 62, 6, 0.7)' }}
              >
                <PlayArrowIcon className="w-6 h-6 shrink-0" />
                <span>شروع بازی</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStartMode('daily', false)}
                  className="wood-btn flex-1 min-h-[44px] px-3 py-2 rounded-xl text-[#fff8eb] font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ textShadow: '0 1px 0 rgba(94, 41, 10, 0.7)' }}
                >
                  <SunMiniIcon className="w-4 h-4 shrink-0 text-[#ffe066]" />
                  <span>چالش روز ({dailyLabel})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartMode('normal', true)}
                  className="wood-btn min-h-[44px] px-3 py-2 rounded-xl text-[#fff8eb] font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  style={{ textShadow: '0 1px 0 rgba(94, 41, 10, 0.7)' }}
                  title="ساخت جزیره تصادفی جدید"
                >
                  <RefreshMiniIcon className="w-4 h-4 shrink-0 text-[#ffe066]" />
                  <span>جزیره جدید</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 1 RTL HTML HUD Overlay over Canvas */}
        {screen === 'playing' && activeRun && (
          <div className="pointer-events-none absolute inset-0 z-20">
            {/* Top-Right: Coins & Resources */}
            <div
              className="absolute top-3 right-3 flex flex-col items-start gap-1.5"
              data-testid="hud-top-right"
            >
              <div className="flex items-center gap-1.5 flex-wrap max-w-[198px] sm:max-w-none">
                <HudCounterPill
                  label="سکه"
                  value={hud.coins}
                  icon={<CoinSvg />}
                  accentClass="text-[#a15c07]"
                />
                <HudCounterPill label="چوب" value={hud.wood} icon={<WoodSvg />} />
                <HudCounterPill label="سنگ" value={hud.stone} icon={<StoneSvg />} />
                <HudCounterPill label="توت" value={hud.berries} icon={<BerrySvg />} />
              </div>
            </div>

            {/* Top-Left: Energy Bar + Compact Menu Button */}
            <div
              className="absolute top-3 left-3 flex flex-col items-end gap-2"
              data-testid="hud-top-left"
            >
              <div className="hud-card rounded-2xl px-2.5 py-1.5 flex items-center gap-2 min-w-[138px]">
                <EnergyBoltSvg />
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-[#5a3b14]">
                    <span>انرژی</span>
                    <span className="tabular-nums">{toPersianDigits(hud.energy)}٪</span>
                  </div>
                  <div className="w-24 h-2.5 rounded-full wood-well p-0.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-[#74e344] to-[#ffd233] transition-transform duration-200 origin-right"
                      style={{ transform: `scaleX(${Math.max(0.04, energyRatio)})` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div
                  className="hud-card rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-[#4b3010]"
                  data-testid="hud-biome"
                >
                  <CompassMiniSvg />
                  <span>{BIOME_LABELS[hud.biome]}</span>
                </div>

                <button
                  type="button"
                  onClick={handleReturnToMenu}
                  className="pointer-events-auto wood-btn px-3 py-1.5 rounded-xl text-[#fff8eb] text-[11px] font-extrabold cursor-pointer flex items-center gap-1"
                  style={{ textShadow: '0 1px 0 rgba(94, 41, 10, 0.7)' }}
                >
                  <HomeMiniSvg />
                  <span>منو</span>
                </button>
              </div>
            </div>

            {/* Bottom-Left: Backpack Capacity */}
            <div className="absolute bottom-4 left-3" data-testid="hud-bottom-left">
              <div className="hud-card rounded-2xl px-3 py-2 flex items-center gap-2">
                <BackpackSvg />
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] font-bold text-[#755326]">کوله</span>
                  <span
                    dir="ltr"
                    className="text-xs font-extrabold text-[#3d2508] tabular-nums"
                  >
                    {toPersianDigits(hud.backpackUsed)} / {toPersianDigits(hud.backpackCapacity)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function HudCounterPill({
  label,
  value,
  icon,
  accentClass = 'text-[#3d2508]',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentClass?: string;
}) {
  return (
    <div
      className="hud-card rounded-xl px-2 py-1 flex items-center gap-1.5"
      aria-label={`${label}: ${toPersianDigits(value)}`}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>
      <span className={`text-xs font-extrabold tabular-nums ${accentClass}`}>
        {toPersianDigits(value)}
      </span>
    </div>
  );
}

function CoinSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#ffb822" />
      <circle cx="12" cy="12" r="6.8" fill="#ffd95a" />
      <rect x="10.8" y="8" width="2.4" height="8" rx="1.2" fill="#d97f0a" />
    </svg>
  );
}

function WoodSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" aria-hidden="true">
      <rect x="3.5" y="7.5" width="17" height="9" rx="4.5" fill="#c77a3b" />
      <ellipse cx="17" cy="12" rx="2.6" ry="3.8" fill="#f7cb82" />
      <rect x="6" y="9.2" width="7" height="2" rx="1" fill="#e69e5c" />
    </svg>
  );
}

function StoneSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" aria-hidden="true">
      <path d="M4.5 16 C3.5 11, 7 6, 12 5 C17 5, 20.5 10, 19.5 16 C17 19, 7 19, 4.5 16 Z" fill="#89a0b5" />
      <ellipse cx="10" cy="9.5" rx="3.4" ry="2" fill="#d2e2f2" />
    </svg>
  );
}

function BerrySvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" aria-hidden="true">
      <path d="M12 4 Q15 3 16 6 Q13 7 12 4 Z" fill="#5fd145" />
      <circle cx="9.2" cy="13.8" r="4.5" fill="#ff3b54" />
      <circle cx="14.8" cy="13.8" r="4.5" fill="#e02b43" />
      <circle cx="8.2" cy="12" r="1.2" fill="#ffd6dc" />
    </svg>
  );
}

function EnergyBoltSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#ffe156" />
      <path d="M13 5L7.5 13H12L11 19L16.5 11H12L13 5Z" fill="#f07810" />
    </svg>
  );
}

function BackpackSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
      <path d="M9 6 C9 4, 15 4, 15 6" stroke="#8f4f1d" strokeWidth="2.2" fill="none" />
      <rect x="5.5" y="6.5" width="13" height="13.5" rx="4" fill="#c77a3b" />
      <rect x="7.5" y="12.5" width="9" height="5.5" rx="2" fill="#e39d5b" />
      <rect x="10.5" y="10.5" width="3" height="2.2" rx="0.8" fill="#ffd447" />
    </svg>
  );
}

function PlayArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.22)" />
      <path d="M10 8.5L16.5 12L10 15.5V8.5Z" fill="#ffffff" />
    </svg>
  );
}

function SunMiniIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <path
        d="M12 3V5M12 19V21M3 12H5M19 12H21"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshMiniIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M19 12A7 7 0 1 1 16.9 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17 3.5V7.5H13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeMiniSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M4.5 11.5L12 5L19.5 11.5V19H4.5V11.5Z" fill="currentColor" />
    </svg>
  );
}

function CompassMiniSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#d99a3a" />
      <circle cx="12" cy="12" r="7" fill="#fff6e0" />
      <path d="M14.8 9.2L13 13.4L9.2 14.8L11 10.6L14.8 9.2Z" fill="#d94426" />
    </svg>
  );
}
