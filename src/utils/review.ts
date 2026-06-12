import type {
  WarehouseLayout,
  Slot,
  Pallet,
  Conflict,
  ReviewSnapshotSelection,
  ReviewDiff,
  ReviewDiffSummary,
  SlotDiffItem,
  PalletDiffItem,
  ConfirmationDiffItem,
  ChangeType,
  ReviewPackage,
  ReviewImportPreview,
  ReviewImportConflict,
  ReviewLogEntry,
} from '@/types';
import { detectConflicts } from './conflict';
import { formatTimestamp } from './export';

function generateReviewId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `rv-${Date.now().toString(36)}-${rand}`;
}

function getChangeType<T>(a: T | undefined, b: T | undefined): ChangeType {
  if (a === undefined && b !== undefined) return 'added';
  if (a !== undefined && b === undefined) return 'removed';
  if (a === undefined && b === undefined) return 'unchanged';
  return JSON.stringify(a) === JSON.stringify(b) ? 'unchanged' : 'modified';
}

function getSlotsFromPallets(pallets: Pallet[], slots: Slot[]): Map<string, Slot> {
  const slotMap = new Map<string, Slot>();
  slots.forEach((s) => slotMap.set(s.id, s));
  pallets.forEach((p) => {
    if (!slotMap.has(p.slotId)) {
      slotMap.set(p.slotId, {
        id: p.slotId,
        shelfId: 'unknown',
        row: 0,
        column: 0,
        level: 0,
        status: 'empty',
      });
    }
  });
  return slotMap;
}

function inferSlotStatus(pallets: Pallet[], slotId: string, conflicts: Conflict[]): 'empty' | 'occupied' | 'conflict' | 'warning' {
  const slotPallets = pallets.filter((p) => p.slotId === slotId);
  const hasConflict = conflicts.some(
    (c) => c.type === 'multi_pallet_slot' && c.relatedIds.some((rid) => slotPallets.some((sp) => sp.id === rid))
  );
  if (hasConflict) return 'conflict';
  if (slotPallets.length === 0) return 'empty';
  const hasDamaged = slotPallets.some((p) => p.status === 'damaged' || p.status === 'expired');
  if (hasDamaged) return 'warning';
  return 'occupied';
}

