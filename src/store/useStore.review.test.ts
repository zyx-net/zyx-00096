import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveAllSessions,
  loadAllSessions,
  saveReviewSelection,
  saveReviewSelectedSlotIds,
  saveReviewLastImportedPackageId,
} from '@/utils/storage';
import type {
  ReviewSession,
  WarehouseLayout,
  ReviewPackage,
  ReviewSnapshotSelection,
} from '@/types';
import { computeReviewDiff, createReviewPackage, prepareReviewImportPreview, isDuplicateLogEntry } from '@/utils/review';
import { detectConflicts } from '@/utils/conflict';
import type { AppState } from '@/store/useStore';

async function loadStoreFresh(): Promise<{
  useStore: { getState: () => AppState; setState: (p: Partial<AppState>) => void };
  initialLayout: WarehouseLayout;
}> {
  vi.resetModules();
  const mod = await import('@/store/useStore');
  return { useStore: mod.useStore, initialLayout: mod.initialLayout as unknown as WarehouseLayout };
}

async function createTestSession(
  initialLayout: WarehouseLayout,
  overrides: Partial<ReviewSession> = {}
): Promise<ReviewSession> {
  const baseConflicts = detectConflicts(initialLayout);
  const baseConfirmedIds = [baseConflicts[0]?.id ?? ''];
  const mergedConflicts = baseConflicts.map((c) => ({
    ...c,
    confirmed: baseConfirmedIds.includes(c.id),
    confirmedAt: baseConfirmedIds.includes(c.id) ? new Date().toISOString() : undefined,
    confirmedBy: baseConfirmedIds.includes(c.id) ? '管理员' : undefined,
  }));
  return {
    id: 'test-session-review-001',
    name: '复盘测试会话',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    layoutName: initialLayout.name,
    conflicts: mergedConflicts,
    confirmedConflictIds: baseConfirmedIds,
    filters: { statusFilter: 'all', shelfFilter: 'all' },
    selectedSlotId: null,
    playbackIndex: -1,
    slotIds: initialLayout.slots.map((s) => s.id),
    palletIds: initialLayout.pallets.map((p) => p.id),
    logs: [],
    ...overrides,
  };
}

function createTestReviewPackage(
  layout: WarehouseLayout,
  selection: ReviewSnapshotSelection,
  overrides: Partial<ReviewPackage> = {}
): ReviewPackage {
  const currentConflicts = detectConflicts(layout);
  const diff = computeReviewDiff(layout, selection, currentConflicts);
  const pkg = createReviewPackage(
    layout,
    selection,
    diff,
    [layout.slots[0]?.id ?? 'slot-001'],
    '测试复盘包',
    '用于测试的复盘包',
  );
  return { ...pkg, ...overrides };
}

