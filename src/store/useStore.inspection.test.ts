import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveAllSessions,
  loadAllSessions,
  saveInspectionSelectedSlotIds,
  saveInspectionDraft,
  saveInspectionLastPublished,
  saveInspectionLastImportedPackageId,
  loadInspectionState,
} from '@/utils/storage';
import type {
  ReviewSession,
  WarehouseLayout,
  InspectionTaskPackage,
  InspectionImportPreview,
} from '@/types';
import {
  createInspectionPackage,
  prepareInspectionImportPreview,
  generateInspectionRoute,
  filterSlots,
  publishInspectionPackage,
  isDuplicateInspectionLogEntry,
} from '@/utils/inspection';
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
    id: 'test-session-inspection-001',
    name: '巡检测试会话',
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

function createTestInspectionPackage(
  layout: WarehouseLayout,
  selectedSlotIds: string[],
  overrides: Partial<InspectionTaskPackage> = {}
): InspectionTaskPackage {
  const pkg = createInspectionPackage(
    layout,
    { statusFilter: 'all', shelfFilter: 'all' },
    selectedSlotIds,
    '测试巡检包',
    '用于测试的巡检包',
  );
  return { ...pkg, ...overrides };
}

describe('巡检功能 - 核心逻辑', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: 从筛选结果选择货位并生成巡检路线', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const state = store.getState();

    state.setInspectionEnabled(true);
    state.setFilters({ statusFilter: 'occupied', shelfFilter: 'all' });

    const filteredSlotIds = state.getFilteredSlotsForInspection();
    expect(filteredSlotIds.length).toBeGreaterThan(0);

    state.selectAllFilteredSlotsForInspection();
    const updatedState = store.getState();
    expect(updatedState.inspectionState.selectedSlotIds.length).toBe(filteredSlotIds.length);

    const { route, totalDistance } = generateInspectionRoute(
      updatedState.inspectionState.selectedSlotIds,
      initialLayout
    );
    expect(route.length).toBe(filteredSlotIds.length);
    expect(totalDistance).toBeGreaterThan(0);
    expect(route[0]?.order).toBe(0);
    expect(route[route.length - 1]?.order).toBe(route.length - 1);
  });

  it('场景2: 切换单个货位选择状态', async () => {
    const { useStore: store } = await loadStoreFresh();
    const state = store.getState();

    state.setInspectionEnabled(true);
    state.toggleInspectionSlotSelection('slot-001');
    expect(store.getState().inspectionState.selectedSlotIds).toContain('slot-001');

    state.toggleInspectionSlotSelection('slot-002');
    expect(store.getState().inspectionState.selectedSlotIds).toContain('slot-002');
    expect(store.getState().inspectionState.selectedSlotIds.length).toBe(2);

    state.toggleInspectionSlotSelection('slot-001');
    expect(store.getState().inspectionState.selectedSlotIds).not.toContain('slot-001');
    expect(store.getState().inspectionState.selectedSlotIds.length).toBe(1);

    state.clearInspectionSlotSelection();
    expect(store.getState().inspectionState.selectedSlotIds.length).toBe(0);
  });

  it('场景3: 创建并更新巡检草稿', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);

    const state = store.getState();
    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      activeSessionId: session.id,
    });

    state.setInspectionEnabled(true);
    state.toggleInspectionSlotSelection(initialLayout.slots[0]?.id ?? 'slot-001');
    state.toggleInspectionSlotSelection(initialLayout.slots[1]?.id ?? 'slot-002');

    state.createInspectionDraft('测试巡检草稿', '测试描述');
    let updatedState = store.getState();
    expect(updatedState.inspectionState.draft).not.toBeNull();
    expect(updatedState.inspectionState.draft?.name).toBe('测试巡检草稿');
    expect(updatedState.inspectionState.draft?.description).toBe('测试描述');
    expect(updatedState.inspectionState.draft?.status).toBe('draft');
    expect(updatedState.inspectionState.draft?.selectedSlotIds.length).toBe(2);

    state.toggleInspectionSlotSelection(initialLayout.slots[2]?.id ?? 'slot-003');
    state.updateInspectionDraft();
    updatedState = store.getState();
    expect(updatedState.inspectionState.draft?.selectedSlotIds.length).toBe(3);
    expect(updatedState.inspectionState.draft?.totalPoints).toBe(3);

    const storedSession = loadAllSessions().find((s) => s.id === session.id);
    const createLogs = storedSession?.logs.filter((l) => l.action === 'create_inspection_draft') ?? [];
    const updateLogs = storedSession?.logs.filter((l) => l.action === 'update_inspection_draft') ?? [];
    expect(createLogs.length).toBe(1);
    expect(updateLogs.length).toBe(1);
  });
});