export function computeReviewDiff(
  layout: WarehouseLayout,
  selection: ReviewSnapshotSelection,
  currentConflicts: Conflict[]
): ReviewDiff {
  const { snapshotAIndex, snapshotBIndex } = selection;
  const records = layout.inventoryRecords;

  const getSnapshotData = (index: number) => {
    if (index === -1 || index >= records.length) {
      return {
        timestamp: new Date().toISOString(),
        note: '当前状态',
        pallets: layout.pallets,
        conflicts: currentConflicts,
      };
    }
    const record = records[index];
    const conflicts = detectConflicts({
      ...layout,
      pallets: record.pallets,
    });
    return {
      timestamp: record.timestamp,
      note: record.note,
      pallets: record.pallets,
      conflicts,
    };
  };

  const snapshotA = getSnapshotData(snapshotAIndex);
  const snapshotB = getSnapshotData(snapshotBIndex);

  const allSlotIds = new Set<string>();
  const slotMapA = getSlotsFromPallets(snapshotA.pallets, layout.slots);
  const slotMapB = getSlotsFromPallets(snapshotB.pallets, layout.slots);
  slotMapA.forEach((_, id) => allSlotIds.add(id));
  slotMapB.forEach((_, id) => allSlotIds.add(id));

  const slotDiffs: SlotDiffItem[] = [];
  const summary: ReviewDiffSummary = {
    slotChanges: { added: 0, removed: 0, modified: 0, unchanged: 0 },
    palletChanges: { added: 0, removed: 0, modified: 0, unchanged: 0 },
    confirmationChanges: { added: 0, removed: 0, modified: 0, unchanged: 0 },
  };

  allSlotIds.forEach((slotId) => {
    const slotA = slotMapA.get(slotId);
    const slotB = slotMapB.get(slotId);
    const statusA = slotA ? inferSlotStatus(snapshotA.pallets, slotId, snapshotA.conflicts) : undefined;
    const statusB = slotB ? inferSlotStatus(snapshotB.pallets, slotId, snapshotB.conflicts) : undefined;
    const changeType = getChangeType(statusA, statusB);

    summary.slotChanges[changeType]++;

    slotDiffs.push({
      slotId,
      changeType,
      statusA,
      statusB,
      shelfId: slotA?.shelfId || slotB?.shelfId || 'unknown',
    });
  });

  const allPalletIds = new Set<string>();
  const palletMapA = new Map<string, Pallet>();
  const palletMapB = new Map<string, Pallet>();
  snapshotA.pallets.forEach((p) => {
    palletMapA.set(p.id, p);
    allPalletIds.add(p.id);
  });
  snapshotB.pallets.forEach((p) => {
    palletMapB.set(p.id, p);
    allPalletIds.add(p.id);
  });

  const palletDiffs: PalletDiffItem[] = [];
  allPalletIds.forEach((palletId) => {
    const palletA = palletMapA.get(palletId);
    const palletB = palletMapB.get(palletId);
    const changeType = getChangeType(palletA, palletB);

    summary.palletChanges[changeType]++;

    palletDiffs.push({
      palletId,
      changeType,
      palletNo: palletA?.palletNo || palletB?.palletNo || 'unknown',
      statusA: palletA?.status,
      statusB: palletB?.status,
      slotIdA: palletA?.slotId,
      slotIdB: palletB?.slotId,
      sku: palletA?.sku || palletB?.sku,
      quantity: palletA?.quantity || palletB?.quantity,
    });
  });

  const allConflictIds = new Set<string>();
  const conflictMapA = new Map<string, Conflict>();
  const conflictMapB = new Map<string, Conflict>();
  snapshotA.conflicts.forEach((c) => {
    conflictMapA.set(c.id, c);
    allConflictIds.add(c.id);
  });
  snapshotB.conflicts.forEach((c) => {
    conflictMapB.set(c.id, c);
    allConflictIds.add(c.id);
  });

  const confirmationDiffs: ConfirmationDiffItem[] = [];
  allConflictIds.forEach((conflictId) => {
    const conflictA = conflictMapA.get(conflictId);
    const conflictB = conflictMapB.get(conflictId);
    const confirmedA = conflictA?.confirmed || false;
    const confirmedB = conflictB?.confirmed || false;
    const changeType = getChangeType(
      conflictA ? { ...conflictA } : undefined,
      conflictB ? { ...conflictB } : undefined
    );

    summary.confirmationChanges[changeType]++;

    confirmationDiffs.push({
      conflictId,
      changeType,
      description: conflictA?.description || conflictB?.description || 'unknown',
      type: conflictA?.type || conflictB?.type || 'damaged_layout',
      confirmedA,
      confirmedB,
      confirmedAtA: conflictA?.confirmedAt,
      confirmedAtB: conflictB?.confirmedAt,
      confirmedByA: conflictA?.confirmedBy,
      confirmedByB: conflictB?.confirmedBy,
    });
  });

  return {
    selection,
    summary,
    slotDiffs,
    palletDiffs,
    confirmationDiffs,
    createdAt: new Date().toISOString(),
  };
}

export function createReviewPackage(
  layout: WarehouseLayout,
  selection: ReviewSnapshotSelection,
  diff: ReviewDiff,
  selectedSlotIds: string[],
  name?: string,
  description?: string
): ReviewPackage {
  const records = layout.inventoryRecords;
  const currentConflicts = detectConflicts(layout);

  const getSnapshotData = (index: number) => {
    if (index === -1 || index >= records.length) {
      return {
        timestamp: new Date().toISOString(),
        note: '当前状态',
        pallets: [...layout.pallets],
        conflicts: [...currentConflicts],
      };
    }
    const record = records[index];
    const conflicts = detectConflicts({
      ...layout,
      pallets: record.pallets,
    });
    return {
      timestamp: record.timestamp,
      note: record.note,
      pallets: [...record.pallets],
      conflicts,
    };
  };

  const snapshotA = getSnapshotData(selection.snapshotAIndex);
  const snapshotB = getSnapshotData(selection.snapshotBIndex);

  return {
    id: generateReviewId(),
    version: '1.0.0',
    name: name || `复盘_${formatTimestamp(new Date())}`,
    description,
    layoutName: layout.name,
    createdAt: new Date().toISOString(),
    snapshotSelection: selection,
    snapshotA,
    snapshotB,
    diff,
    selectedSlotIds: [...selectedSlotIds],
    metadata: {
      exportedAt: new Date().toISOString(),
      layoutVersion: layout.version,
      recordCount: records.length,
    },
  };
}

export function exportReviewToJSON(pkg: ReviewPackage): string {
  return JSON.stringify(pkg, null, 2);
}

