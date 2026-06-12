import type { PersistedState, CameraState, Filters, ImportPreviewDraft, UndoSnapshot, ReviewSession } from '@/types';

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
      previewDraft: parsed.previewDraft ?? null,
      undoSnapshot: parsed.undoSnapshot ?? null,
      currentBatchId: parsed.currentBatchId ?? null,
      activeSessionId: parsed.activeSessionId ?? null,
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

export function savePreviewDraft(draft: ImportPreviewDraft | null): void {
  const state = loadPersistedState();
  state.previewDraft = draft;
  savePersistedState(state);
}

export function saveUndoSnapshot(snapshot: UndoSnapshot | null): void {
  const state = loadPersistedState();
  state.undoSnapshot = snapshot;
  savePersistedState(state);
}

export function saveCurrentBatchId(batchId: string | null): void {
  const state = loadPersistedState();
  state.currentBatchId = batchId;
  savePersistedState(state);
}

export function saveActiveSessionId(sessionId: string | null): void {
  const state = loadPersistedState();
  state.activeSessionId = sessionId;
  savePersistedState(state);
}

const SESSIONS_KEY = 'warehouse_inspection_sessions';

export function loadAllSessions(): ReviewSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReviewSession[];
  } catch {
    return [];
  }
}

export function saveAllSessions(sessions: ReviewSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

export function saveSession(session: ReviewSession): void {
  const sessions = loadAllSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }
  saveAllSessions(sessions);
}

export function deleteSession(sessionId: string): void {
  const sessions = loadAllSessions().filter((s) => s.id !== sessionId);
  saveAllSessions(sessions);
}

export function getSession(sessionId: string): ReviewSession | undefined {
  return loadAllSessions().find((s) => s.id === sessionId);
}

export function clearAllSessions(): void {
  localStorage.removeItem(SESSIONS_KEY);
}