describe('复盘功能 - 导出再导入', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: 生成复盘对比后导出JSON，再导入应能还原相同的对比结果', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const state = store.getState();

    state.setReviewEnabled(true);
    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    state.setReviewSnapshotSelection(selection);
    state.computeReviewDiff();

    let updatedState = store.getState();
    expect(updatedState.reviewState.diff).not.toBeNull();
    expect(updatedState.reviewState.selection).toEqual(selection);

    const originalDiff = updatedState.reviewState.diff;
    expect(originalDiff).not.toBeNull();

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'));
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'));

    let exportedJSON = '';
    vi.spyOn(JSON, 'stringify').mockImplementationOnce((data) => {
      exportedJSON = JSON.stringify(data);
      return exportedJSON;
    });

    updatedState.exportReviewJSON('测试导出', '测试描述');

    expect(exportedJSON).not.toBe('');
    const parsedPkg = JSON.parse(exportedJSON) as ReviewPackage;
    expect(parsedPkg.name).toBe('测试导出');
    expect(parsedPkg.description).toBe('测试描述');
    expect(parsedPkg.snapshotSelection).toEqual(selection);

    store.getState().setReviewEnabled(false);
    store.getState().clearReviewDiff();
    updatedState = store.getState();
    expect(updatedState.reviewState.diff).toBeNull();

    const preview = prepareReviewImportPreview(parsedPkg, initialLayout);
    expect(preview.valid).toBe(true);
    expect(preview.canApply).toBe(true);
    expect(preview.applyMode).toBe('full');
    expect(preview.package?.diff.summary).toEqual(originalDiff?.summary);

    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      reviewState: { ...updatedState.reviewState, importPreview: preview },
    });

    store.getState().applyReviewImport();
    updatedState = store.getState();

    expect(updatedState.reviewState.selection).toEqual(selection);
    expect(updatedState.reviewState.diff?.summary).toEqual(originalDiff?.summary);
    expect(updatedState.reviewState.selectedSlotIds).toEqual(parsedPkg.selectedSlotIds);
    expect(updatedState.reviewState.lastImportedPackageId).toBe(parsedPkg.id);
    expect(updatedState.reviewState.enabled).toBe(true);
  });

  it('场景2: 重复导入同一复盘包不应重复写入日志', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);

    const state = store.getState();
    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    const pkg = createTestReviewPackage(initialLayout, selection);

    const preview = prepareReviewImportPreview(pkg, initialLayout);
    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      reviewState: { ...state.reviewState, importPreview: preview, enabled: true },
      activeSessionId: session.id,
    });

    store.getState().applyReviewImport();
    const updatedState = store.getState();
    const storedSession1 = loadAllSessions().find((s) => s.id === session.id);
    const importLogCount1 = storedSession1?.logs.filter((l) => l.action === 'apply_review').length ?? 0;
    expect(importLogCount1).toBe(1);

    const preview2 = prepareReviewImportPreview(pkg, initialLayout);
    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      reviewState: { ...updatedState.reviewState, importPreview: preview2 },
    });

    store.getState().applyReviewImport();
    const storedSession2 = loadAllSessions().find((s) => s.id === session.id);
    const importLogCount2 = storedSession2?.logs.filter((l) => l.action === 'apply_review').length ?? 0;
    expect(importLogCount2).toBe(1);
  });

  it('场景3: 撤销复盘导入应恢复之前的状态', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    let state = store.getState();

    state.setReviewEnabled(true);
    state.toggleReviewSlotSelection('slot-original-001');
    state = store.getState();
    expect(state.reviewState.selectedSlotIds).toContain('slot-original-001');

    const originalSelection = { snapshotAIndex: -1, snapshotBIndex: -1 };
    state.setReviewSnapshotSelection(originalSelection);
    state = store.getState();

    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    const pkg = createTestReviewPackage(initialLayout, selection);
    const preview = prepareReviewImportPreview(pkg, initialLayout);

    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      reviewState: { ...state.reviewState, importPreview: preview },
    });

    store.getState().applyReviewImport();
    let updatedState = store.getState();
    expect(updatedState.reviewState.selection).toEqual(selection);
    expect(updatedState.reviewState.undoSnapshot).not.toBeNull();
    expect(updatedState.reviewState.undoSnapshot?.selectedSlotIds).toContain('slot-original-001');

    store.getState().undoReviewImport();
    updatedState = store.getState();

    expect(updatedState.reviewState.selection).toEqual(originalSelection);
    expect(updatedState.reviewState.selectedSlotIds).toContain('slot-original-001');
    expect(updatedState.reviewState.undoSnapshot).toBeNull();
    expect(updatedState.reviewState.lastImportedPackageId).toBeNull();
  });
});