export function exportReviewToCSV(pkg: ReviewPackage): {
  summaryCSV: string;
  slotsCSV: string;
  palletsCSV: string;
  confirmationsCSV: string;
} {
  const summaryHeaders = ['项目', '新增', '移除', '修改', '无变化'];
  const summaryRows = [
    ['货位状态', pkg.diff.summary.slotChanges.added, pkg.diff.summary.slotChanges.removed, pkg.diff.summary.slotChanges.modified, pkg.diff.summary.slotChanges.unchanged],
    ['托盘状态', pkg.diff.summary.palletChanges.added, pkg.diff.summary.palletChanges.removed, pkg.diff.summary.palletChanges.modified, pkg.diff.summary.palletChanges.unchanged],
    ['确认记录', pkg.diff.summary.confirmationChanges.added, pkg.diff.summary.confirmationChanges.removed, pkg.diff.summary.confirmationChanges.modified, pkg.diff.summary.confirmationChanges.unchanged],
  ];

  const slotsHeaders = ['货位ID', '变化类型', '货架ID', '快照A状态', '快照B状态'];
  const slotsRows = pkg.diff.slotDiffs.map((d) => [
    d.slotId,
    getChangeTypeLabel(d.changeType),
    d.shelfId,
    getSlotStatusLabel(d.statusA),
    getSlotStatusLabel(d.statusB),
  ]);

  const palletsHeaders = ['托盘ID', '托盘号', '变化类型', 'SKU', '数量', '快照A状态', '快照B状态', '快照A货位', '快照B货位'];
  const palletsRows = pkg.diff.palletDiffs.map((d) => [
    d.palletId,
    d.palletNo,
    getChangeTypeLabel(d.changeType),
    d.sku || '-',
    d.quantity !== undefined ? d.quantity : '-',
    getPalletStatusLabel(d.statusA),
    getPalletStatusLabel(d.statusB),
    d.slotIdA || '-',
    d.slotIdB || '-',
  ]);

  const confirmationsHeaders = ['冲突ID', '类型', '描述', '变化类型', '快照A确认状态', '快照B确认状态', '快照A确认时间', '快照B确认时间'];
  const confirmationsRows = pkg.diff.confirmationDiffs.map((d) => [
    d.conflictId,
    d.type,
    d.description,
    getChangeTypeLabel(d.changeType),
    d.confirmedA ? '已确认' : '未确认',
    d.confirmedB ? '已确认' : '未确认',
    d.confirmedAtA ? formatTimestamp(d.confirmedAtA) : '-',
    d.confirmedAtB ? formatTimestamp(d.confirmedAtB) : '-',
  ]);

  const toCSV = (headers: string[], rows: (string | number)[][]) => {
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    return '\uFEFF' + csvContent;
  };

  return {
    summaryCSV: toCSV(summaryHeaders, summaryRows),
    slotsCSV: toCSV(slotsHeaders, slotsRows),
    palletsCSV: toCSV(palletsHeaders, palletsRows),
    confirmationsCSV: toCSV(confirmationsHeaders, confirmationsRows),
  };
}

function getChangeTypeLabel(type: ChangeType): string {
  const labels: Record<ChangeType, string> = {
    added: '新增',
    removed: '移除',
    modified: '修改',
    unchanged: '无变化',
  };
  return labels[type];
}

function getSlotStatusLabel(status?: string): string {
  if (!status) return '-';
  const labels: Record<string, string> = {
    empty: '空置',
    occupied: '已占用',
    conflict: '冲突',
    warning: '预警',
  };
  return labels[status] || status;
}

function getPalletStatusLabel(status?: string): string {
  if (!status) return '-';
  const labels: Record<string, string> = {
    normal: '正常',
    damaged: '破损',
    expired: '过期',
    unknown: '未知',
  };
  return labels[status] || status;
}

