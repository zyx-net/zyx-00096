import { create } from 'zustand';
import type {
  WarehouseLayout,
  Conflict,
  Filters,
  CameraState,
  Toast,
  Pallet,
  InventoryRecord,
  ImportPreviewDraft,
  UndoSnapshot,
  ImportDiffSummary,
  ReviewSession,
  ReviewLogEntry,
  RestoreConflict,
  LogActionType,
} from '@/types';
import sampleData from '@/data/sampleWarehouse.json';
import { detectConflicts, validateLayout } from '@/utils/conflict';
import {
  loadPersistedState,
  saveFilters,
  saveConfirmedConflicts,
  savePlaybackIndex,
  saveSelectedSlotId,
  saveCameraState,
  incrementExportCount,
  savePreviewDraft,
  saveUndoSnapshot,
  saveCurrentBatchId,
  saveActiveSessionId,
  loadAllSessions,
  saveSession,
  deleteSession,
  getSession,
} from '@/utils/storage';

function generateBatchId(): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `b-${Date.now().toString(36)}-${rand}`;
}

function computeDiff(current: WarehouseLayout, next: WarehouseLayout): ImportDiffSummary {
  const curSlotSet = new Set(current.slots.map((s) => s.id));
  const nextSlotSet = new Set(next.slots.map((s) => s.id));
  const curPalletSet = new Set(current.pallets.map((p) => p.id));
  const nextPalletSet = new Set(next.pallets.map((p) => p.id));

  const addedSlotIds: string[] = [];
  const removedSlotIds: string[] = [];
  const overwrittenSlotIds: string[] = [];
  const addedPalletIds: string[] = [];
  const removedPalletIds: string[] = [];

  next.slots.forEach((s) => {
    if (curSlotSet.has(s.id)) overwrittenSlotIds.push(s.id);
    else addedSlotIds.push(s.id);
  });
  current.slots.forEach((s) => {
    if (!nextSlotSet.has(s.id)) removedSlotIds.push(s.id);
  });
  next.pallets.forEach((p) => {
    if (!curPalletSet.has(p.id)) addedPalletIds.push(p.id);
  });
  current.pallets.forEach((p) => {
    if (!nextPalletSet.has(p.id)) removedPalletIds.push(p.id);
  });

  return { addedSlotIds, removedSlotIds, overwrittenSlotIds, addedPalletIds, removedPalletIds };
}

export interface AppState {
  layout: WarehouseLayout;
  conflicts: Conflict[];
  filters: Filters;
  selectedSlotId: string | null;
  currentPlaybackIndex: number;
  isPlaybackPlaying: boolean;
  toasts: Toast[];
  cameraState?: CameraState;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  previewDraft: ImportPreviewDraft | null;
  undoSnapshot: UndoSnapshot | null;
  currentBatchId: string | null;
  activeSessionId: string | null;
  sessions: ReviewSession[];
  sessionDialogOpen: boolean;
  conflictRestoreDialog: {
    open: boolean;
    session: ReviewSession | null;
    conflicts: RestoreConflict | null;
  } | null;
  logPanelOpen: boolean;

