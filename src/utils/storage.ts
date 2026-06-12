import type { PersistedState, CameraState, Filters } from '@/types';

const STORAGE_KEY = 'warehouse_inspection_state';

const defaultFilters: Filters = {
  statusFilter: 'all',
  shelfFilter: 'all',
};

const defaultState: PersistedState = {
  filters: defaultFilters,
  confirmedConflicts: [],
  currentPlaybackIndex: -1,
  exportCount: 0,
  selectedSlotId: null,
};

export function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      filters: parsed.filters || defaultFilters,
      confirmedConflicts: parsed.confirmedConflicts || [],
      currentPlaybackIndex: parsed.currentPlaybackIndex ?? -1,
      exportCount: parsed.exportCount ?? 0,
      cameraState: parsed.cameraState,
      selectedSlotId: parsed.selectedSlotId ?? null,
    };
  } catch {
    return { ...defaultState };
  }
}

export function savePersistedState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function saveCameraState(cameraState: CameraState): void {
  const state = loadPersistedState();
  state.cameraState = cameraState;
  savePersistedState(state);
}

export function saveFilters(filters: Filters): void {
  const state = loadPersistedState();
  state.filters = filters;
  savePersistedState(state);
}

export function saveConfirmedConflicts(confirmedConflicts: string[]): void {
  const state = loadPersistedState();
  state.confirmedConflicts = confirmedConflicts;
  savePersistedState(state);
}

export function savePlaybackIndex(index: number): void {
  const state = loadPersistedState();
  state.currentPlaybackIndex = index;
  savePersistedState(state);
}

export function incrementExportCount(): number {
  const state = loadPersistedState();
  state.exportCount = (state.exportCount || 0) + 1;
  savePersistedState(state);
  return state.exportCount;
}

export function getExportCount(): number {
  const state = loadPersistedState();
  return state.exportCount || 0;
}

export function saveSelectedSlotId(slotId: string | null): void {
  const state = loadPersistedState();
  state.selectedSlotId = slotId;
  savePersistedState(state);
}

export function clearPersistedState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
