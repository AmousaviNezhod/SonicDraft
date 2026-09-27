import { SHARED_FIELDS, clone, isMeaningful } from './state.js';

export function getSharedFields() { return [...SHARED_FIELDS]; }

/**
 * Shared fields synchronize in one explicit transaction. The active (leaving)
 * workspace wins meaningful conflicts; an empty value never erases the other
 * workspace's meaningful value. Every synchronized value is cloned.
 */
function sharedVocalists(vocalists) {
  return (Array.isArray(vocalists) ? vocalists : []).slice(0, 2).map(voice => ({
    gender: voice?.gender || '', role: voice?.role || '', delivery: voice?.delivery || ''
  }));
}
function getSharedValue(modeState, field) {
  return field === 'vocalists' ? sharedVocalists(modeState.vocalists) : modeState[field];
}
function setSharedValue(modeState, mode, field, value) {
  if (field !== 'vocalists') {
    modeState[field] = clone(value);
    return;
  }
  const existing = Array.isArray(modeState.vocalists) ? modeState.vocalists : [];
  const incoming = Array.isArray(value) ? value.slice(0, 2) : [];
  const limit = mode === 'simple' ? 2 : 4;
  if (mode === 'simple') {
    modeState.vocalists = incoming.map((basicVoice, index) => ({
      ...(existing[index] || {}), ...clone(basicVoice), id: existing[index]?.id || `voice-${index + 1}`
    }));
    return;
  }
  // Advanced has room for four independent voices. Update shared basics only
  // where Simple has a corresponding vocalist, and retain every other Advanced
  // voice (including its detailed production/performance fields) untouched.
  modeState.vocalists = Array.from({ length: Math.min(limit, Math.max(existing.length, incoming.length)) }, (_, index) => {
    const prior = existing[index];
    if (index >= incoming.length) return prior ? clone(prior) : undefined;
    return { ...(prior || {}), ...clone(incoming[index]), id: prior?.id || `voice-${index + 1}` };
  }).filter(Boolean);
}
function writeShared(modeState, mode, values) {
  for (const field of SHARED_FIELDS) setSharedValue(modeState, mode, field, values[field]);
}

export function reconcileSharedState(appState, leavingMode, explicitlyEdited = new Set()) {
  const destinationMode = leavingMode === 'simple' ? 'advanced' : 'simple';
  const leaving = appState[leavingMode];
  const destination = appState[destinationMode];
  const resolved = {};
  for (const field of SHARED_FIELDS) {
    const outgoing = getSharedValue(leaving, field);
    const incoming = getSharedValue(destination, field);
    if (!isMeaningful(outgoing)) resolved[field] = clone(isMeaningful(incoming) ? incoming : outgoing);
    else if (!isMeaningful(incoming) || JSON.stringify(outgoing) === JSON.stringify(incoming)) resolved[field] = clone(outgoing);
    else if (explicitlyEdited.has(field)) resolved[field] = clone(outgoing);
    else resolved[field] = clone(outgoing); // Active workspace is deterministic conflict winner.
  }
  writeShared(appState.simple, 'simple', resolved);
  writeShared(appState.advanced, 'advanced', resolved);
  return clone(resolved);
}

export function syncSharedFields(appState, fromMode, toMode) {
  const values = Object.fromEntries(SHARED_FIELDS.map(field => [field, clone(getSharedValue(appState[fromMode], field))]));
  writeShared(appState[toMode], toMode, values);
}

// Idempotent and reference-safe. Never touches tempo, keys, instruments,
// arrangement, advanced vocal engineering, mix or production controls.