  setLayout: (layout: WarehouseLayout) => void;
  prepareImportPreview: (file: File) => Promise<void>;
  cancelImportPreview: () => void;
  applyImportPreview: () => void;
  undoLastImport: () => void;
  importLayout: (file: File) => Promise<void>;
  loadSampleData: () => void;
  setFilters: (filters: Filters) => void;
  setSelectedSlotId: (id: string | null) => void;
  confirmConflict: (conflictId: string) => void;
  unconfirmConflict: (conflictId: string) => void;
  setPlaybackIndex: (index: number) => void;
  setPlaybackPlaying: (playing: boolean) => void;
  getCurrentPallets: () => Pallet[];
  getInventoryRecords: () => InventoryRecord[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setCameraState: (state: CameraState) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  getExportCount: () => number;
  incrementExport: () => number;
  createSession: (name: string) => void;
  updateActiveSession: () => void;
  renameSession: (sessionId: string, newName: string) => void;
  archiveSession: (sessionId: string) => void;
  unarchiveSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  restoreSession: (sessionId: string, mode: 'full' | 'view_only') => void;
  refreshSessions: () => void;
  setSessionDialogOpen: (open: boolean) => void;
  setConflictRestoreDialog: (value: AppState['conflictRestoreDialog']) => void;
  setLogPanelOpen: (open: boolean) => void;
  toggleLogPanel: () => void;
  getActiveSession: () => ReviewSession | undefined;
  getSessionUnconfirmedCount: (session: ReviewSession) => number;
  isSessionArchived: () => boolean;
  _restoreSessionInternal: (session: ReviewSession, mode: 'full' | 'view_only', conflicts: RestoreConflict) => void;
}

export const initialLayout = sampleData as unknown as WarehouseLayout;

function generateSessionId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `s-${Date.now().toString(36)}-${rand}`;
}

