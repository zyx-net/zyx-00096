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

interface AppState {
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
}

const initialLayout = sampleData as unknown as WarehouseLayout;

export const useStore = create<AppState>((set, get) => {
  const persisted = loadPersistedState();
  const initialConflicts = detectConflicts(initialLayout);

  const conflictsWithPersistedConfirm = initialConflicts.map((c) => ({
    ...c,
    confirmed: persisted.confirmedConflicts.includes(c.id),
  }));

  return {
    layout: initialLayout,
    conflicts: conflictsWithPersistedConfirm,
    filters: persisted.filters,
    selectedSlotId: persisted.selectedSlotId,
    currentPlaybackIndex: persisted.currentPlaybackIndex,
    isPlaybackPlaying: false,
    toasts: [],
    cameraState: persisted.cameraState,
    leftPanelOpen: true,
    rightPanelOpen: true,
    previewDraft: persisted.previewDraft ?? null,
    undoSnapshot: persisted.undoSnapshot ?? null,
    currentBatchId: persisted.currentBatchId ?? null,

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
      });

      saveUndoSnapshot(null);
      saveCurrentBatchId(null);
      saveFilters(snap.filters);
      saveConfirmedConflicts(snap.confirmedConflicts);
      savePlaybackIndex(snap.playbackIndex);
      saveSelectedSlotId(snap.selectedSlotId);
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
    },

    setSelectedSlotId: (id) => {
      set({ selectedSlotId: id });
      saveSelectedSlotId(id);
    },

    confirmConflict: (conflictId) => {
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
      get().addToast({
        type: 'success',
        message: '冲突已确认',
      });
    },

    setPlaybackIndex: (index) => {
      set({ currentPlaybackIndex: index });
      savePlaybackIndex(index);
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
      return incrementExportCount();
    },
  };
});