describe('巡检功能 - 刷新恢复', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: 刷新后巡检选中项、草稿、最近发布均能恢复', async () => {
    const { useStore: store1, initialLayout } = await loadStoreFresh();
    const state1 = store1.getState();

    state1.setInspectionEnabled(true);
    state1.toggleInspectionSlotSelection('slot-inspect-001');
    state1.toggleInspectionSlotSelection('slot-inspect-002');

    const selectedSlotIds = [initialLayout.slots[0]?.id ?? 'slot-001', initialLayout.slots[1]?.id ?? 'slot-002'];
    const draftPkg = createTestInspectionPackage(initialLayout, selectedSlotIds, {
      name: '待发布草稿',
      status: 'draft',
    });
    const publishedPkg = createTestInspectionPackage(initialLayout, selectedSlotIds, {
      name: '已发布任务',
      status: 'published',
      id: 'ins-published-001',
    });

    saveInspectionDraft(draftPkg);
    saveInspectionLastPublished(publishedPkg);
    saveInspectionLastImportedPackageId('ins-published-001');

    const { useStore: store2 } = await loadStoreFresh();
    const state2 = store2.getState();

    expect(state2.inspectionState.selectedSlotIds).toContain('slot-inspect-001');
    expect(state2.inspectionState.selectedSlotIds).toContain('slot-inspect-002');
    expect(state2.inspectionState.draft?.id).toBe(draftPkg.id);
    expect(state2.inspectionState.draft?.name).toBe('待发布草稿');
    expect(state2.inspectionState.lastPublished?.id).toBe('ins-published-001');
    expect(state2.inspectionState.lastPublished?.name).toBe('已发布任务');
    expect(state2.inspectionState.lastImportedPackageId).toBe('ins-published-001');
    expect(state2.inspectionState.importPreview).toBeNull();
    expect(state2.inspectionState.undoSnapshot).toBeNull();
  });

  it('场景2: 刷新后调用 refreshInspectionFromStorage 应同步最新存储状态', async () => {
    const { useStore: store } = await loadStoreFresh();
    let state = store.getState();

    const initialSlots = ['slot-original-001'];
    state.setInspectionEnabled(true);
    initialSlots.forEach((id) => state.toggleInspectionSlotSelection(id));
    state = store.getState();
    expect(state.inspectionState.selectedSlotIds).toEqual(initialSlots);

    const newSlots = ['slot-refreshed-001', 'slot-refreshed-002'];
    const newDraft = createTestInspectionPackage(store.getState().layout, newSlots, {
      name: '刷新后的草稿',
    });
    const newPublished = createTestInspectionPackage(store.getState().layout, newSlots, {
      name: '刷新后的发布',
      id: 'ins-refreshed-001',
      status: 'published',
    });

    saveInspectionSelectedSlotIds(newSlots);
    saveInspectionDraft(newDraft);
    saveInspectionLastPublished(newPublished);
    saveInspectionLastImportedPackageId('ins-refreshed-001');

    state.refreshInspectionFromStorage();
    const refreshed = store.getState();

    expect(refreshed.inspectionState.selectedSlotIds).toEqual(newSlots);
    expect(refreshed.inspectionState.draft?.name).toBe('刷新后的草稿');
    expect(refreshed.inspectionState.lastPublished?.name).toBe('刷新后的发布');
    expect(refreshed.inspectionState.lastImportedPackageId).toBe('ins-refreshed-001');
  });

  it('场景3: 巡检状态不应影响正常的冲突和布局状态', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const originalConflicts = [...store.getState().conflicts];
    const originalLayout = { ...store.getState().layout };

    const state = store.getState();
    state.setInspectionEnabled(true);
    state.toggleInspectionSlotSelection(initialLayout.slots[0]?.id ?? '');
    state.createInspectionDraft('测试草稿');
    state.publishInspection();

    const updatedState = store.getState();
    expect(updatedState.conflicts).toEqual(originalConflicts);
    expect(updatedState.layout).toEqual(originalLayout);
    expect(updatedState.inspectionState.lastPublished).not.toBeNull();
  });
});

