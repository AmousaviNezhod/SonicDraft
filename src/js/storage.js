import { createDefaultState, migrateState } from './state.js';

export const STORAGE_KEY = 'sonicdraft:v1';
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateState(JSON.parse(raw)) : createDefaultState();
  } catch (error) {
    console.warn('SonicDraft could not restore saved preferences.', error);
    return createDefaultState();
  }
}
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: 1 }));
    return true;
  } catch (error) {
    console.warn('SonicDraft could not save preferences.', error);
    return false;
  }
}
