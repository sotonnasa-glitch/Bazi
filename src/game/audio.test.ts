import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWeatherAmbienceProfile } from './audio';

test('weather ambience scales wind and ocean wave intensity across clear, rain, and storm', () => {
  const clear = computeWeatherAmbienceProfile('clear', {
    nearShore: true,
    isPlaying: true,
    dangerLevel: 0,
  });
  const rain = computeWeatherAmbienceProfile('rain', {
    nearShore: true,
    isPlaying: true,
    dangerLevel: 0,
  });
  const storm = computeWeatherAmbienceProfile('storm', {
    nearShore: true,
    isPlaying: true,
    dangerLevel: 0,
  });
  const fog = computeWeatherAmbienceProfile('fog', {
    nearShore: true,
    isPlaying: true,
    dangerLevel: 0,
  });

  assert.ok(clear.windGain < rain.windGain && rain.windGain < storm.windGain);
  assert.ok(clear.windFilterHz < rain.windFilterHz && rain.windFilterHz < storm.windFilterHz);
  assert.ok(clear.surfGain < rain.surfGain && rain.surfGain < storm.surfGain);
  assert.ok(clear.surfCycleSpeed < rain.surfCycleSpeed && rain.surfCycleSpeed < storm.surfCycleSpeed);
  assert.ok(clear.surfFoamGain < rain.surfFoamGain && rain.surfFoamGain < storm.surfFoamGain);
  assert.ok(clear.rainGain < rain.rainGain && rain.rainGain < storm.rainGain);
  assert.ok(fog.surfGain < clear.surfGain);
  assert.ok(fog.windGain > clear.windGain && fog.windGain < rain.windGain);
});

test('weather ambience responds to shore proximity, tsunami surge, and lightning_storm events', () => {
  const inland = computeWeatherAmbienceProfile('clear', {
    nearShore: false,
    isPlaying: true,
  });
  const shore = computeWeatherAmbienceProfile('clear', {
    nearShore: true,
    isPlaying: true,
  });
  assert.ok(shore.surfGain > inland.surfGain * 1.8);

  const tsunami = computeWeatherAmbienceProfile('clear', {
    nearShore: true,
    isPlaying: true,
    activeEvent: 'tsunami',
  });
  assert.ok(tsunami.surfGain > shore.surfGain * 1.3);
  assert.ok(tsunami.surfFoamGain > shore.surfFoamGain * 1.4);

  const lightning = computeWeatherAmbienceProfile('clear', {
    nearShore: true,
    isPlaying: true,
    activeEvent: 'lightning_storm',
  });
  assert.equal(lightning.effectiveWeather, 'storm');
  assert.ok(lightning.windHowlGain > shore.windHowlGain);
});
