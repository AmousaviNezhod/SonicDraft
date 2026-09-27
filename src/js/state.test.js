import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, migrateState } from './state.js';
import { reconcileSharedState } from './syncManager.js';
import { generateMasterPrompt } from './promptGenerator.js';

test('Simple fields initialize Advanced without shared references', () => {
  const state = createDefaultState();
  state.simple.genre = 'Indie Folk';
  state.simple.vocalists = [{ id: 'voice-1', gender: 'Female', role: 'Lead', delivery: 'Warm' }];
  reconcileSharedState(state, 'simple');
  assert.equal(state.advanced.genre, 'Indie Folk');
  assert.notEqual(state.simple.vocalists, state.advanced.vocalists);
  assert.notEqual(state.simple.vocalists[0], state.advanced.vocalists[0]);
  assert.equal(state.advanced.vocalists[0].delivery, 'Warm');
});

test('mode switches preserve Advanced-only controls and remain idempotent', () => {
  const state = createDefaultState();
  state.simple.genre = 'Indie Folk';
  reconcileSharedState(state, 'simple');
  state.advanced.genre = 'Dark Pop';
  state.advanced.bpm = 108;
  state.advanced.key = 'D Minor';
  state.advanced.mix.stereoWidth = 'Wide';
  reconcileSharedState(state, 'advanced');
  const snapshot = structuredClone(state);
  reconcileSharedState(state, 'advanced');
  assert.deepEqual(state, snapshot);
  assert.equal(state.simple.genre, 'Dark Pop');
  assert.equal(state.advanced.bpm, 108);
  assert.equal(state.advanced.key, 'D Minor');
  assert.equal(state.advanced.mix.stereoWidth, 'Wide');
  assert.equal('bpm' in state.simple, false);
});

test('Advanced-only vocalists survive a Simple shared-voice reconciliation', () => {
  const state = createDefaultState();
  state.advanced.vocalists = [
    { id: 'one', gender: 'Male', role: 'Lead', delivery: 'Warm', texture: 'Raw' },
    { id: 'two', gender: 'Female', role: 'Harmony', delivery: 'Airy' },
    { id: 'three', gender: 'Female', role: 'Backing', texture: 'Smoky' }
  ];
  state.simple.vocalists = [{ id: 'simple', gender: 'Female', role: 'Lead', delivery: 'Soft' }];
  reconcileSharedState(state, 'simple');
  assert.equal(state.advanced.vocalists.length, 3);
  assert.equal(state.advanced.vocalists[0].gender, 'Female');
  assert.equal(state.advanced.vocalists[0].texture, 'Raw');
  assert.equal(state.advanced.vocalists[2].id, 'three');
});

test('Simple prompt excludes technical Advanced-only specifications', () => {
  const state = createDefaultState();
  state.simple.genre = 'Indie Folk';
  state.advanced.bpm = 108;
  state.advanced.key = 'D Minor';
  const prompt = generateMasterPrompt('simple', state);
  assert.match(prompt, /Genre: Indie Folk/);
  assert.doesNotMatch(prompt, /108 BPM|D Minor|Time signature:/);
  assert.match(prompt, /exactly two separate Markdown code blocks/i);
});

test('Advanced prompt preserves explicit numeric and musical constraints', () => {
  const state = createDefaultState();
  state.advanced.bpm = 108;
  state.advanced.key = 'D Minor';
  state.advanced.timeSignature = '4/4';
  const prompt = generateMasterPrompt('advanced', state);
  assert.match(prompt, /Tempo: 108 BPM/);
  assert.match(prompt, /Key: D Minor/);
  assert.match(prompt, /Time signature: 4\/4/);
  assert.match(prompt, /all structural section tags must be written in English/i);
});

test('an empty source preserves destination shared choices but never copies mode-only controls', () => {
  const state = createDefaultState();
  state.simple.genre = '';
  state.advanced.genre = 'Dark Pop';
  state.advanced.bpm = 111;
  reconcileSharedState(state, 'simple');
  assert.equal(state.simple.genre, 'Dark Pop');
  assert.equal(state.advanced.bpm, 111);
  assert.equal('bpm' in state.simple, false);
});

test('corrupted persisted state safely migrates to usable defaults', () => {
  const state = migrateState({ activeMode: 'advanced', simple: { moods: 'broken' }, advanced: { mix: null, instruments: [null, 'Piano'] }, shared: { uiLanguage: 'xx' } });
  assert.equal(state.activeMode, 'advanced');
  assert.deepEqual(state.simple.moods, []);
  assert.equal(state.advanced.instruments[0].name, 'Piano');
  assert.equal(state.shared.uiLanguage, 'en');
  assert.equal(state.shared.onboarded, true);
});