describe('复盘功能 - 冲突包导入', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: 复盘包布局名称不匹配应降级为view_only', async () => {
    const { initialLayout } = await loadStoreFresh();
    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    const pkg = createTestReviewPackage(initialLayout, selection, {
      layoutName: '完全不同的布局名称',
    });

    const preview = prepareReviewImportPreview(pkg, initialLayout);
    expect(preview.valid).toBe(true);
    expect(preview.canApply).toBe(true);
    expect(preview.applyMode).toBe('view_only');
    expect(preview.conflicts.some((c) => c.type === 'layout_mismatch')).toBe(true);
    expect(preview.conflicts.some((c) => c.severity === 'warn')).toBe(true);
  });

  it('场景2: 复盘包包含不存在的货位应阻断导入', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);

    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    const currentConflicts = detectConflicts(initialLayout);
    const diff = computeReviewDiff(initialLayout, selection, currentConflicts);

    diff.slotDiffs.push({
      slotId: 'slot-that-does-not-exist-12345',
      changeType: 'added',
      statusA: undefined,
      statusB: 'occupied',
      shelfId: 'shelf-a',
    });

    const pkg: ReviewPackage = {
      id: 'test-pkg-conflict',
      version: '1.0.0',
      name: '包含缺失货位的复盘包',
      layoutName: initialLayout.name,
      createdAt: new Date().toISOString(),
      snapshotSelection: selection,
      snapshotA: {
        timestamp: new Date().toISOString(),
        pallets: [],
        conflicts: [],
      },
      snapshotB: {
        timestamp: new Date().toISOString(),
        pallets: [],
        conflicts: [],
      },
      diff,
      selectedSlotIds: [],
    };

    const preview = prepareReviewImportPreview(pkg, initialLayout);
    expect(preview.valid).toBe(true);
    expect(preview.canApply).toBe(false);
    expect(preview.conflicts.some((c) => c.severity === 'block')).toBe(true);
    expect(preview.conflicts.some((c) => c.message.includes('不存在'))).toBe(true);

    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      reviewState: { ...store.getState().reviewState, importPreview: preview, enabled: true },
      activeSessionId: session.id,
    });

    const initialToasts = store.getState().toasts.length;
    store.getState().applyReviewImport();

    const updatedState = store.getState();
    expect(updatedState.toasts.length).toBe(initialToasts + 1);
    expect(updatedState.toasts[initialToasts]?.message).toContain('阻断冲突');
  });

  it('场景3: 版本不兼容应发出警告', async () => {
    const { initialLayout } = await loadStoreFresh();
    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    const pkg = createTestReviewPackage(initialLayout, selection, {
      version: '2.0.0',
    });

    const preview = prepareReviewImportPreview(pkg, initialLayout);
    expect(preview.valid).toBe(true);
    expect(preview.conflicts.some((c) => c.type === 'version_incompatible')).toBe(true);
    expect(preview.applyMode).toBe('view_only');
  });
});

describe('复盘功能 - 刷新恢复', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: 刷新后复盘快照选择应恢复', async () => {
    const { useStore: store1 } = await loadStoreFresh();
    const state1 = store1.getState();

    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 2 };
    state1.setReviewSnapshotSelection(selection);
    state1.toggleReviewSlotSelection('slot-test-001');
    state1.toggleReviewSlotSelection('slot-test-002');

    const { useStore: store2 } = await loadStoreFresh();
    const state2 = store2.getState();

    expect(state2.reviewState.selection).toEqual(selection);
    expect(state2.reviewState.selectedSlotIds).toContain('slot-test-001');
    expect(state2.reviewState.selectedSlotIds).toContain('slot-test-002');
  });

  it('场景2: 刷新后调用refreshReviewFromStorage应同步最新存储状态', async () => {
    const { useStore: store } = await loadStoreFresh();
    let state = store.getState();

    const selection1: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    state.setReviewSnapshotSelection(selection1);
    state = store.getState();
    expect(state.reviewState.selection).toEqual(selection1);

    const newSelection: ReviewSnapshotSelection = { snapshotAIndex: 1, snapshotBIndex: 2 };
    saveReviewSelection(newSelection);
    saveReviewSelectedSlotIds(['slot-refreshed-001']);
    saveReviewLastImportedPackageId('pkg-refreshed-001');

    state.refreshReviewFromStorage();
    const updatedState = store.getState();

    expect(updatedState.reviewState.selection).toEqual(newSelection);
    expect(updatedState.reviewState.selectedSlotIds).toContain('slot-refreshed-001');
    expect(updatedState.reviewState.lastImportedPackageId).toBe('pkg-refreshed-001');
  });

  it('场景3: 复盘状态不应影响正常的冲突和布局状态', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const originalConflicts = [...store.getState().conflicts];
    const originalLayout = { ...store.getState().layout };

    const state = store.getState();
    state.setReviewEnabled(true);
    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    state.setReviewSnapshotSelection(selection);
    state.computeReviewDiff();
    state.toggleReviewSlotSelection(initialLayout.slots[0]?.id ?? '');

    const updatedState = store.getState();
    expect(updatedState.conflicts).toEqual(originalConflicts);
    expect(updatedState.layout).toEqual(originalLayout);
    expect(updatedState.reviewState.diff).not.toBeNull();
  });
});

