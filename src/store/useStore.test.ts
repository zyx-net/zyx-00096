import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveAllSessions,
  saveFilters,
  saveConfirmedConflicts,
  saveCameraState,
  savePlaybackIndex,
  saveSelectedSlotId,
  saveCurrentBatchId,
  saveActiveSessionId,
  savePreviewDraft,
} from '@/utils/storage';
import type { ReviewSession, Filters, CameraState } from '@/types';
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

  it('场景1: 导入布局后创建会话 - 有 currentBatchId 时不应自动恢复会话', async () => {
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
    expect(state.filters.statusFilter).toBe('all');
    expect(state.filters.shelfFilter).toBe('all');
    expect(state.selectedSlotId).toBe(null);
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
});