describe('巡检功能 - 导入导出与冲突处理', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: 导出巡检包再导入，冲突时应正确提示', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);

    const state = store.getState();
    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      activeSessionId: session.id,
    });

    state.setInspectionEnabled(true);
    const selectedSlotIds = [initialLayout.slots[0]?.id ?? 'slot-001'];
    state.toggleInspectionSlotSelection(selectedSlotIds[0]);
    state.createInspectionDraft('导出测试');
    state.publishInspection();

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'));
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'));

    let exportedJSON = '';
    vi.spyOn(JSON, 'stringify').mockImplementationOnce((data) => {
      exportedJSON = JSON.stringify(data);
      return exportedJSON;
    });

    store.getState().exportInspectionJSON();
    expect(exportedJSON).not.toBe('');

    const parsedPkg = JSON.parse(exportedJSON) as InspectionTaskPackage;
    expect(parsedPkg.name).toBe('导出测试');

    const existingDraft = store.getState().inspectionState.draft;
    const existingPublished = store.getState().inspectionState.lastPublished;
    const preview = prepareInspectionImportPreview(parsedPkg, initialLayout, existingDraft, existingPublished);

    expect(preview.valid).toBe(true);
    expect(preview.conflicts.some((c) => c.type === 'id_duplicate')).toBe(true);
    expect(preview.applyMode).toBe('overwrite');
    expect(preview.canApply).toBe(true);

    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      inspectionState: { ...store.getState().inspectionState, importPreview: preview },
    });

    store.getState().applyInspectionImport('overwrite');
    const updatedState = store.getState();
    expect(updatedState.inspectionState.lastPublished?.id).toBe(parsedPkg.id);
    expect(updatedState.inspectionState.undoSnapshot).not.toBeNull();
  });

  it('场景2: 导入ID与现有草稿冲突时，给出覆盖或只读选项', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();

    const state = store.getState();
    const selectedSlotIds = [initialLayout.slots[0]?.id ?? 'slot-001'];
    const existingDraft = createTestInspectionPackage(initialLayout, selectedSlotIds, {
      id: 'ins-conflict-001',
      name: '现有草稿',
      status: 'draft',
    });

    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      inspectionState: { ...state.inspectionState, draft: existingDraft },
    });
    saveInspectionDraft(existingDraft);

    const importedPkg = createTestInspectionPackage(initialLayout, selectedSlotIds, {
      id: 'ins-conflict-001',
      name: '导入的冲突包',
      status: 'draft',
    });

    const preview = prepareInspectionImportPreview(importedPkg, initialLayout, existingDraft, null);
    expect(preview.valid).toBe(true);
    expect(preview.canApply).toBe(true);
    expect(preview.applyMode).toBe('overwrite');
    expect(preview.conflicts.some((c) => c.type === 'id_duplicate')).toBe(true);
    expect(preview.conflicts.some((c) => c.message.includes('覆盖现有草稿'))).toBe(true);

    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      inspectionState: { ...store.getState().inspectionState, importPreview: preview },
    });

    store.getState().applyInspectionImport('view_only');
    let updatedState = store.getState();
    expect(updatedState.inspectionState.draft?.name).toBe('现有草稿');

    store.getState().cancelInspectionImport();
    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      inspectionState: { ...store.getState().inspectionState, importPreview: preview },
    });

    store.getState().applyInspectionImport('overwrite');
    updatedState = store.getState();
    expect(updatedState.inspectionState.draft?.name).toBe('导入的冲突包');
  });

  it('场景3: 导入包含不存在货位的巡检包应阻断导入', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);

    const pkg = createTestInspectionPackage(initialLayout, ['slot-that-does-not-exist-12345'], {
      name: '包含缺失货位的巡检包',
    });

    const preview = prepareInspectionImportPreview(pkg, initialLayout, null, null);
    expect(preview.valid).toBe(true);
    expect(preview.canApply).toBe(false);
    expect(preview.conflicts.some((c) => c.severity === 'block')).toBe(true);
    expect(preview.conflicts.some((c) => c.message.includes('不存在'))).toBe(true);

    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      inspectionState: { ...store.getState().inspectionState, importPreview: preview, enabled: true },
      activeSessionId: session.id,
    });

    const initialToasts = store.getState().toasts.length;
    store.getState().applyInspectionImport('overwrite');

    const updatedState = store.getState();
    expect(updatedState.toasts.length).toBe(initialToasts + 1);
    expect(updatedState.toasts[initialToasts]?.message).toContain('阻断冲突');
  });

  it('场景4: 布局名称不匹配应降级为警告', async () => {
    const { initialLayout } = await loadStoreFresh();
    const selectedSlotIds = [initialLayout.slots[0]?.id ?? 'slot-001'];
    const pkg = createTestInspectionPackage(initialLayout, selectedSlotIds, {
      layoutName: '完全不同的布局名称',
    });

    const preview = prepareInspectionImportPreview(pkg, initialLayout, null, null);
    expect(preview.valid).toBe(true);
    expect(preview.canApply).toBe(true);
    expect(preview.conflicts.some((c) => c.type === 'layout_mismatch')).toBe(true);
    expect(preview.conflicts.some((c) => c.severity === 'warn')).toBe(true);
  });
});