function generateLogId(): string {
  return `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLogEntry(sessionId: string, action: LogActionType, description: string, metadata?: Record<string, unknown>): ReviewLogEntry {
  return {
    id: generateLogId(),
    sessionId,
    action,
    description,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

function detectRestoreConflicts(session: ReviewSession, currentLayout: WarehouseLayout): RestoreConflict {
  const currentSlotSet = new Set(currentLayout.slots.map((s) => s.id));
  const currentPalletSet = new Set(currentLayout.pallets.map((p) => p.id));
  const sessionSlotSet = new Set(session.slotIds);
  const sessionPalletSet = new Set(session.palletIds);

  const missingSlotIds: string[] = [];
  const missingPalletIds: string[] = [];
  const extraSlotIds: string[] = [];
  const extraPalletIds: string[] = [];

  session.slotIds.forEach((id) => {
    if (!currentSlotSet.has(id)) missingSlotIds.push(id);
  });
  session.palletIds.forEach((id) => {
    if (!currentPalletSet.has(id)) missingPalletIds.push(id);
  });
  currentLayout.slots.forEach((s) => {
    if (!sessionSlotSet.has(s.id)) extraSlotIds.push(s.id);
  });
  currentLayout.pallets.forEach((p) => {
    if (!sessionPalletSet.has(p.id)) extraPalletIds.push(p.id);
  });

  return { missingSlotIds, missingPalletIds, extraSlotIds, extraPalletIds };
}

function hasRestoreConflicts(conflicts: RestoreConflict): boolean {
  return (
    conflicts.missingSlotIds.length > 0 ||
    conflicts.missingPalletIds.length > 0 ||
    conflicts.extraSlotIds.length > 0 ||
    conflicts.extraPalletIds.length > 0
  );
}

export const useStore = create<AppState>((set, get) => {
  const persisted = loadPersistedState();
  const initialConflicts = detectConflicts(initialLayout);
  const initialSessions = loadAllSessions();

  const conflictsWithPersistedConfirm = initialConflicts.map((c) => ({
    ...c,
    confirmed: persisted.confirmedConflicts.includes(c.id),
  }));

  function applyRestoreInternal(session: ReviewSession, mode: 'full' | 'view_only', conflicts: RestoreConflict): void {
    if (mode === 'full' && hasRestoreConflicts(conflicts)) {
      mode = 'view_only';
    }

    if (mode === 'full' && session.status === 'archived') {
      session.status = 'active';
      const unarchiveLog = createLogEntry(session.id, 'unarchive_session', `自动恢复会话时取消归档：${session.name}`);
      session.logs.push(unarchiveLog);
    }

    if (mode === 'view_only') {
      set({
        filters: session.filters,
        cameraState: session.cameraState,
        activeSessionId: session.id,
      });
      saveFilters(session.filters);
      if (session.cameraState) saveCameraState(session.cameraState);
    } else {
      const restoredConflicts = session.conflicts.map((c) => ({ ...c }));
      set({
        conflicts: restoredConflicts,
        filters: session.filters,
        selectedSlotId: session.selectedSlotId,
        currentPlaybackIndex: session.playbackIndex,
        cameraState: session.cameraState,
        activeSessionId: session.id,
      });
      const confirmedIds = session.confirmedConflictIds;
      saveConfirmedConflicts(confirmedIds);
      saveFilters(session.filters);
      saveSelectedSlotId(session.selectedSlotId);
      savePlaybackIndex(session.playbackIndex);
      if (session.cameraState) saveCameraState(session.cameraState);
    }

    saveActiveSessionId(session.id);
    session.lastOpenedAt = new Date().toISOString();
    const log = createLogEntry(session.id, 'restore_session', `页面加载时自动恢复会话：${session.name}`, {
      restoreMode: mode,
    });
    session.logs.push(log);
    saveSession(session);
  }

  let initialActiveSession: ReviewSession | null = null;
  if (persisted.activeSessionId && !persisted.currentBatchId && !persisted.previewDraft) {
    const session = initialSessions.find((s) => s.id === persisted.activeSessionId);
    if (session && session.status === 'active') {
      const restoreConflicts = detectRestoreConflicts(session, initialLayout);
      const mode = hasRestoreConflicts(restoreConflicts) ? 'view_only' : 'full';
      applyRestoreInternal(session, mode, restoreConflicts);
      initialActiveSession = session;
    }
  }

  return {
    layout: initialLayout,
    conflicts: initialActiveSession && !hasRestoreConflicts(detectRestoreConflicts(initialActiveSession, initialLayout))
      ? initialActiveSession.conflicts.map((c) => ({ ...c }))
      : conflictsWithPersistedConfirm,
    filters: initialActiveSession?.filters ?? persisted.filters,
    selectedSlotId: initialActiveSession && !hasRestoreConflicts(detectRestoreConflicts(initialActiveSession, initialLayout))
      ? initialActiveSession.selectedSlotId
      : persisted.selectedSlotId,
    currentPlaybackIndex: initialActiveSession && !hasRestoreConflicts(detectRestoreConflicts(initialActiveSession, initialLayout))
      ? initialActiveSession.playbackIndex
      : persisted.currentPlaybackIndex,
    isPlaybackPlaying: false,
    toasts: [],
    cameraState: initialActiveSession?.cameraState ?? persisted.cameraState,
    leftPanelOpen: true,
    rightPanelOpen: true,
    previewDraft: persisted.previewDraft ?? null,
    undoSnapshot: persisted.undoSnapshot ?? null,
    currentBatchId: persisted.currentBatchId ?? null,
    activeSessionId: persisted.activeSessionId ?? null,
    sessions: initialSessions,
    sessionDialogOpen: false,
    conflictRestoreDialog: null,
    logPanelOpen: false,

    setLayout: (layout) => {
      const newConflicts = detectConflicts(layout);
      set({ layout, conflicts: newConflicts });
    },

    prepareImportPreview: async (file) => {
      const batchId = generateBatchId();
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = validateLayout(data);

        if (!result.valid || !result.layout) {
          const emptyLayout: WarehouseLayout = {
            version: '0.0.0',
            name: '损坏布局',
            shelves: [],
            slots: [],
            pallets: [],
            inventoryRecords: [],
          };
          const draft: ImportPreviewDraft = {
            batchId,
            layout: emptyLayout,
            validationErrors: result.errors,
            isParseError: false,
            summary: {
              name: emptyLayout.name,
              shelfCount: 0,
              slotCount: 0,
              palletCount: 0,
              recordCount: 0,
              diff: { addedSlotIds: [], removedSlotIds: [], overwrittenSlotIds: [], addedPalletIds: [], removedPalletIds: [] },
              projectedConflicts: [],
            },
            createdAt: new Date().toISOString(),
          };
          set({ previewDraft: draft });
          savePreviewDraft(draft);
          get().addToast({ type: 'error', message: `布局校验失败，详见预览面板：${result.errors.slice(0, 2).join('；')}` });
          return;
        }

        const current = get().layout;
        const diff = computeDiff(current, result.layout);
        const projectedConflicts = detectConflicts(result.layout);

        const draft: ImportPreviewDraft = {
          batchId,
          layout: result.layout,
          validationErrors: [],
          isParseError: false,
          summary: {
            name: result.layout.name,
            shelfCount: result.layout.shelves.length,
            slotCount: result.layout.slots.length,
            palletCount: result.layout.pallets.length,
            recordCount: result.layout.inventoryRecords.length,
            diff,
            projectedConflicts,
          },
          createdAt: new Date().toISOString(),
        };
        set({ previewDraft: draft });
        savePreviewDraft(draft);
        get().addToast({ type: 'info', message: `已生成导入预览：${result.layout.name}` });
      } catch {
        const emptyLayout: WarehouseLayout = {
          version: '0.0.0',
          name: '解析失败',
          shelves: [],
          slots: [],
          pallets: [],
          inventoryRecords: [],
        };
        const draft: ImportPreviewDraft = {
          batchId,
          layout: emptyLayout,
          validationErrors: ['JSON 解析失败，请检查文件格式'],
          isParseError: true,
          summary: {
            name: emptyLayout.name,
            shelfCount: 0,
            slotCount: 0,
            palletCount: 0,
            recordCount: 0,
            diff: { addedSlotIds: [], removedSlotIds: [], overwrittenSlotIds: [], addedPalletIds: [], removedPalletIds: [] },
            projectedConflicts: [],
          },
          createdAt: new Date().toISOString(),
        };
        set({ previewDraft: draft });
        savePreviewDraft(draft);
        get().addToast({ type: 'error', message: '布局解析失败，详见预览面板' });
      }
    },

    cancelImportPreview: () => {
      set({ previewDraft: null });
      savePreviewDraft(null);
      get().addToast({ type: 'info', message: '已取消导入预览' });
    },

    applyImportPreview: () => {
      const draft = get().previewDraft;
      if (!draft) return;

      if (draft.validationErrors.length > 0) {
        get().addToast({
          type: 'error',
          message: `存在${draft.validationErrors.length}项校验错误，无法应用。请先修复数据或取消预览`,
        });
        return;
      }

      const state = get();
      const snapshot: UndoSnapshot = {
        batchId: draft.batchId,
        importedLayoutName: draft.summary.name,
        layout: state.layout,
        conflicts: state.conflicts,
        confirmedConflicts: state.conflicts.filter((c) => c.confirmed).map((c) => c.id),
        cameraState: state.cameraState,
        filters: state.filters,
        playbackIndex: state.currentPlaybackIndex,
        selectedSlotId: state.selectedSlotId,
        createdAt: new Date().toISOString(),
      };

      const newConflicts = draft.summary.projectedConflicts.map((c) => ({
        ...c,
        confirmed: false,
      }));
      const newFilters: Filters = { statusFilter: 'all', shelfFilter: 'all' };

      set({
        layout: draft.layout,
        conflicts: newConflicts,
        previewDraft: null,
        undoSnapshot: snapshot,
        currentBatchId: draft.batchId,
        filters: newFilters,
        selectedSlotId: null,
        currentPlaybackIndex: -1,
      });

      savePreviewDraft(null);
      saveUndoSnapshot(snapshot);
      saveCurrentBatchId(draft.batchId);
      saveFilters(newFilters);
      saveConfirmedConflicts([]);
      savePlaybackIndex(-1);
      saveSelectedSlotId(null);
      set({ activeSessionId: null });
      saveActiveSessionId(null);

      const activeSession = get().getActiveSession();
      if (activeSession) {
        const log = createLogEntry(activeSession.id, 'apply_import', `应用导入布局：${draft.summary.name}`, {
          batchId: draft.batchId,
          layoutName: draft.summary.name,
        });
        activeSession.logs.push(log);
        activeSession.lastOpenedAt = new Date().toISOString();
        saveSession(activeSession);
      }

      get().addToast({ type: 'success', message: `布局已应用：${draft.summary.name}` });
    },

    undoLastImport: () => {
      const snap = get().undoSnapshot;
      if (!snap) return;

      set({
        layout: snap.layout,
        conflicts: snap.conflicts,
        cameraState: snap.cameraState,
        filters: snap.filters,
        currentPlaybackIndex: snap.playbackIndex,
        selectedSlotId: snap.selectedSlotId,
        undoSnapshot: null,
        currentBatchId: null,
        activeSessionId: null,
      });

      saveUndoSnapshot(null);
      saveCurrentBatchId(null);
      saveFilters(snap.filters);
      saveConfirmedConflicts(snap.confirmedConflicts);
      savePlaybackIndex(snap.playbackIndex);
      saveSelectedSlotId(snap.selectedSlotId);
      saveActiveSessionId(null);
      if (snap.cameraState) saveCameraState(snap.cameraState);

      const activeSession = get().getActiveSession();
      if (activeSession) {
        const log = createLogEntry(activeSession.id, 'undo_import', `撤销导入，恢复至：${snap.importedLayoutName}`, {
          batchId: snap.batchId,
          layoutName: snap.importedLayoutName,
        });
        activeSession.logs.push(log);
        activeSession.lastOpenedAt = new Date().toISOString();
        saveSession(activeSession);
      }

      get().addToast({ type: 'success', message: `已撤销导入，恢复至导入前状态` });
    },

    importLayout: async (file) => {
      await get().prepareImportPreview(file);
    },

    loadSampleData: () => {
      const layout = sampleData as unknown as WarehouseLayout;
      const newConflicts = detectConflicts(layout);
      set({
        layout,
        conflicts: newConflicts,
        selectedSlotId: null,
        undoSnapshot: null,
        currentBatchId: null,
        previewDraft: null,
      });
      saveConfirmedConflicts([]);
      savePlaybackIndex(-1);
      saveSelectedSlotId(null);
      saveUndoSnapshot(null);
      saveCurrentBatchId(null);
      savePreviewDraft(null);
      get().addToast({
        type: 'success',
        message: '已载入样例仓库数据',
      });
    },

    setFilters: (filters) => {
      set({ filters });
      saveFilters(filters);
      get().updateActiveSession();
    },

    setSelectedSlotId: (id) => {
      set({ selectedSlotId: id });
      saveSelectedSlotId(id);
      get().updateActiveSession();
    },

    confirmConflict: (conflictId) => {
      if (get().isSessionArchived()) {
        get().addToast({ type: 'warning', message: '会话已归档，无法确认异常' });
        return;
      }
      const conflict = get().conflicts.find((c) => c.id === conflictId);
      set((state) => {
        const newConflicts = state.conflicts.map((c) =>
          c.id === conflictId
            ? { ...c, confirmed: true, confirmedAt: new Date().toISOString(), confirmedBy: '管理员' }
            : c
        );
        const confirmedIds = newConflicts.filter((c) => c.confirmed).map((c) => c.id);
        saveConfirmedConflicts(confirmedIds);
        return { conflicts: newConflicts };
      });
      const activeSession = get().getActiveSession();
      if (activeSession && conflict) {
        const log = createLogEntry(activeSession.id, 'confirm_conflict', `确认异常：${conflict.description}`, {
          conflictId,
          conflictType: conflict.type,
        });
        activeSession.logs.push(log);
        saveSession(activeSession);
        get().updateActiveSession();
      }
      get().addToast({
        type: 'success',
        message: '冲突已确认',
      });
    },

    unconfirmConflict: (conflictId) => {
      if (get().isSessionArchived()) {
        get().addToast({ type: 'warning', message: '会话已归档，无法撤销确认' });
        return;
      }
      const conflict = get().conflicts.find((c) => c.id === conflictId);
      set((state) => {
        const newConflicts = state.conflicts.map((c) =>
          c.id === conflictId ? { ...c, confirmed: false, confirmedAt: undefined, confirmedBy: undefined } : c
        );
        const confirmedIds = newConflicts.filter((c) => c.confirmed).map((c) => c.id);
        saveConfirmedConflicts(confirmedIds);
        return { conflicts: newConflicts };
      });
      const activeSession = get().getActiveSession();
      if (activeSession && conflict) {
        const log = createLogEntry(activeSession.id, 'unconfirm_conflict', `撤销确认：${conflict.description}`, {
          conflictId,
          conflictType: conflict.type,
        });
        activeSession.logs.push(log);
        saveSession(activeSession);
        get().updateActiveSession();
      }
      get().addToast({
        type: 'info',
        message: '已撤销确认',
      });
    },

    setPlaybackIndex: (index) => {
      set({ currentPlaybackIndex: index });
      savePlaybackIndex(index);
      get().updateActiveSession();
    },

    setPlaybackPlaying: (playing) => {
      set({ isPlaybackPlaying: playing });
    },

    getCurrentPallets: () => {
      const { layout, currentPlaybackIndex } = get();
      if (currentPlaybackIndex < 0 || currentPlaybackIndex >= layout.inventoryRecords.length) {
        return layout.pallets;
      }
      return layout.inventoryRecords[currentPlaybackIndex].pallets;
    },

    getInventoryRecords: () => {
      return get().layout.inventoryRecords;
    },

    addToast: (toast) => {
      const id = Math.random().toString(36).substring(2, 9);
      set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
      setTimeout(() => {
        get().removeToast(id);
      }, 4000);
    },

    removeToast: (id) => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    },

    setCameraState: (state) => {
      set({ cameraState: state });
      saveCameraState(state);
      get().updateActiveSession();
    },

    toggleLeftPanel: () => {
      set((state) => ({ leftPanelOpen: !state.leftPanelOpen }));
    },

    toggleRightPanel: () => {
      set((state) => ({ rightPanelOpen: !state.rightPanelOpen }));
    },

    getExportCount: () => {
      const persisted = loadPersistedState();
      return persisted.exportCount || 0;
    },

    incrementExport: () => {
      const activeSession = get().getActiveSession();
      const count = incrementExportCount();
      if (activeSession) {
        const log = createLogEntry(activeSession.id, 'export_csv', '导出CSV文件', { exportCount: count });
        activeSession.logs.push(log);
        activeSession.lastOpenedAt = new Date().toISOString();
        saveSession(activeSession);
        get().refreshSessions();
      }
      return count;
    },

    createSession: (name) => {
      const state = get();
      const sessionId = generateSessionId();
      const now = new Date().toISOString();
      const confirmedIds = state.conflicts.filter((c) => c.confirmed).map((c) => c.id);

      const session: ReviewSession = {
        id: sessionId,
        name,
        status: 'active',
        createdAt: now,
        lastOpenedAt: now,
        layoutName: state.layout.name,
        conflicts: state.conflicts.map((c) => ({ ...c })),
        confirmedConflictIds: confirmedIds,
        filters: { ...state.filters },
        selectedSlotId: state.selectedSlotId,
        cameraState: state.cameraState,
        playbackIndex: state.currentPlaybackIndex,
        slotIds: state.layout.slots.map((s) => s.id),
        palletIds: state.layout.pallets.map((p) => p.id),
        logs: [],
      };

      const log = createLogEntry(sessionId, 'create_session', `创建复核会话：${name}`);
      session.logs.push(log);

      saveSession(session);
      set({ activeSessionId: sessionId, sessions: [...state.sessions, session] });
      saveActiveSessionId(sessionId);

      state.addToast({ type: 'success', message: `会话已创建：${name}` });
    },

    updateActiveSession: () => {
      const state = get();
      const session = state.getActiveSession();
      if (!session || session.status === 'archived') return;

      const confirmedIds = state.conflicts.filter((c) => c.confirmed).map((c) => c.id);

      session.conflicts = state.conflicts.map((c) => ({ ...c }));
      session.confirmedConflictIds = confirmedIds;
      session.filters = { ...state.filters };
      session.selectedSlotId = state.selectedSlotId;
      session.cameraState = state.cameraState;
      session.playbackIndex = state.currentPlaybackIndex;
      session.slotIds = state.layout.slots.map((s) => s.id);
      session.palletIds = state.layout.pallets.map((p) => p.id);
      session.lastOpenedAt = new Date().toISOString();

      saveSession(session);
      state.refreshSessions();
    },

    renameSession: (sessionId, newName) => {
      const state = get();
      const session = getSession(sessionId);
      if (!session) return;

      const oldName = session.name;
      session.name = newName;
      session.lastOpenedAt = new Date().toISOString();

      const log = createLogEntry(sessionId, 'rename_session', `重命名：${oldName} → ${newName}`, {
        oldName,
        newName,
      });
      session.logs.push(log);

      saveSession(session);
      state.refreshSessions();

      state.addToast({ type: 'success', message: `会话已重命名` });
    },

    archiveSession: (sessionId) => {
      const state = get();
      const session = getSession(sessionId);
      if (!session) return;

      session.status = 'archived';
      session.lastOpenedAt = new Date().toISOString();

      const log = createLogEntry(sessionId, 'archive_session', `归档会话：${session.name}`);
      session.logs.push(log);

      saveSession(session);
      state.refreshSessions();

      state.addToast({ type: 'success', message: `会话已归档：${session.name}` });
    },

    unarchiveSession: (sessionId) => {
      const state = get();
      const session = getSession(sessionId);
      if (!session) return;

      session.status = 'active';
      session.lastOpenedAt = new Date().toISOString();

      const log = createLogEntry(sessionId, 'unarchive_session', `取消归档：${session.name}`);
      session.logs.push(log);

      saveSession(session);
      state.refreshSessions();

      state.addToast({ type: 'success', message: `会话已恢复为活动状态` });
    },

    deleteSession: (sessionId) => {
      const state = get();
      const session = getSession(sessionId);
      deleteSession(sessionId);

      if (state.activeSessionId === sessionId) {
        set({ activeSessionId: null });
        saveActiveSessionId(null);
      }

      state.refreshSessions();
      state.addToast({ type: 'info', message: `会话已删除：${session?.name ?? sessionId}` });
    },

    restoreSession: (sessionId, mode) => {
      const state = get();
      const session = getSession(sessionId);
      if (!session) return;

      const conflicts = detectRestoreConflicts(session, state.layout);

      if (mode === 'full' && hasRestoreConflicts(conflicts)) {
        set({
          conflictRestoreDialog: {
            open: true,
            session,
            conflicts,
          },
        });
        return;
      }

      state._restoreSessionInternal(session, mode, conflicts);
    },

    _restoreSessionInternal: (session, mode, conflicts) => {
      const state = get();
      const hadConflicts = mode === 'full' && hasRestoreConflicts(conflicts);

      if (hadConflicts) {
        state.addToast({
          type: 'warning',
          message: '布局不匹配，仅恢复视角和筛选条件',
        });
      }

      applyRestoreInternal(session, mode, conflicts);
      state.refreshSessions();

      if (!hadConflicts) {
        state.addToast({ type: 'success', message: `已恢复会话：${session.name}` });
      }
    },

    refreshSessions: () => {
      set({ sessions: loadAllSessions() });
    },

    setSessionDialogOpen: (open) => {
      set({ sessionDialogOpen: open });
    },

    setConflictRestoreDialog: (value) => {
      set({ conflictRestoreDialog: value });
    },

    setLogPanelOpen: (open) => {
      set({ logPanelOpen: open });
    },

    toggleLogPanel: () => {
      set((state) => ({ logPanelOpen: !state.logPanelOpen }));
    },

    getActiveSession: () => {
      const state = get();
      if (!state.activeSessionId) return undefined;
      return getSession(state.activeSessionId);
    },

    getSessionUnconfirmedCount: (session) => {
      return session.conflicts.length - session.confirmedConflictIds.length;
    },

    isSessionArchived: () => {
      const session = get().getActiveSession();
      return session?.status === 'archived';
    },
  };
});
