import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, migrateState } from './state.js';
import { reconcileSharedState } from './syncManager.js';
import { generateMasterPrompt } from './promptGenerator.js';
import { buildPerformanceBrief, buildReferenceBrief, createSectionRow } from './features.js';

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

test('features default to off and keep prompts byte-identical to the legacy shape', () => {
  const state = createDefaultState();
  assert.equal(state.simple.reference.enabled, false);
  assert.equal(state.simple.performance.enabled, false);
  assert.equal(state.advanced.reference.enabled, false);
  state.simple.genre = 'Indie Folk';
  const prompt = generateMasterPrompt('simple', state);
  assert.equal(prompt.includes('REFERENCE MUSIC ANALYSIS'), false);
  assert.equal(prompt.includes('PERFORMANCE DIRECTION'), false);
});

test('legacy persisted state without feature keys migrates without throwing', () => {
  const state = migrateState({ activeMode: 'simple', simple: { genre: 'Indie Folk' } });
  assert.equal(state.simple.reference.enabled, false);
  assert.deepEqual(state.simple.performance.sections, []);
});

test('enabled reference feature produces a structured analysis block', () => {
  const state = createDefaultState();
  state.simple.reference.enabled = true;
  state.simple.reference.sourceDescription = 'A 90s trip-hop track with dusty drums';
  state.simple.reference.actions = ['Copy Music Style', 'Adapt / Transform Style', 'Copy Lyrical Mood / Emotional Tone'];
  state.simple.reference.transformAmount = 60;
  const prompt = generateMasterPrompt('simple', state);
  assert.match(prompt, /REFERENCE MUSIC ANALYSIS \(reference-informed direction\):/);
  assert.match(prompt, /Reference track description: A 90s trip-hop track/);
  assert.match(prompt, /- Copy Music Style: recreate the overall musical style/);
  assert.match(prompt, /transformation level 60%/);
  assert.match(prompt, /- Copy Lyrical Mood \/ Emotional Tone: mirror the emotional tone/);
  assert.match(prompt, /exactly two separate Markdown code blocks/i);
});

test('transform-level wording scales with the slider amount', () => {
  const state = createDefaultState();
  state.advanced.reference.enabled = true;
  state.advanced.reference.actions = ['Adapt / Transform Style'];
  state.advanced.reference.transformAmount = 15;
  assert.match(generateMasterPrompt('advanced', state), /stay very close to the reference/);
  state.advanced.reference.transformAmount = 95;
  assert.match(generateMasterPrompt('advanced', state), /new song/);
});

test('advanced-only reference details appear in the prompt', () => {
  const state = createDefaultState();
  state.advanced.reference.enabled = true;
  state.advanced.reference.actions = ['Copy Music Style'];
  state.advanced.reference.detail.elementsToCopy = 'drum tone, reverb style';
  state.advanced.reference.detail.lyricalThemesToAvoid = 'party clichés';
  const prompt = generateMasterPrompt('advanced', state);
  assert.match(prompt, /- Elements to copy: drum tone, reverb style/);
  assert.match(prompt, /- Lyrical themes to avoid: party clichés/);
});

test('performance direction renders section rows in order and notes only in advanced', () => {
  const state = createDefaultState();
  state.advanced.performance.enabled = true;
  state.advanced.performance.sections = [
    createSectionRow('Verse 1', 'Emotional'),
    createSectionRow('Chorus', 'Powerful'),
    createSectionRow('Bridge', 'Soft / Intimate')
  ];
  state.advanced.performance.sections[2].note = 'whispered, half volume';
  const prompt = generateMasterPrompt('advanced', state);
  assert.match(prompt, /PERFORMANCE DIRECTION \(section-by-section\):/);
  assert.match(prompt, /- Verse 1 → Emotional/);
  assert.match(prompt, /- Chorus → Powerful/);
  assert.match(prompt, /- Bridge → Soft \/ Intimate \(whispered, half volume\)/);
  assert.match(prompt, /Follow these performance directions/);
});

test('custom section names flow into the performance block', () => {
  const state = createDefaultState();
  state.simple.performance.enabled = true;
  state.simple.performance.sections = [createSectionRow('Custom', 'Cinematic', 'Drop 2')];
  const prompt = generateMasterPrompt('simple', state);
  assert.match(prompt, /- Drop 2 → Cinematic/);
});

test('features without meaningful content contribute nothing even when enabled', () => {
  const state = createDefaultState();
  state.simple.reference.enabled = true;
  state.simple.performance.enabled = true;
  const prompt = generateMasterPrompt('simple', state);
  assert.equal(prompt.includes('REFERENCE MUSIC ANALYSIS'), false);
  assert.equal(prompt.includes('PERFORMANCE DIRECTION'), false);
});

test('feature state normalizes corrupted or adversarial input safely', () => {
  const state = migrateState({
    simple: { reference: { enabled: 'yes', actions: ['Bogus', 'Copy Music Style'], transformAmount: 4321, detail: null }, performance: { enabled: true, sections: [null, { type: 'Verse 2', direction: 'Cathartic' }, { type: 'Nope', direction: 'Nope' }] } }
  });
  assert.equal(state.simple.reference.enabled, false); // 'yes' is not boolean true
  assert.deepEqual(state.simple.reference.actions, ['Copy Music Style']);
  assert.equal(state.simple.reference.transformAmount, 100); // out-of-range input clamps into [0,100]
  assert.deepEqual(state.simple.reference.detail, { elementsToCopy: '', elementsToAvoid: '', lyricalThemesToKeep: '', lyricalThemesToAvoid: '' });
  assert.equal(state.simple.performance.enabled, true);
  assert.equal(state.simple.performance.sections.length, 3);
  assert.equal(state.simple.performance.sections[0].type, 'Verse 1'); // null row -> safe default
  assert.equal(state.simple.performance.sections[1].type, 'Verse 2');
  assert.equal(state.simple.performance.sections[1].direction, 'Cathartic');
  assert.equal(state.simple.performance.sections[2].type, 'Custom');
  assert.equal(state.simple.performance.sections[2].direction, 'Emotional');
});

test('feature state never syncs between Simple and Advanced workspaces', () => {
  const state = createDefaultState();
  state.simple.reference.enabled = true;
  state.simple.reference.actions = ['Copy Music Style'];
  state.simple.performance.enabled = true;
  state.simple.performance.sections = [createSectionRow('Chorus', 'Powerful')];
  reconcileSharedState(state, 'simple');
  assert.equal(state.advanced.reference.enabled, false);
  assert.equal(state.advanced.performance.enabled, false);
  assert.equal(state.simple.reference.enabled, true);
  assert.equal(state.simple.performance.enabled, true);
});

test('performance simple-mode cap trims to four sections on migration', () => {
  const state = migrateState({
    simple: { performance: { enabled: true, sections: ['Intro', 'Verse 1', 'Chorus', 'Bridge', 'Outro'].map(type => ({ type, direction: 'Powerful' })) } }
  });
  assert.equal(state.simple.performance.sections.length, 4);
});
