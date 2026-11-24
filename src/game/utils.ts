import { CONFIG, type GameMode } from './config';

export function getDailyDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: string | number): () => number {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function safeStorageGet<T>(key: string, fallback: T, storage?: StorageLike): T {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!target) {
      return fallback;
    }
    const raw = target.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeStorageSet(key: string, value: unknown, storage?: StorageLike): boolean {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!target) {
      return false;
    }
    target.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemove(key: string, storage?: StorageLike): boolean {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!target) {
      return false;
    }
    if (typeof target.removeItem === 'function') {
      target.removeItem(key);
    } else {
      target.setItem(key, 'null');
    }
    return true;
  } catch {
    return false;
  }
}

let sessionNormalSeedFallback: string | null = null;

export function generateFreshNormalSeed(): string {
  const randomSuffix = Math.floor(Math.random() * 1_000_000_000).toString(36);
  return `island-${Date.now().toString(36)}-${randomSuffix}`;
}

export function getOrCreateNormalSeed(storage?: StorageLike): string {
  const saved = safeStorageGet<string | null>(
    CONFIG.STORAGE_KEYS.CURRENT_ISLAND_SEED,
    null,
    storage
  );
  if (typeof saved === 'string' && saved.length > 0) {
    sessionNormalSeedFallback = saved;
    return saved;
  }
  if (!storage && sessionNormalSeedFallback) {
    return sessionNormalSeedFallback;
  }
  const fresh = generateFreshNormalSeed();
  if (!storage) {
    sessionNormalSeedFallback = fresh;
  }
  safeStorageSet(CONFIG.STORAGE_KEYS.CURRENT_ISLAND_SEED, fresh, storage);
  return fresh;
}

export function resetNormalSeed(storage?: StorageLike): string {
  const fresh = generateFreshNormalSeed();
  if (!storage) {
    sessionNormalSeedFallback = fresh;
  }
  safeStorageSet(CONFIG.STORAGE_KEYS.CURRENT_ISLAND_SEED, fresh, storage);
  return fresh;
}

export function getSeedForMode(mode: GameMode, date: Date = new Date(), storage?: StorageLike): string {
  if (mode === 'daily') {
    return `daily-${getDailyDateKey(date)}`;
  }
  return getOrCreateNormalSeed(storage);
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function formatDailyLabel(date: Date = new Date()): string {
  return toPersianDigits(getDailyDateKey(date).replace(/-/g, '/'));
}