describe('复盘功能 - 日志幂等', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: isDuplicateLogEntry应正确识别重复日志', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);

    const metadata = { packageId: 'pkg-001', packageName: '测试包' };
    session.logs.push({
      id: 'log-001',
      sessionId: session.id,
      action: 'apply_review',
      description: '应用复盘包',
      timestamp: new Date().toISOString(),
      metadata,
    });

    expect(isDuplicateLogEntry(session.logs, 'apply_review', metadata)).toBe(true);
    expect(isDuplicateLogEntry(session.logs, 'apply_review', { packageId: 'pkg-002' })).toBe(false);
    expect(isDuplicateLogEntry(session.logs, 'export_review_json', metadata)).toBe(false);
  });

  it('场景2: 多次生成相同对比只写入一次create_review日志', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);
    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      activeSessionId: session.id,
    });

    const state = store.getState();
    state.setReviewEnabled(true);
    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    state.setReviewSnapshotSelection(selection);

    state.computeReviewDiff();
    state.computeReviewDiff();
    state.computeReviewDiff();

    const storedSession = loadAllSessions().find((s) => s.id === session.id);
    const createReviewLogs = storedSession?.logs.filter((l) => l.action === 'create_review') ?? [];
    expect(createReviewLogs.length).toBe(1);
  });

  it('场景3: 多次导出相同复盘包只写入一次export_review_json日志', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);
    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      activeSessionId: session.id,
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'));
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'));

    const state = store.getState();
    state.setReviewEnabled(true);
    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    state.setReviewSnapshotSelection(selection);
    state.computeReviewDiff();

    state.exportReviewJSON('测试包');
    state.exportReviewJSON('测试包');
    state.exportReviewJSON('测试包');

    const storedSession = loadAllSessions().find((s) => s.id === session.id);
    const exportLogs = storedSession?.logs.filter((l) => l.action === 'export_review_json') ?? [];
    expect(exportLogs.length).toBe(1);
  });

  it('场景4: 关闭复盘后清除状态但不清除持久化选择', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    let state = store.getState();

    state.setReviewEnabled(true);
    const selection: ReviewSnapshotSelection = { snapshotAIndex: 0, snapshotBIndex: 1 };
    state.setReviewSnapshotSelection(selection);
    state.computeReviewDiff();
    state.toggleReviewSlotSelection(initialLayout.slots[0]?.id ?? 'slot-test-001');

    state = store.getState();
    expect(state.reviewState.diff).not.toBeNull();
    expect(state.reviewState.selectedSlotIds.length).toBeGreaterThan(0);

    state.setReviewEnabled(false);

    const updatedState = store.getState();
    expect(updatedState.reviewState.enabled).toBe(false);
    expect(updatedState.reviewState.diff).toBeNull();
    expect(updatedState.reviewState.selectedSlotIds).toEqual([]);

    const { useStore: store2 } = await loadStoreFresh();
    const state2 = store2.getState();
    expect(state2.reviewState.selection).toEqual(selection);
  });
});