export function validateReviewPackage(data: unknown): { valid: boolean; errors: string[]; pkg?: ReviewPackage } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['复盘包格式错误：不是有效的JSON对象'] };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.id || typeof obj.id !== 'string') {
    errors.push('缺少或无效的 id 字段');
  }
  if (!obj.version || typeof obj.version !== 'string') {
    errors.push('缺少或无效的 version 字段');
  }
  if (!obj.name || typeof obj.name !== 'string') {
    errors.push('缺少或无效的 name 字段');
  }
  if (!obj.layoutName || typeof obj.layoutName !== 'string') {
    errors.push('缺少或无效的 layoutName 字段');
  }
  if (!obj.createdAt || typeof obj.createdAt !== 'string') {
    errors.push('缺少或无效的 createdAt 字段');
  }
  if (!obj.snapshotSelection || typeof obj.snapshotSelection !== 'object') {
    errors.push('缺少或无效的 snapshotSelection 字段');
  } else {
    const sel = obj.snapshotSelection as Record<string, unknown>;
    if (typeof sel.snapshotAIndex !== 'number') {
      errors.push('snapshotSelection.snapshotAIndex 必须为数字');
    }
    if (typeof sel.snapshotBIndex !== 'number') {
      errors.push('snapshotSelection.snapshotBIndex 必须为数字');
    }
  }
  if (!obj.diff || typeof obj.diff !== 'object') {
    errors.push('缺少或无效的 diff 字段');
  }
  if (!Array.isArray(obj.selectedSlotIds)) {
    errors.push('缺少或无效的 selectedSlotIds 数组');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], pkg: data as ReviewPackage };
}

export function checkReviewImportConflicts(
  pkg: ReviewPackage,
  currentLayout: WarehouseLayout
): ReviewImportConflict[] {
  const conflicts: ReviewImportConflict[] = [];

  if (pkg.layoutName !== currentLayout.name) {
    conflicts.push({
      type: 'layout_mismatch',
      severity: 'warn',
      message: `复盘包所属布局（${pkg.layoutName}）与当前布局（${currentLayout.name}）名称不匹配`,
      details: [`复盘包布局: ${pkg.layoutName}`, `当前布局: ${currentLayout.name}`],
    });
  }

  const pkgSlotIds = new Set<string>();
  pkg.diff.slotDiffs.forEach((d) => pkgSlotIds.add(d.slotId));
  const currentSlotIds = new Set(currentLayout.slots.map((s) => s.id));
  const missingSlots = Array.from(pkgSlotIds).filter((id) => !currentSlotIds.has(id));

  if (missingSlots.length > 0) {
    conflicts.push({
      type: 'layout_mismatch',
      severity: 'block',
      message: `复盘包中 ${missingSlots.length} 个货位在当前布局中不存在`,
      details: missingSlots.slice(0, 10).map((id) => `缺失货位: ${id}`),
    });
  }

  if (pkg.version !== '1.0.0') {
    conflicts.push({
      type: 'version_incompatible',
      severity: 'warn',
      message: `复盘包版本（${pkg.version}）可能与当前系统不兼容`,
    });
  }

  return conflicts;
}

export function prepareReviewImportPreview(
  data: unknown,
  currentLayout: WarehouseLayout
): ReviewImportPreview {
  try {
    const validation = validateReviewPackage(data);

    if (!validation.valid || !validation.pkg) {
      return {
        valid: false,
        package: null,
        conflicts: [],
        validationErrors: validation.errors,
        isParseError: false,
        canApply: false,
        applyMode: 'view_only',
      };
    }

    const pkg = validation.pkg;
    const conflicts = checkReviewImportConflicts(pkg, currentLayout);

    const hasBlockConflict = conflicts.some((c) => c.severity === 'block');
    const hasWarnConflict = conflicts.some((c) => c.severity === 'warn');

    return {
      valid: true,
      package: pkg,
      conflicts,
      validationErrors: [],
      isParseError: false,
      canApply: !hasBlockConflict,
      applyMode: hasWarnConflict || hasBlockConflict ? 'view_only' : 'full',
    };
  } catch {
    return {
      valid: false,
      package: null,
      conflicts: [],
      validationErrors: ['JSON 解析失败，请检查文件格式'],
      isParseError: true,
      canApply: false,
      applyMode: 'view_only',
    };
  }
}

export function isDuplicateLogEntry(
  logs: ReviewLogEntry[],
  action: string,
  metadata?: Record<string, unknown>
): boolean {
  const recentLogs = logs.slice(-10);
  return recentLogs.some((log) => {
    if (log.action !== action) return false;
    if (!metadata || !log.metadata) return false;

    const packageId = metadata.packageId as string;
    const logPackageId = log.metadata.packageId as string;

    if (packageId && logPackageId && packageId === logPackageId) {
      return true;
    }

    const snapshotSelection = metadata.snapshotSelection;
    const logSnapshotSelection = log.metadata.snapshotSelection;

    if (
      snapshotSelection &&
      logSnapshotSelection &&
      JSON.stringify(snapshotSelection) === JSON.stringify(logSnapshotSelection)
    ) {
      return true;
    }

    return JSON.stringify(metadata) === JSON.stringify(log.metadata);
  });
}

export function downloadJSON(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
