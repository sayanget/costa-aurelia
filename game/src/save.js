// A save is a small JSON blob in localStorage: money, wanted history is never saved (a fresh load
// always starts clean), which missions are done, and what has been unlocked. Reading it never throws:
// a corrupt or missing save just means there is no Continue.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      completedMissions: state.completedMissions,
      unlockedVehicle: state.unlockedVehicle,
      unlockedWeapon: state.unlockedWeapon,
      unlockedDistrict: state.unlockedDistrict,
      px: state.px, pz: state.pz,
      savedAt: state.savedAt ?? 0,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
