import { create } from 'zustand';
import type {
  WarehouseLayout,
  Conflict,
  Filters,
  CameraState,
  Toast,
  Pallet,
  InventoryRecord,
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
} from '@/utils/storage';

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

  setLayout: (layout: WarehouseLayout) => void;
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

    setLayout: (layout) => {
      const newConflicts = detectConflicts(layout);
      set({ layout, conflicts: newConflicts });
    },

    importLayout: async (file) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = validateLayout(data);
        if (!result.valid || !result.layout) {
          get().addToast({
            type: 'error',
            message: `布局配置损坏：${result.errors.join('；')}`,
          });
          set({
            conflicts: [
              {
                id: 'damaged-layout',
                type: 'damaged_layout',
                description: `布局配置文件损坏：${result.errors.join('；')}`,
                relatedIds: [],
                confirmed: false,
              },
            ],
          });
          return;
        }
        const newConflicts = detectConflicts(result.layout);
        set({ layout: result.layout, conflicts: newConflicts });
        saveConfirmedConflicts([]);
        savePlaybackIndex(-1);
        saveSelectedSlotId(null);
        get().addToast({
          type: 'success',
          message: `布局导入成功：${result.layout.name}`,
        });
      } catch (err) {
        get().addToast({
          type: 'error',
          message: '布局配置解析失败，请检查JSON格式',
        });
        set({
          conflicts: [
            {
              id: 'damaged-layout-parse',
              type: 'damaged_layout',
              description: '布局配置解析失败：JSON格式错误',
              relatedIds: [],
              confirmed: false,
            },
          ],
        });
      }
    },

    loadSampleData: () => {
      const layout = sampleData as unknown as WarehouseLayout;
      const newConflicts = detectConflicts(layout);
      set({ layout, conflicts: newConflicts, selectedSlotId: null });
      saveConfirmedConflicts([]);
      savePlaybackIndex(-1);
      saveSelectedSlotId(null);
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
