import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveAllSessions,
  loadAllSessions,
  saveFilters,
  saveConfirmedConflicts,
  saveCameraState,
  savePlaybackIndex,
  saveSelectedSlotId,
  saveCurrentBatchId,
  saveActiveSessionId,
  savePreviewDraft,
} from '@/utils/storage';
import type { ReviewSession, Filters, CameraState, ImportPreviewDraft, UndoSnapshot, WarehouseLayout } from '@/types';
import { detectConflicts } from '@/utils/conflict';
import type { AppState } from '@/store/useStore';

async function loadStoreFresh(): Promise<{
  useStore: { getState: () => AppState };
  initialLayout: { slots: { id: string }[]; pallets: { id: string }[]; name: string };
}> {
  vi.resetModules();
  const mod = await import('@/store/useStore');
  return { useStore: mod.useStore, initialLayout: mod.initialLayout };
}

async function createTestSession(
  initialLayout: { slots: { id: string }[]; pallets: { id: string }[]; name: string },
  overrides: Partial<ReviewSession> = {}
): Promise<ReviewSession> {
  const mod = await import('@/store/useStore');
  const baseConflicts = detectConflicts(mod.initialLayout);
  const baseConfirmedIds = [baseConflicts[0]?.id ?? ''];
  const mergedConflicts = baseConflicts.map((c) => ({
    ...c,
    confirmed: baseConfirmedIds.includes(c.id),
    confirmedAt: baseConfirmedIds.includes(c.id) ? new Date().toISOString() : undefined,
    confirmedBy: baseConfirmedIds.includes(c.id) ? '管理员' : undefined,
  }));
  return {
    id: 'test-session-001',
    name: '测试会话',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    layoutName: initialLayout.name,
    conflicts: mergedConflicts,
    confirmedConflictIds: baseConfirmedIds,
    filters: { statusFilter: 'conflict', shelfFilter: 'shelf-a' },
    selectedSlotId: 'slot-test-001',
    cameraState: { position: { x: 10, y: 20, z: 30 }, target: { x: 0, y: 0, z: 0 } },
    playbackIndex: 2,
    slotIds: initialLayout.slots.map((s) => s.id),
    palletIds: initialLayout.pallets.map((p) => p.id),
    logs: [],
    ...overrides,
  };
}

function setupPersistedState(state: {
  activeSessionId?: string | null;
  currentBatchId?: string | null;
  previewDraft?: unknown | null;
  confirmedConflicts?: string[];
  filters?: Filters;
  cameraState?: CameraState;
  selectedSlotId?: string | null;
  playbackIndex?: number;
}) {
  if (state.activeSessionId !== undefined) saveActiveSessionId(state.activeSessionId);
  if (state.currentBatchId !== undefined) saveCurrentBatchId(state.currentBatchId);
  if (state.previewDraft !== undefined) savePreviewDraft(state.previewDraft as null);
  if (state.confirmedConflicts) saveConfirmedConflicts(state.confirmedConflicts);
  if (state.filters) saveFilters(state.filters);
  if (state.cameraState) saveCameraState(state.cameraState);
  if (state.selectedSlotId !== undefined) saveSelectedSlotId(state.selectedSlotId);
  if (state.playbackIndex !== undefined) savePlaybackIndex(state.playbackIndex);
}