describe('巡检功能 - 发布与撤销链路', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: 发布巡检任务后写入操作日志，状态正确更新', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);

    const state = store.getState();
    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      activeSessionId: session.id,
    });

    state.setInspectionEnabled(true);
    state.setFilters({ statusFilter: 'conflict', shelfFilter: 'all' });
    const selectedSlotIds = [initialLayout.slots[0]?.id ?? 'slot-001'];
    state.toggleInspectionSlotSelection(selectedSlotIds[0]);
    state.createInspectionDraft('发布测试');

    const beforePublish = store.getState();
    expect(beforePublish.inspectionState.draft).not.toBeNull();
    expect(beforePublish.inspectionState.draft?.status).toBe('draft');
    expect(beforePublish.inspectionState.lastPublished).toBeNull();

    state.publishInspection();
    const afterPublish = store.getState();
    expect(afterPublish.inspectionState.draft).toBeNull();
    expect(afterPublish.inspectionState.lastPublished).not.toBeNull();
    expect(afterPublish.inspectionState.lastPublished?.status).toBe('published');
    expect(afterPublish.inspectionState.lastPublished?.publishedAt).not.toBeUndefined();
    expect(afterPublish.inspectionState.undoSnapshot).not.toBeNull();
    expect(afterPublish.inspectionState.undoSnapshot?.previousDraft).not.toBeNull();

    const storedSession = loadAllSessions().find((s) => s.id === session.id);
    const publishLogs = storedSession?.logs.filter((l) => l.action === 'publish_inspection') ?? [];
    expect(publishLogs.length).toBe(1);
    expect(publishLogs[0]?.description).toContain('发布巡检任务');
  });

  it('场景2: 撤销发布后界面状态和持久化数据一并回退', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);

    let state = store.getState();
    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      activeSessionId: session.id,
    });

    state.setInspectionEnabled(true);
    const originalFilters = { statusFilter: 'warning' as const, shelfFilter: 'all' as const };
    state.setFilters(originalFilters);
    const originalSelectedSlots = [initialLayout.slots[0]?.id ?? 'slot-001', initialLayout.slots[1]?.id ?? 'slot-002'];
    originalSelectedSlots.forEach((id) => state.toggleInspectionSlotSelection(id));
    state.createInspectionDraft('撤销测试');

    const beforePublishDraft = { ...store.getState().inspectionState.draft! };
    state.publishInspection();
    const afterPublish = store.getState();
    expect(afterPublish.inspectionState.lastPublished).not.toBeNull();
    expect(afterPublish.inspectionState.draft).toBeNull();

    state.undoPublishInspection();
    const afterUndo = store.getState();

    expect(afterUndo.inspectionState.draft?.id).toBe(beforePublishDraft.id);
    expect(afterUndo.inspectionState.draft?.status).toBe('draft');
    expect(afterUndo.inspectionState.lastPublished).toBeNull();
    expect(afterUndo.inspectionState.selectedSlotIds).toEqual(originalSelectedSlots);
    expect(afterUndo.filters).toEqual(originalFilters);
    expect(afterUndo.inspectionState.undoSnapshot).toBeNull();

    const persisted = loadInspectionState();
    expect(persisted.draft?.id).toBe(beforePublishDraft.id);
    expect(persisted.draft?.status).toBe('draft');
    expect(persisted.lastPublished).toBeNull();
    expect(persisted.selectedSlotIds).toEqual(originalSelectedSlots);

    const storedSession = loadAllSessions().find((s) => s.id === session.id);
    const undoLogs = storedSession?.logs.filter((l) => l.action === 'undo_publish_inspection') ?? [];
    expect(undoLogs.length).toBe(1);
  });

  it('场景3: 撤销导入后状态回退完整链路', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();

    let state = store.getState();
    state.setInspectionEnabled(true);
    const beforeSelection = ['slot-native-001', 'slot-native-002'];
    beforeSelection.forEach((id) => state.toggleInspectionSlotSelection(id));
    state.createInspectionDraft('原有草稿');
    state = store.getState();
    const beforeDraft = state.inspectionState.draft;
    const beforeSelectedIds = [...state.inspectionState.selectedSlotIds];

    const importPkg = createTestInspectionPackage(initialLayout, [initialLayout.slots[2]?.id ?? 'slot-003'], {
      name: '导入的巡检包',
      status: 'published',
    });
    const preview = prepareInspectionImportPreview(importPkg, initialLayout, beforeDraft, null);

    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      inspectionState: { ...state.inspectionState, importPreview: preview },
    });

    store.getState().applyInspectionImport('overwrite');
    let updatedState = store.getState();
    expect(updatedState.inspectionState.lastPublished?.id).toBe(importPkg.id);
    expect(updatedState.inspectionState.undoSnapshot).not.toBeNull();
    expect(updatedState.inspectionState.undoSnapshot?.previousDraft?.id).toBe(beforeDraft?.id);

    store.getState().undoPublishInspection();
    updatedState = store.getState();

    expect(updatedState.inspectionState.draft?.id).toBe(beforeDraft?.id);
    expect(updatedState.inspectionState.selectedSlotIds).toEqual(beforeSelectedIds);
    expect(updatedState.inspectionState.lastPublished).toBeNull();
    expect(updatedState.inspectionState.undoSnapshot).toBeNull();

    const { useStore: store2 } = await loadStoreFresh();
    const state2 = store2.getState();
    expect(state2.inspectionState.draft?.id).toBe(beforeDraft?.id);
    expect(state2.inspectionState.selectedSlotIds).toEqual(beforeSelectedIds);
    expect(state2.inspectionState.lastPublished).toBeNull();
  });

  it('场景4: 没有可撤销操作时应给出提示', async () => {
    const { useStore: store } = await loadStoreFresh();
    const state = store.getState();

    state.setInspectionEnabled(true);
    expect(state.inspectionState.undoSnapshot).toBeNull();

    const initialToasts = state.toasts.length;
    state.undoPublishInspection();

    const updatedState = store.getState();
    expect(updatedState.toasts.length).toBe(initialToasts + 1);
    expect(updatedState.toasts[initialToasts]?.message).toContain('没有可撤销的发布操作');
  });
});

