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
  ReviewSnapshotSelection,
  ReviewState,
  InspectionState,
  InspectionTaskPackage,
  InspectionImportPreview,
  InspectionUndoSnapshot,
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
  saveReviewSelection,
  saveReviewSelectedSlotIds,
  saveReviewLastImportedPackageId,
  saveReviewDiff,
  saveInspectionSelectedSlotIds,
  saveInspectionDraft,
  saveInspectionLastPublished,
  saveInspectionLastImportedPackageId,
  loadInspectionState,
} from '@/utils/storage';
import {
  computeReviewDiff,
  createReviewPackage,
  exportReviewToJSON,
  exportReviewToCSV,
  prepareReviewImportPreview,
  isDuplicateLogEntry,
  downloadJSON,
  downloadCSV,
} from '@/utils/review';
import {
  createInspectionPackage,
  updateInspectionPackage,
  publishInspectionPackage,
  exportInspectionToJSON,
  prepareInspectionImportPreview,
  isDuplicateInspectionLogEntry,
  filterSlots,
} from '@/utils/inspection';

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
  reviewState: ReviewState;
  inspectionState: InspectionState;

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

  setReviewEnabled: (enabled: boolean) => void;
  setReviewSnapshotSelection: (selection: ReviewSnapshotSelection | null) => void;
  computeReviewDiff: () => void;
  clearReviewDiff: () => void;
  toggleReviewSlotSelection: (slotId: string) => void;
  clearReviewSlotSelection: () => void;
  exportReviewJSON: (name?: string, description?: string) => void;
  exportReviewCSV: (name?: string) => void;
  prepareReviewImport: (file: File) => Promise<void>;
  cancelReviewImport: () => void;
  applyReviewImport: () => void;
  undoReviewImport: () => void;
  refreshReviewFromStorage: () => void;

  setInspectionEnabled: (enabled: boolean) => void;
  toggleInspectionSlotSelection: (slotId: string) => void;
  clearInspectionSlotSelection: () => void;
  selectAllFilteredSlotsForInspection: () => void;
  createInspectionDraft: (name?: string, description?: string) => void;
  updateInspectionDraft: () => void;
  clearInspectionDraft: () => void;
  publishInspection: () => void;
  undoPublishInspection: () => void;
  exportInspectionJSON: () => void;
  prepareInspectionImport: (file: File) => Promise<void>;
  cancelInspectionImport: () => void;
  applyInspectionImport: (mode: 'overwrite' | 'view_only') => void;
  refreshInspectionFromStorage: () => void;
  getFilteredSlotsForInspection: () => string[];
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
  const initialInspectionState = loadInspectionState();

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
  let initialRestoreMode: 'full' | 'view_only' | null = null;
  if (persisted.activeSessionId) {
    const session = initialSessions.find((s) => s.id === persisted.activeSessionId);
    if (session && session.status === 'active') {
      const restoreConflicts = detectRestoreConflicts(session, initialLayout);
      const hasImportState = !!persisted.currentBatchId || !!persisted.previewDraft;
      const mode: 'full' | 'view_only' =
        !hasImportState && !hasRestoreConflicts(restoreConflicts) ? 'full' : 'view_only';
      applyRestoreInternal(session, mode, restoreConflicts);
      initialActiveSession = session;
      initialRestoreMode = mode;
    }
  }

  const canFullRestore = initialActiveSession && initialRestoreMode === 'full';

  return {
    layout: initialLayout,
    conflicts: canFullRestore
      ? initialActiveSession!.conflicts.map((c) => ({ ...c }))
      : initialActiveSession
        ? initialConflicts
        : conflictsWithPersistedConfirm,
    filters: initialActiveSession?.filters ?? persisted.filters,
    selectedSlotId: canFullRestore ? initialActiveSession!.selectedSlotId : persisted.selectedSlotId,
    currentPlaybackIndex: canFullRestore ? initialActiveSession!.playbackIndex : persisted.currentPlaybackIndex,
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
    reviewState: {
      enabled: false,
      selection: persisted.reviewState?.selection ?? null,
      diff: persisted.reviewState?.diff ?? null,
      selectedSlotIds: persisted.reviewState?.selectedSlotIds ?? [],
      importPreview: null,
      undoSnapshot: null,
      lastImportedPackageId: persisted.reviewState?.lastImportedPackageId ?? null,
    },
    inspectionState: {
      enabled: false,
      selectedSlotIds: initialInspectionState.selectedSlotIds,
      draft: initialInspectionState.draft,
      lastPublished: initialInspectionState.lastPublished,
      importPreview: null,
      undoSnapshot: null,
      lastImportedPackageId: initialInspectionState.lastImportedPackageId,
    },

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

      set({ activeSessionId: null });
      saveActiveSessionId(null);

      get().addToast({ type: 'success', message: `布局已应用：${draft.summary.name}` });
    },

    undoLastImport: () => {
      const snap = get().undoSnapshot;
      if (!snap) return;

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

    setReviewEnabled: (enabled) => {
      set((state) => ({
        reviewState: { ...state.reviewState, enabled },
      }));
      if (!enabled) {
        get().clearReviewDiff();
      }
    },

    setReviewSnapshotSelection: (selection) => {
      set((state) => ({
        reviewState: { ...state.reviewState, selection, diff: null },
      }));
      saveReviewSelection(selection);
      saveReviewDiff(null);
    },

    computeReviewDiff: () => {
      const state = get();
      if (!state.reviewState.selection) {
        state.addToast({ type: 'warning', message: '请先选择两个盘点快照' });
        return;
      }

      const diff = computeReviewDiff(state.layout, state.reviewState.selection, state.conflicts);
      set((state) => ({
        reviewState: { ...state.reviewState, diff },
      }));
      saveReviewDiff(diff);

      const activeSession = get().getActiveSession();
      if (activeSession) {
        const metadata = {
          snapshotA: diff.selection.snapshotAIndex,
          snapshotB: diff.selection.snapshotBIndex,
          slotChanges: diff.summary.slotChanges,
          palletChanges: diff.summary.palletChanges,
        };
        if (!isDuplicateLogEntry(activeSession.logs, 'create_review', metadata)) {
          const log = createLogEntry(
            activeSession.id,
            'create_review',
            `生成复盘对比：快照${diff.selection.snapshotAIndex + 1} vs 快照${diff.selection.snapshotBIndex + 1}`,
            metadata
          );
          activeSession.logs.push(log);
          saveSession(activeSession);
          get().refreshSessions();
        }
      }

      state.addToast({ type: 'success', message: '复盘对比已生成' });
    },

    clearReviewDiff: () => {
      set((state) => ({
        reviewState: { ...state.reviewState, diff: null, selectedSlotIds: [] },
      }));
      saveReviewSelectedSlotIds([]);
      saveReviewDiff(null);
    },

    toggleReviewSlotSelection: (slotId) => {
      set((state) => {
        const selected = new Set(state.reviewState.selectedSlotIds);
        if (selected.has(slotId)) {
          selected.delete(slotId);
        } else {
          selected.add(slotId);
        }
        const selectedSlotIds = Array.from(selected);
        saveReviewSelectedSlotIds(selectedSlotIds);
        return {
          reviewState: { ...state.reviewState, selectedSlotIds },
        };
      });
    },

    clearReviewSlotSelection: () => {
      set((state) => ({
        reviewState: { ...state.reviewState, selectedSlotIds: [] },
      }));
      saveReviewSelectedSlotIds([]);
    },

    exportReviewJSON: (name, description) => {
      const state = get();
      if (!state.reviewState.diff || !state.reviewState.selection) {
        state.addToast({ type: 'warning', message: '请先生成复盘对比' });
        return;
      }

      const pkg = createReviewPackage(
        state.layout,
        state.reviewState.selection,
        state.reviewState.diff,
        state.reviewState.selectedSlotIds,
        name,
        description
      );
      const json = exportReviewToJSON(pkg);
      const safeName = pkg.name.replace(/[\\/:*?"<>|]/g, '_');
      downloadJSON(`复盘包_${safeName}.json`, json);
      incrementExportCount();

      const activeSession = get().getActiveSession();
      if (activeSession) {
        const metadata = {
          packageId: pkg.id,
          packageName: pkg.name,
          snapshotSelection: pkg.snapshotSelection,
        };
        if (!isDuplicateLogEntry(activeSession.logs, 'export_review_json', metadata)) {
          const log = createLogEntry(
            activeSession.id,
            'export_review_json',
            `导出复盘包JSON：${pkg.name}`,
            metadata
          );
          activeSession.logs.push(log);
          activeSession.lastOpenedAt = new Date().toISOString();
          saveSession(activeSession);
          get().refreshSessions();
        }
      }

      state.addToast({ type: 'success', message: '复盘包已导出' });
    },

    exportReviewCSV: (name) => {
      const state = get();
      if (!state.reviewState.diff || !state.reviewState.selection) {
        state.addToast({ type: 'warning', message: '请先生成复盘对比' });
        return;
      }

      const pkg = createReviewPackage(
        state.layout,
        state.reviewState.selection,
        state.reviewState.diff,
        state.reviewState.selectedSlotIds,
        name
      );
      const csvs = exportReviewToCSV(pkg);
      const safeName = pkg.name.replace(/[\\/:*?"<>|]/g, '_');
      downloadCSV(`复盘_${safeName}_摘要.csv`, csvs.summaryCSV);
      downloadCSV(`复盘_${safeName}_货位变化.csv`, csvs.slotsCSV);
      downloadCSV(`复盘_${safeName}_托盘变化.csv`, csvs.palletsCSV);
      downloadCSV(`复盘_${safeName}_确认记录.csv`, csvs.confirmationsCSV);
      incrementExportCount();

      const activeSession = get().getActiveSession();
      if (activeSession) {
        const metadata = { packageId: pkg.id, packageName: pkg.name };
        if (!isDuplicateLogEntry(activeSession.logs, 'export_review_csv', metadata)) {
          const log = createLogEntry(
            activeSession.id,
            'export_review_csv',
            `导出复盘包CSV：${pkg.name}`,
            metadata
          );
          activeSession.logs.push(log);
          activeSession.lastOpenedAt = new Date().toISOString();
          saveSession(activeSession);
          get().refreshSessions();
        }
      }

      state.addToast({ type: 'success', message: '复盘CSV已导出' });
    },

    prepareReviewImport: async (file) => {
      const state = get();
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const preview = prepareReviewImportPreview(data, state.layout);

        set((state) => ({
          reviewState: { ...state.reviewState, importPreview: preview },
        }));

        if (!preview.valid) {
          state.addToast({ type: 'error', message: `复盘包校验失败：${preview.validationErrors[0]}` });
          return;
        }

        if (preview.conflicts.length > 0) {
          const blockCount = preview.conflicts.filter((c) => c.severity === 'block').length;
          const warnCount = preview.conflicts.filter((c) => c.severity === 'warn').length;
          if (blockCount > 0) {
            state.addToast({
              type: 'error',
              message: `复盘包存在${blockCount}项阻断冲突，仅可查看`,
            });
          } else if (warnCount > 0) {
            state.addToast({
              type: 'warning',
              message: `复盘包存在${warnCount}项警告冲突，将以只读模式应用`,
            });
          } else {
            state.addToast({ type: 'info', message: `已生成复盘包预览：${preview.package?.name}` });
          }
        } else {
          state.addToast({ type: 'info', message: `已生成复盘包预览：${preview.package?.name}` });
        }
      } catch {
        set((state) => ({
          reviewState: {
            ...state.reviewState,
            importPreview: {
              valid: false,
              package: null,
              conflicts: [],
              validationErrors: ['JSON 解析失败，请检查文件格式'],
              isParseError: true,
              canApply: false,
              applyMode: 'view_only',
            },
          },
        }));
        state.addToast({ type: 'error', message: '复盘包解析失败' });
      }
    },

    cancelReviewImport: () => {
      set((state) => ({
        reviewState: { ...state.reviewState, importPreview: null },
      }));
      get().addToast({ type: 'info', message: '已取消复盘包导入' });
    },

    applyReviewImport: () => {
      const state = get();
      const preview = state.reviewState.importPreview;
      if (!preview || !preview.valid || !preview.package) {
        state.addToast({ type: 'error', message: '没有可应用的复盘包' });
        return;
      }

      if (!preview.canApply) {
        state.addToast({ type: 'error', message: '该复盘包存在阻断冲突，无法应用' });
        return;
      }

      const pkg = preview.package;
      const activeSession = get().getActiveSession();

      if (activeSession && state.reviewState.lastImportedPackageId === pkg.id) {
        state.addToast({ type: 'info', message: '该复盘包已应用，无需重复操作' });
        return;
      }

      const undoSnapshot = {
        selectedSlotIds: [...state.reviewState.selectedSlotIds],
        diff: state.reviewState.diff ? { ...state.reviewState.diff } : null,
        selection: state.reviewState.selection ? { ...state.reviewState.selection } : null,
      };

      set((state) => ({
        reviewState: {
          ...state.reviewState,
          selection: pkg.snapshotSelection,
          diff: pkg.diff,
          selectedSlotIds: [...pkg.selectedSlotIds],
          importPreview: null,
          undoSnapshot,
          lastImportedPackageId: pkg.id,
          enabled: true,
        },
      }));

      saveReviewSelection(pkg.snapshotSelection);
      saveReviewSelectedSlotIds(pkg.selectedSlotIds);
      saveReviewLastImportedPackageId(pkg.id);
      saveReviewDiff(pkg.diff);

      if (activeSession) {
        const metadata = {
          packageId: pkg.id,
          packageName: pkg.name,
          applyMode: preview.applyMode,
        };
        if (!isDuplicateLogEntry(activeSession.logs, 'import_review', metadata)) {
          const log = createLogEntry(
            activeSession.id,
            'import_review',
            `导入复盘包：${pkg.name}`,
            metadata
          );
          activeSession.logs.push(log);
        }
        if (!isDuplicateLogEntry(activeSession.logs, 'apply_review', metadata)) {
          const log2 = createLogEntry(
            activeSession.id,
            'apply_review',
            `应用复盘包：${pkg.name}（${preview.applyMode === 'full' ? '完整模式' : '只读模式'}）`,
            metadata
          );
          activeSession.logs.push(log2);
          activeSession.lastOpenedAt = new Date().toISOString();
          saveSession(activeSession);
          get().refreshSessions();
        }
      }

      state.addToast({ type: 'success', message: `复盘包已应用：${pkg.name}` });
    },

    undoReviewImport: () => {
      const state = get();
      const undoSnapshot = state.reviewState.undoSnapshot;
      if (!undoSnapshot) {
        state.addToast({ type: 'warning', message: '没有可撤销的复盘操作' });
        return;
      }

      const activeSession = get().getActiveSession();
      const pkgId = state.reviewState.lastImportedPackageId;

      set((state) => ({
        reviewState: {
          ...state.reviewState,
          selection: undoSnapshot.selection,
          diff: undoSnapshot.diff,
          selectedSlotIds: [...undoSnapshot.selectedSlotIds],
          undoSnapshot: null,
          lastImportedPackageId: null,
        },
      }));

      saveReviewSelection(undoSnapshot.selection);
      saveReviewSelectedSlotIds(undoSnapshot.selectedSlotIds);
      saveReviewLastImportedPackageId(null);
      saveReviewDiff(undoSnapshot.diff);

      if (activeSession && pkgId) {
        const metadata = { packageId: pkgId };
        if (!isDuplicateLogEntry(activeSession.logs, 'undo_review', metadata)) {
          const log = createLogEntry(
            activeSession.id,
            'undo_review',
            `撤销复盘包应用`,
            metadata
          );
          activeSession.logs.push(log);
          activeSession.lastOpenedAt = new Date().toISOString();
          saveSession(activeSession);
          get().refreshSessions();
        }
      }

      state.addToast({ type: 'success', message: '已撤销复盘包应用' });
    },

    refreshReviewFromStorage: () => {
      const persisted = loadPersistedState();
      set((state) => ({
        reviewState: {
          ...state.reviewState,
          selection: persisted.reviewState?.selection ?? state.reviewState.selection,
          selectedSlotIds: persisted.reviewState?.selectedSlotIds ?? state.reviewState.selectedSlotIds,
          lastImportedPackageId: persisted.reviewState?.lastImportedPackageId ?? state.reviewState.lastImportedPackageId,
          diff: persisted.reviewState?.diff ?? state.reviewState.diff,
        },
      }));
    },

    setInspectionEnabled: (enabled) => {
      set((state) => ({
        inspectionState: { ...state.inspectionState, enabled },
      }));
      if (!enabled) {
        get().clearInspectionSlotSelection();
      }
    },

    toggleInspectionSlotSelection: (slotId) => {
      set((state) => {
        const selected = new Set(state.inspectionState.selectedSlotIds);
        if (selected.has(slotId)) {
          selected.delete(slotId);
        } else {
          selected.add(slotId);
        }
        const selectedSlotIds = Array.from(selected);
        saveInspectionSelectedSlotIds(selectedSlotIds);
        return {
          inspectionState: { ...state.inspectionState, selectedSlotIds },
        };
      });
    },

    clearInspectionSlotSelection: () => {
      set((state) => ({
        inspectionState: { ...state.inspectionState, selectedSlotIds: [] },
      }));
      saveInspectionSelectedSlotIds([]);
    },

    getFilteredSlotsForInspection: () => {
      const state = get();
      const filtered = filterSlots(state.layout, state.filters);
      return filtered.map((s) => s.id);
    },

    selectAllFilteredSlotsForInspection: () => {
      const state = get();
      const filteredSlotIds = state.getFilteredSlotsForInspection();
      set((s) => ({
        inspectionState: { ...s.inspectionState, selectedSlotIds: filteredSlotIds },
      }));
      saveInspectionSelectedSlotIds(filteredSlotIds);
      state.addToast({ type: 'info', message: `已选择 ${filteredSlotIds.length} 个筛选结果货位` });
    },

    createInspectionDraft: (name, description) => {
      const state = get();
      if (state.inspectionState.selectedSlotIds.length === 0) {
        state.addToast({ type: 'warning', message: '请先选择要巡检的货位' });
        return;
      }

      const pkg = createInspectionPackage(
        state.layout,
        state.filters,
        state.inspectionState.selectedSlotIds,
        name,
        description
      );

      set((s) => ({
        inspectionState: { ...s.inspectionState, draft: pkg },
      }));
      saveInspectionDraft(pkg);

      const activeSession = state.getActiveSession();
      if (activeSession) {
        const metadata = {
          packageId: pkg.id,
          packageName: pkg.name,
          slotCount: pkg.selectedSlotIds.length,
        };
        if (!isDuplicateInspectionLogEntry(activeSession.logs, 'create_inspection_draft', metadata)) {
          const log = createLogEntry(
            activeSession.id,
            'create_inspection_draft',
            `创建巡检任务草稿：${pkg.name}`,
            metadata
          );
          activeSession.logs.push(log);
          saveSession(activeSession);
          state.refreshSessions();
        }
      }

      state.addToast({ type: 'success', message: `巡检草稿已创建：${pkg.name}` });
    },

    updateInspectionDraft: () => {
      const state = get();
      if (!state.inspectionState.draft) {
        state.addToast({ type: 'warning', message: '没有可更新的巡检草稿' });
        return;
      }

      const updatedPkg = updateInspectionPackage(
        state.inspectionState.draft,
        state.layout,
        state.filters,
        state.inspectionState.selectedSlotIds
      );

      set((s) => ({
        inspectionState: { ...s.inspectionState, draft: updatedPkg },
      }));
      saveInspectionDraft(updatedPkg);

      const activeSession = state.getActiveSession();
      if (activeSession) {
        const metadata = {
          packageId: updatedPkg.id,
          packageName: updatedPkg.name,
          slotCount: updatedPkg.selectedSlotIds.length,
        };
        if (!isDuplicateInspectionLogEntry(activeSession.logs, 'update_inspection_draft', metadata)) {
          const log = createLogEntry(
            activeSession.id,
            'update_inspection_draft',
            `更新巡检任务草稿：${updatedPkg.name}`,
            metadata
          );
          activeSession.logs.push(log);
          saveSession(activeSession);
          state.refreshSessions();
        }
      }

      state.addToast({ type: 'success', message: `巡检草稿已更新` });
    },

    clearInspectionDraft: () => {
      const state = get();
      const draftName = state.inspectionState.draft?.name;

      set((s) => ({
        inspectionState: { ...s.inspectionState, draft: null },
      }));
      saveInspectionDraft(null);

      const activeSession = state.getActiveSession();
      if (activeSession && draftName) {
        const log = createLogEntry(
          activeSession.id,
          'clear_inspection_draft',
          `清除巡检任务草稿：${draftName}`
        );
        activeSession.logs.push(log);
        saveSession(activeSession);
        state.refreshSessions();
      }

      state.addToast({ type: 'info', message: '巡检草稿已清除' });
    },

    publishInspection: () => {
      const state = get();
      if (!state.inspectionState.draft) {
        state.addToast({ type: 'warning', message: '请先创建巡检草稿' });
        return;
      }

      const undoSnapshot: InspectionUndoSnapshot = {
        packageId: state.inspectionState.draft.id,
        packageName: state.inspectionState.draft.name,
        previousDraft: state.inspectionState.draft,
        previousPublished: state.inspectionState.lastPublished,
        previousSelectedSlotIds: [...state.inspectionState.selectedSlotIds],
        previousFilters: { ...state.filters },
        createdAt: new Date().toISOString(),
      };

      const publishedPkg = publishInspectionPackage(state.inspectionState.draft);

      set((s) => ({
        inspectionState: {
          ...s.inspectionState,
          draft: null,
          lastPublished: publishedPkg,
          undoSnapshot,
          lastImportedPackageId: publishedPkg.id,
        },
      }));
      saveInspectionDraft(null);
      saveInspectionLastPublished(publishedPkg);
      saveInspectionLastImportedPackageId(publishedPkg.id);

      const activeSession = state.getActiveSession();
      if (activeSession) {
        const metadata = {
          packageId: publishedPkg.id,
          packageName: publishedPkg.name,
          slotCount: publishedPkg.selectedSlotIds.length,
          totalDistance: publishedPkg.totalDistance,
        };
        const log = createLogEntry(
          activeSession.id,
          'publish_inspection',
          `发布巡检任务：${publishedPkg.name}`,
          metadata
        );
        activeSession.logs.push(log);
        saveSession(activeSession);
        state.refreshSessions();
      }

      state.addToast({ type: 'success', message: `巡检任务已发布：${publishedPkg.name}` });
    },

    undoPublishInspection: () => {
      const state = get();
      const undoSnapshot = state.inspectionState.undoSnapshot;
      if (!undoSnapshot) {
        state.addToast({ type: 'warning', message: '没有可撤销的发布操作' });
        return;
      }

      set((s) => ({
        inspectionState: {
          ...s.inspectionState,
          draft: undoSnapshot.previousDraft,
          lastPublished: undoSnapshot.previousPublished,
          selectedSlotIds: [...undoSnapshot.previousSelectedSlotIds],
          undoSnapshot: null,
          lastImportedPackageId: undoSnapshot.previousPublished?.id ?? null,
        },
        filters: { ...undoSnapshot.previousFilters },
      }));
      saveInspectionDraft(undoSnapshot.previousDraft);
      saveInspectionLastPublished(undoSnapshot.previousPublished);
      saveInspectionLastImportedPackageId(undoSnapshot.previousPublished?.id ?? null);
      saveInspectionSelectedSlotIds(undoSnapshot.previousSelectedSlotIds);
      saveFilters(undoSnapshot.previousFilters);

      const activeSession = state.getActiveSession();
      if (activeSession) {
        const metadata = {
          packageId: undoSnapshot.packageId,
          packageName: undoSnapshot.packageName,
        };
        const log = createLogEntry(
          activeSession.id,
          'undo_publish_inspection',
          `撤销发布巡检任务：${undoSnapshot.packageName}`,
          metadata
        );
        activeSession.logs.push(log);
        saveSession(activeSession);
        state.refreshSessions();
      }

      state.addToast({ type: 'success', message: '已撤销发布，恢复至草稿状态' });
    },

    exportInspectionJSON: () => {
      const state = get();
      const pkg = state.inspectionState.draft || state.inspectionState.lastPublished;
      if (!pkg) {
        state.addToast({ type: 'warning', message: '没有可导出的巡检任务' });
        return;
      }

      const json = exportInspectionToJSON(pkg);
      const safeName = pkg.name.replace(/[\\/:*?"<>|]/g, '_');
      downloadJSON(`巡检任务_${safeName}.json`, json);
      incrementExportCount();

      const activeSession = state.getActiveSession();
      if (activeSession) {
        const metadata = {
          packageId: pkg.id,
          packageName: pkg.name,
          status: pkg.status,
        };
        if (!isDuplicateInspectionLogEntry(activeSession.logs, 'export_inspection_json', metadata)) {
          const log = createLogEntry(
            activeSession.id,
            'export_inspection_json',
            `导出巡检任务JSON：${pkg.name}`,
            metadata
          );
          activeSession.logs.push(log);
          activeSession.lastOpenedAt = new Date().toISOString();
          saveSession(activeSession);
          state.refreshSessions();
        }
      }

      state.addToast({ type: 'success', message: '巡检任务已导出' });
    },

    prepareInspectionImport: async (file) => {
      const state = get();
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const preview = prepareInspectionImportPreview(
          data,
          state.layout,
          state.inspectionState.draft,
          state.inspectionState.lastPublished
        );

        set((s) => ({
          inspectionState: { ...s.inspectionState, importPreview: preview },
        }));

        if (!preview.valid) {
          state.addToast({ type: 'error', message: `巡检包校验失败：${preview.validationErrors[0]}` });
          return;
        }

        if (preview.conflicts.length > 0) {
          const blockCount = preview.conflicts.filter((c) => c.severity === 'block').length;
          const warnCount = preview.conflicts.filter((c) => c.severity === 'warn').length;
          if (blockCount > 0) {
            state.addToast({
              type: 'error',
              message: `巡检包存在${blockCount}项阻断冲突，仅可查看`,
            });
          } else if (warnCount > 0) {
            const hasIdDuplicate = preview.conflicts.some((c) => c.type === 'id_duplicate');
            if (hasIdDuplicate) {
              state.addToast({
                type: 'warning',
                message: `巡检包存在ID冲突，导入将覆盖现有内容`,
              });
            } else {
              state.addToast({
                type: 'warning',
                message: `巡检包存在${warnCount}项警告冲突`,
              });
            }
          } else {
            state.addToast({ type: 'info', message: `已生成巡检包预览：${preview.package?.name}` });
          }
        } else {
          state.addToast({ type: 'info', message: `已生成巡检包预览：${preview.package?.name}` });
        }
      } catch {
        set((s) => ({
          inspectionState: {
            ...s.inspectionState,
            importPreview: {
              valid: false,
              package: null,
              conflicts: [],
              validationErrors: ['JSON 解析失败，请检查文件格式'],
              isParseError: true,
              canApply: false,
              applyMode: 'view_only',
            },
          },
        }));
        state.addToast({ type: 'error', message: '巡检包解析失败' });
      }
    },

    cancelInspectionImport: () => {
      set((state) => ({
        inspectionState: { ...state.inspectionState, importPreview: null },
      }));
      get().addToast({ type: 'info', message: '已取消巡检包导入' });
    },

    applyInspectionImport: (mode) => {
      const state = get();
      const preview = state.inspectionState.importPreview;
      if (!preview || !preview.valid || !preview.package) {
        state.addToast({ type: 'error', message: '没有可应用的巡检包' });
        return;
      }

      if (!preview.canApply) {
        state.addToast({ type: 'error', message: '该巡检包存在阻断冲突，无法应用' });
        return;
      }

      const pkg = preview.package;
      const activeSession = state.getActiveSession();

      if (activeSession && state.inspectionState.lastImportedPackageId === pkg.id && mode === 'overwrite') {
        state.addToast({ type: 'info', message: '该巡检包已应用，无需重复操作' });
        return;
      }

      const undoSnapshot: InspectionUndoSnapshot = {
        packageId: pkg.id,
        packageName: pkg.name,
        previousDraft: state.inspectionState.draft,
        previousPublished: state.inspectionState.lastPublished,
        previousSelectedSlotIds: [...state.inspectionState.selectedSlotIds],
        previousFilters: { ...state.filters },
        createdAt: new Date().toISOString(),
      };

      let newDraft = state.inspectionState.draft;
      let newPublished = state.inspectionState.lastPublished;
      let newSelectedSlotIds = state.inspectionState.selectedSlotIds;
      let newFilters = state.filters;

      if (mode === 'overwrite') {
        if (pkg.status === 'draft') {
          newDraft = pkg;
          newPublished = state.inspectionState.lastPublished;
        } else {
          newDraft = null;
          newPublished = pkg;
        }
        newSelectedSlotIds = [...pkg.selectedSlotIds];
        newFilters = { ...pkg.filterSnapshot };
      }

      set((s) => ({
        inspectionState: {
          ...s.inspectionState,
          draft: newDraft,
          lastPublished: newPublished,
          selectedSlotIds: newSelectedSlotIds,
          importPreview: null,
          undoSnapshot,
          lastImportedPackageId: pkg.id,
          enabled: true,
        },
        filters: newFilters,
      }));

      saveInspectionDraft(newDraft);
      saveInspectionLastPublished(newPublished);
      saveInspectionLastImportedPackageId(pkg.id);
      saveInspectionSelectedSlotIds(newSelectedSlotIds);
      saveFilters(newFilters);

      if (activeSession) {
        const metadata = {
          packageId: pkg.id,
          packageName: pkg.name,
          applyMode: mode,
          status: pkg.status,
        };
        if (!isDuplicateInspectionLogEntry(activeSession.logs, 'import_inspection', metadata)) {
          const log1 = createLogEntry(
            activeSession.id,
            'import_inspection',
            `导入巡检包：${pkg.name}`,
            metadata
          );
          activeSession.logs.push(log1);
        }
        if (!isDuplicateInspectionLogEntry(activeSession.logs, 'apply_inspection_import', metadata)) {
          const log2 = createLogEntry(
            activeSession.id,
            'apply_inspection_import',
            `应用巡检包：${pkg.name}（${mode === 'overwrite' ? '覆盖模式' : '只读模式'}）`,
            metadata
          );
          activeSession.logs.push(log2);
        }
        activeSession.lastOpenedAt = new Date().toISOString();
        saveSession(activeSession);
        state.refreshSessions();
      }

      state.addToast({
        type: 'success',
        message: `巡检包已应用：${pkg.name}（${mode === 'overwrite' ? '覆盖模式' : '只读模式'}）`,
      });
    },

    refreshInspectionFromStorage: () => {
      const persisted = loadInspectionState();
      set((state) => ({
        inspectionState: {
          ...state.inspectionState,
          selectedSlotIds: persisted.selectedSlotIds,
          draft: persisted.draft,
          lastPublished: persisted.lastPublished,
          lastImportedPackageId: persisted.lastImportedPackageId,
        },
      }));
    },
  };
});