describe('复核会话 - 初始化自动恢复', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: 导入布局后创建会话 - 有 currentBatchId 时应降级为 view_only（恢复筛选/视角但不覆盖仓库数据）', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);
    setupPersistedState({
      activeSessionId: session.id,
      currentBatchId: 'batch-import-001',
    });

    const { useStore: store2 } = await loadStoreFresh();
    const state = store2.getState();

    expect(state.activeSessionId).toBe(session.id);
    expect(state.conflicts[0]?.confirmed).toBe(false);
    expect(state.filters.statusFilter).toBe('conflict');
    expect(state.filters.shelfFilter).toBe('shelf-a');
    expect(state.selectedSlotId).toBe(null);
    expect(state.currentPlaybackIndex).toBe(-1);
    expect(state.cameraState?.position).toEqual({ x: 10, y: 20, z: 30 });
    const restoredSession = state.getActiveSession();
    expect(restoredSession?.logs.some((l) => l.action === 'restore_session')).toBe(true);
  });

  it('场景2: 刷新自动恢复 - 有活跃会话且无导入时应完整恢复', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    const expectedConflictId = session.confirmedConflictIds[0];
    saveAllSessions([session]);
    setupPersistedState({
      activeSessionId: session.id,
      currentBatchId: null,
      previewDraft: null,
    });

    const { useStore: store2 } = await loadStoreFresh();
    const state = store2.getState();
    const conflict = state.conflicts.find((c) => c.id === expectedConflictId);

    expect(state.activeSessionId).toBe(session.id);
    expect(conflict?.confirmed).toBe(true);
    expect(state.filters.statusFilter).toBe('conflict');
    expect(state.filters.shelfFilter).toBe('shelf-a');
    expect(state.selectedSlotId).toBe('slot-test-001');
    expect(state.currentPlaybackIndex).toBe(2);
    expect(state.cameraState?.position).toEqual({ x: 10, y: 20, z: 30 });

    const restoredSession = state.getActiveSession();
    expect(restoredSession?.logs.length).toBeGreaterThan(0);
    expect(restoredSession?.logs.some((l) => l.action === 'restore_session')).toBe(true);
  });

  it('场景2b: 归档会话不应自动恢复', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout, { status: 'archived' });
    saveAllSessions([session]);
    setupPersistedState({
      activeSessionId: session.id,
      currentBatchId: null,
      previewDraft: null,
    });

    const { useStore: store2 } = await loadStoreFresh();
    const state = store2.getState();

    expect(state.conflicts[0]?.confirmed).toBe(false);
    expect(state.filters.statusFilter).toBe('all');
  });

  it('场景3: 确认状态同步 - confirmConflict 后应调用 updateActiveSession', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout, { confirmedConflictIds: [] });
    saveAllSessions([session]);
    setupPersistedState({
      activeSessionId: session.id,
      currentBatchId: null,
      previewDraft: null,
    });

    const { useStore: store2 } = await loadStoreFresh();
    const state = store2.getState();
    const conflictId = state.conflicts[0]?.id;
    expect(conflictId).toBeDefined();

    state.confirmConflict(conflictId!);

    const savedSession = state.getActiveSession();
    expect(savedSession?.confirmedConflictIds).toContain(conflictId);
    expect(savedSession?.conflicts.find((c) => c.id === conflictId)?.confirmed).toBe(true);
    expect(savedSession?.logs.some((l) => l.action === 'confirm_conflict')).toBe(true);
  });

  it('场景3b: unconfirmConflict 后应同步更新会话', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    const confirmedId = session.confirmedConflictIds[0];
    saveAllSessions([session]);
    setupPersistedState({
      activeSessionId: session.id,
      currentBatchId: null,
      previewDraft: null,
    });

    const { useStore: store2 } = await loadStoreFresh();
    const state = store2.getState();
    state.unconfirmConflict(confirmedId);

    const savedSession = state.getActiveSession();
    expect(savedSession?.confirmedConflictIds).not.toContain(confirmedId);
    expect(savedSession?.conflicts.find((c) => c.id === confirmedId)?.confirmed).toBe(false);
    expect(savedSession?.logs.some((l) => l.action === 'unconfirm_conflict')).toBe(true);
  });

  it('场景3c: setFilters/setSelectedSlotId/setCameraState/setPlaybackIndex 后应同步更新会话', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);
    setupPersistedState({
      activeSessionId: session.id,
      currentBatchId: null,
      previewDraft: null,
    });

    const { useStore: store2 } = await loadStoreFresh();
    const state = store2.getState();

    state.setFilters({ statusFilter: 'occupied', shelfFilter: 'shelf-b' });
    state.setSelectedSlotId('slot-updated-001');
    state.setCameraState({ position: { x: 5, y: 5, z: 5 }, target: { x: 1, y: 1, z: 1 } });
    state.setPlaybackIndex(3);

    const savedSession = state.getActiveSession();
    expect(savedSession?.filters.statusFilter).toBe('occupied');
    expect(savedSession?.filters.shelfFilter).toBe('shelf-b');
    expect(savedSession?.selectedSlotId).toBe('slot-updated-001');
    expect(savedSession?.cameraState?.position).toEqual({ x: 5, y: 5, z: 5 });
    expect(savedSession?.playbackIndex).toBe(3);
  });

  it('场景4: 布局不匹配降级 - 货位不匹配时应只恢复视角和筛选', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout, {
      slotIds: ['slot-missing-1', 'slot-missing-2', ...initialLayout.slots.slice(0, 2).map((s) => s.id)],
      palletIds: ['pallet-missing-1', ...initialLayout.pallets.slice(0, 1).map((p) => p.id)],
    });
    saveAllSessions([session]);
    setupPersistedState({
      activeSessionId: session.id,
      currentBatchId: null,
      previewDraft: null,
    });

    const { useStore: store2 } = await loadStoreFresh();
    const state = store2.getState();

    expect(state.filters.statusFilter).toBe('conflict');
    expect(state.filters.shelfFilter).toBe('shelf-a');
    expect(state.cameraState?.position).toEqual({ x: 10, y: 20, z: 30 });

    expect(state.conflicts[0]?.confirmed).toBe(false);
    expect(state.selectedSlotId).not.toBe('slot-test-001');
    expect(state.currentPlaybackIndex).not.toBe(2);

    const restoredSession = state.getActiveSession();
    expect(restoredSession?.logs.some((l) => l.action === 'restore_session' && l.metadata?.restoreMode === 'view_only')).toBe(true);
  });

  it('场景4b: 额外货位不匹配时也应降级', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout, {
      slotIds: initialLayout.slots.slice(0, 2).map((s) => s.id),
      palletIds: initialLayout.pallets.slice(0, 1).map((p) => p.id),
    });
    saveAllSessions([session]);
    setupPersistedState({
      activeSessionId: session.id,
      currentBatchId: null,
      previewDraft: null,
    });

    const { useStore: store2 } = await loadStoreFresh();
    const state = store2.getState();

    expect(state.filters.statusFilter).toBe('conflict');
    expect(state.conflicts[0]?.confirmed).toBe(false);
  });

  it('场景5: 归档会话的权限控制 - 归档后不能确认/撤销确认', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout, { status: 'archived' });
    saveAllSessions([session]);
    setupPersistedState({
      activeSessionId: session.id,
      currentBatchId: null,
      previewDraft: null,
    });

    const { useStore: store2 } = await loadStoreFresh();
    let state = store2.getState();
    expect(state.isSessionArchived()).toBe(true);

    const conflictId = state.conflicts[0]?.id;
    const initialToasts = state.toasts.length;

    state.confirmConflict(conflictId!);
    state = store2.getState();
    expect(state.toasts.length).toBe(initialToasts + 1);
    expect(state.toasts[initialToasts]?.message).toContain('归档');

    state.unconfirmConflict(conflictId!);
    state = store2.getState();
    expect(state.toasts.length).toBe(initialToasts + 2);
  });

  it('场景1b: previewDraft 存在时也走 view_only 降级（恢复筛选/视角不覆盖预览）', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    const emptyLayout = {
      version: '0.0.0',
      name: '预览布局',
      shelves: [],
      slots: [],
      pallets: [],
      inventoryRecords: [],
    } as unknown as WarehouseLayout;
    const draft: ImportPreviewDraft = {
      batchId: 'preview-batch-001',
      layout: emptyLayout,
      validationErrors: [],
      isParseError: false,
      summary: {
        name: '预览布局',
        shelfCount: 0,
        slotCount: 0,
        palletCount: 0,
        recordCount: 0,
        diff: { addedSlotIds: [], removedSlotIds: [], overwrittenSlotIds: [], addedPalletIds: [], removedPalletIds: [] },
        projectedConflicts: [],
      },
      createdAt: new Date().toISOString(),
    };
    saveAllSessions([session]);
    savePreviewDraft(draft);
    saveActiveSessionId(session.id);

    const { useStore: store2 } = await loadStoreFresh();
    const state = store2.getState();

    expect(state.previewDraft?.batchId).toBe('preview-batch-001');
    expect(state.conflicts[0]?.confirmed).toBe(false);
    expect(state.filters.statusFilter).toBe('conflict');
    expect(state.filters.shelfFilter).toBe('shelf-a');
    expect(state.selectedSlotId).toBe(null);
    expect(state.cameraState?.position).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('场景6: applyImportPreview 应写入 apply_import 日志（先写日志再清空 activeSessionId）', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);
    saveActiveSessionId(session.id);

    const { useStore: store2 } = await loadStoreFresh();
    const baseConflicts = detectConflicts(initialLayout as unknown as WarehouseLayout);
    const emptyLayout = {
      version: '0.0.0',
      name: '新导入布局',
      shelves: [],
      slots: [],
      pallets: [],
      inventoryRecords: [],
    } as unknown as WarehouseLayout;
    const draft: ImportPreviewDraft = {
      batchId: 'apply-batch-001',
      layout: emptyLayout,
      validationErrors: [],
      isParseError: false,
      summary: {
        name: '新导入布局',
        shelfCount: 0,
        slotCount: 0,
        palletCount: 0,
        recordCount: 0,
        diff: { addedSlotIds: [], removedSlotIds: [], overwrittenSlotIds: [], addedPalletIds: [], removedPalletIds: [] },
        projectedConflicts: baseConflicts,
      },
      createdAt: new Date().toISOString(),
    };
    (store2 as unknown as { setState: (p: Partial<AppState>) => void }).setState({ previewDraft: draft });
    store2.getState().applyImportPreview();

    const state = store2.getState();
    expect(state.activeSessionId).toBe(null);
    const stored = loadAllSessions();
    const updatedSession = stored.find((s) => s.id === session.id);
    expect(updatedSession?.logs.some((l) => l.action === 'apply_import')).toBe(true);
    expect(updatedSession?.logs.some((l) => l.description?.includes('新导入布局'))).toBe(true);
  });

  it('场景7: undoLastImport 应写入 undo_import 日志（先写日志再清空 activeSessionId）', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);
    saveActiveSessionId(session.id);

    const { useStore: store2 } = await loadStoreFresh();
    const baseConflicts = detectConflicts(initialLayout as unknown as WarehouseLayout);
    const snap: UndoSnapshot = {
      batchId: 'undo-batch-001',
      importedLayoutName: '撤销目标布局',
      layout: initialLayout as unknown as WarehouseLayout,
      conflicts: baseConflicts,
      confirmedConflicts: [],
      filters: { statusFilter: 'all', shelfFilter: 'all' },
      playbackIndex: -1,
      selectedSlotId: null,
      createdAt: new Date().toISOString(),
    };
    (store2 as unknown as { setState: (p: Partial<AppState>) => void }).setState({ undoSnapshot: snap });
    store2.getState().undoLastImport();

    const state = store2.getState();
    expect(state.activeSessionId).toBe(null);
    const stored = loadAllSessions();
    const updatedSession = stored.find((s) => s.id === session.id);
    expect(updatedSession?.logs.some((l) => l.action === 'undo_import')).toBe(true);
    expect(updatedSession?.logs.some((l) => l.description?.includes('撤销目标布局'))).toBe(true);
  });
});