describe('巡检功能 - 工具函数', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('场景1: generateInspectionRoute 空输入返回空结果', async () => {
    const { initialLayout } = await loadStoreFresh();
    const result = generateInspectionRoute([], initialLayout);
    expect(result.route).toEqual([]);
    expect(result.totalDistance).toBe(0);
  });

  it('场景2: filterSlots 正确应用筛选条件', async () => {
    const { initialLayout } = await loadStoreFresh();

    const allSlots = filterSlots(initialLayout, { statusFilter: 'all', shelfFilter: 'all' });
    expect(allSlots.length).toBe(initialLayout.slots.length);

    const occupiedSlots = filterSlots(initialLayout, { statusFilter: 'occupied', shelfFilter: 'all' });
    expect(occupiedSlots.length).toBeLessThan(initialLayout.slots.length);
    expect(occupiedSlots.every((s) => s.status === 'occupied')).toBe(true);
  });

  it('场景3: publishInspectionPackage 正确更新状态', async () => {
    const { initialLayout } = await loadStoreFresh();
    const pkg = createTestInspectionPackage(initialLayout, [initialLayout.slots[0]?.id ?? 'slot-001']);
    expect(pkg.status).toBe('draft');
    expect(pkg.publishedAt).toBeUndefined();

    await new Promise((resolve) => setTimeout(resolve, 2));
    const published = publishInspectionPackage(pkg);
    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeUndefined();
    expect(published.updatedAt).not.toBe(pkg.updatedAt);
  });

  it('场景4: isDuplicateInspectionLogEntry 正确识别重复日志', async () => {
    const { initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);

    const metadata = { packageId: 'pkg-001', packageName: '测试包' };
    session.logs.push({
      id: 'log-001',
      sessionId: session.id,
      action: 'publish_inspection',
      description: '发布巡检任务',
      timestamp: new Date().toISOString(),
      metadata,
    });

    expect(isDuplicateInspectionLogEntry(session.logs, 'publish_inspection', metadata)).toBe(true);
    expect(isDuplicateInspectionLogEntry(session.logs, 'publish_inspection', { packageId: 'pkg-002' })).toBe(false);
    expect(isDuplicateInspectionLogEntry(session.logs, 'create_inspection_draft', metadata)).toBe(false);
  });
});

