import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './config';
import {
  createSeededRandom,
  getDailyDateKey,
  getOrCreateNormalSeed,
  getSeedForMode,
  resetNormalSeed,
  safeStorageGet,
  safeStorageSet,
  toPersianDigits,
  type StorageLike,
} from './utils';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => {
      map.set(key, val);
    },
  };
}

test('CONFIG defines 3D camera, island, player, and weak-phone render caps', () => {
  assert.equal(CONFIG.CAMERA.FOV_DEG, 42);
  assert.ok(CONFIG.CAMERA.PITCH_DEG >= 40 && CONFIG.CAMERA.PITCH_DEG <= 60);
  assert.ok(CONFIG.RENDER.MAX_PIXEL_RATIO <= 1.5);
  assert.ok(CONFIG.PLAYER.MOVE_SPEED > 0);
  assert.ok(CONFIG.PLAYER.BACKPACK_CAPACITY > 0);
});

test('getDailyDateKey returns YYYY-MM-DD format', () => {
  const sampleDate = new Date(2026, 10, 5);
  assert.equal(getDailyDateKey(sampleDate), '2026-11-05');
});

test('createSeededRandom produces deterministic sequences for identical seeds', () => {
  const rngA = createSeededRandom('daily-2026-11-05');
  const rngB = createSeededRandom('daily-2026-11-05');
  const rngOther = createSeededRandom('daily-2026-11-06');

  const seqA = [rngA(), rngA(), rngA(), rngA()];
  const seqB = [rngB(), rngB(), rngB(), rngB()];
  const seqOther = [rngOther(), rngOther(), rngOther(), rngOther()];

  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqOther);
  for (const val of seqA) {
    assert.ok(val >= 0 && val < 1);
  }
});

test('getOrCreateNormalSeed persists seed until resetNormalSeed', () => {
  const storage = createMemoryStorage();
  const first = getOrCreateNormalSeed(storage);
  const second = getOrCreateNormalSeed(storage);
  assert.equal(first, second);

  const daily = getSeedForMode('daily', new Date(2026, 2, 21), storage);
  assert.equal(daily, 'daily-2026-03-21');

  const normalAgain = getSeedForMode('normal', new Date(2026, 2, 21), storage);
  assert.equal(normalAgain, first);

  const rerolled = resetNormalSeed(storage);
  assert.notEqual(rerolled, first);
  assert.equal(getOrCreateNormalSeed(storage), rerolled);
});

test('toPersianDigits converts ASCII digits to Persian numerals', () => {
  assert.equal(toPersianDigits('2026-11-22'), '۲۰۲۶-۱۱-۲۲');
  assert.equal(toPersianDigits(12), '۱۲');
});

test('safeStorageGet and safeStorageSet handle missing window gracefully', () => {
  assert.equal(safeStorageGet('missing_key', 42), 42);
  assert.equal(safeStorageSet('missing_key', { score: 10 }), false);
});
