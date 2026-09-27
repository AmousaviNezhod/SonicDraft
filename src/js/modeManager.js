import { reconcileSharedState } from './syncManager.js';

/** A single explicit transaction for every workspace change. */
export function transitionMode(appState, nextMode, explicitlyEdited = new Set()) {
  if (!['simple', 'advanced'].includes(nextMode)) return false;
  if (nextMode === appState.activeMode) {
    appState.shared.onboarded = true;
    return false;
  }
  reconcileSharedState(appState, appState.activeMode, explicitlyEdited);
  appState.activeMode = nextMode;
  appState.shared.onboarded = true;
  return true;
}