describe('巡检功能 - 导入后刷新恢复', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('回归: 导入巡检包后重建 store（模拟刷新），draft/lastPublished/selectedSlotIds 均完整恢复', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();
    const session = await createTestSession(initialLayout);
    saveAllSessions([session]);

    let state = store.getState();
    state.setInspectionEnabled(true);
    state.toggleInspectionSlotSelection('slot-before-import-001');
    state = store.getState();

    const selectedSlotIds = [initialLayout.slots[0]?.id ?? 'slot-001', initialLayout.slots[1]?.id ?? 'slot-002'];
    const pkg = createTestInspectionPackage(initialLayout, selectedSlotIds, {
      status: 'published',
      name: '导入测试包',
    });
    const preview = prepareInspectionImportPreview(pkg, initialLayout, state.inspectionState.draft, state.inspectionState.lastPublished);

    (store as unknown as { setState: (p: Partial<AppState>) => void }).setState({
      inspectionState: { ...state.inspectionState, importPreview: preview },
      activeSessionId: session.id,
    });

    store.getState().applyInspectionImport('overwrite');
    state = store.getState();

    expect(state.inspectionState.lastPublished?.id).toBe(pkg.id);
    expect(state.inspectionState.selectedSlotIds).toEqual(pkg.selectedSlotIds);
    expect(state.inspectionState.lastImportedPackageId).toBe(pkg.id);
    expect(state.inspectionState.importPreview).toBeNull();
    expect(state.inspectionState.undoSnapshot).not.toBeNull();

    const { useStore: store2 } = await loadStoreFresh();
    const state2 = store2.getState();

    expect(state2.inspectionState.lastPublished?.id).toBe(pkg.id);
    expect(state2.inspectionState.lastPublished?.name).toBe('导入测试包');
    expect(state2.inspectionState.selectedSlotIds).toEqual(pkg.selectedSlotIds);
    expect(state2.inspectionState.lastImportedPackageId).toBe(pkg.id);
    expect(state2.inspectionState.importPreview).toBeNull();
    expect(state2.inspectionState.undoSnapshot).toBeNull();
  });

  it('回归: 撤销发布后刷新，状态正确回退', async () => {
    const { useStore: store, initialLayout } = await loadStoreFresh();

    let state = store.getState();
    state.setInspectionEnabled(true);
    const originalSlots = [initialLayout.slots[0]?.id ?? 'slot-001'];
    originalSlots.forEach((id) => state.toggleInspectionSlotSelection(id));
    state.createInspectionDraft('撤销后刷新测试');
    state = store.getState();
    const beforeDraft = state.inspectionState.draft;

    state.publishInspection();
    state.undoPublishInspection();
    state = store.getState();

    expect(state.inspectionState.draft?.id).toBe(beforeDraft?.id);
    expect(state.inspectionState.lastPublished).toBeNull();

    const { useStore: store2 } = await loadStoreFresh();
    const state2 = store2.getState();

    expect(state2.inspectionState.draft?.id).toBe(beforeDraft?.id);
    expect(state2.inspectionState.draft?.status).toBe('draft');
    expect(state2.inspectionState.lastPublished).toBeNull();
    expect(state2.inspectionState.selectedSlotIds).toEqual(originalSlots);
  });
});
