import type {
  WarehouseLayout,
  Slot,
  Shelf,
  Filters,
  InspectionRoutePoint,
  InspectionTaskPackage,
  InspectionImportConflict,
  InspectionImportPreview,
} from '@/types';
import { formatTimestamp } from './export';

function generateInspectionId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `ins-${Date.now().toString(36)}-${rand}`;
}

function getSlotPosition(slot: Slot, shelf: Shelf | undefined): { x: number; y: number; z: number } {
  const shelfX = shelf?.position.x ?? 0;
  const shelfZ = shelf?.position.z ?? 0;
  return {
    x: shelfX + slot.column,
    y: slot.level,
    z: shelfZ + slot.row,
  };
}

function calculateDistance(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number }
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function generateInspectionRoute(
  selectedSlotIds: string[],
  layout: WarehouseLayout
): { route: InspectionRoutePoint[]; totalDistance: number } {
  if (selectedSlotIds.length === 0) {
    return { route: [], totalDistance: 0 };
  }

  const slotMap = new Map<string, Slot>();
  layout.slots.forEach((s) => slotMap.set(s.id, s));

  const shelfMap = new Map<string, Shelf>();
  layout.shelves.forEach((s) => shelfMap.set(s.id, s));

  const selectedSlots = selectedSlotIds
    .map((id) => slotMap.get(id))
    .filter((s): s is Slot => s !== undefined);

  if (selectedSlots.length === 0) {
    return { route: [], totalDistance: 0 };
  }

  const unvisited = [...selectedSlots];
  const route: InspectionRoutePoint[] = [];
  let totalDistance = 0;
  let currentPos = { x: 0, y: 0, z: 0 };
  let order = 0;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const slot = unvisited[i];
      const shelf = shelfMap.get(slot.shelfId);
      const pos = getSlotPosition(slot, shelf);
      const dist = calculateDistance(currentPos, pos);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestIndex = i;
      }
    }

    const nearestSlot = unvisited[nearestIndex];
    const shelf = shelfMap.get(nearestSlot.shelfId);
    const pos = getSlotPosition(nearestSlot, shelf);

    totalDistance += nearestDistance;
    currentPos = pos;

    route.push({
      slotId: nearestSlot.id,
      shelfId: nearestSlot.shelfId,
      row: nearestSlot.row,
      column: nearestSlot.column,
      level: nearestSlot.level,
      order: order++,
      estimatedDistance: nearestDistance,
    });

    unvisited.splice(nearestIndex, 1);
  }

  return { route, totalDistance: Math.round(totalDistance * 100) / 100 };
}

export function filterSlots(layout: WarehouseLayout, filters: Filters): Slot[] {
  return layout.slots.filter((slot) => {
    if (filters.statusFilter !== 'all' && slot.status !== filters.statusFilter) {
      return false;
    }
    if (filters.shelfFilter !== 'all' && slot.shelfId !== filters.shelfFilter) {
      return false;
    }
    return true;
  });
}

export function createInspectionPackage(
  layout: WarehouseLayout,
  filters: Filters,
  selectedSlotIds: string[],
  name?: string,
  description?: string
): InspectionTaskPackage {
  const { route, totalDistance } = generateInspectionRoute(selectedSlotIds, layout);
  const now = new Date().toISOString();

  return {
    id: generateInspectionId(),
    version: '1.0.0',
    name: name || `巡检任务_${formatTimestamp(new Date())}`,
    description,
    layoutName: layout.name,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    filterSnapshot: { ...filters },
    selectedSlotIds: [...selectedSlotIds],
    route,
    totalDistance,
    totalPoints: route.length,
    metadata: {
      createdAt: now,
      layoutVersion: layout.version,
      shelfCount: layout.shelves.length,
    },
  };
}

export function updateInspectionPackage(
  pkg: InspectionTaskPackage,
  layout: WarehouseLayout,
  filters: Filters,
  selectedSlotIds: string[]
): InspectionTaskPackage {
  const { route, totalDistance } = generateInspectionRoute(selectedSlotIds, layout);
  return {
    ...pkg,
    updatedAt: new Date().toISOString(),
    filterSnapshot: { ...filters },
    selectedSlotIds: [...selectedSlotIds],
    route,
    totalDistance,
    totalPoints: route.length,
  };
}

export function publishInspectionPackage(pkg: InspectionTaskPackage): InspectionTaskPackage {
  const now = new Date().toISOString();
  return {
    ...pkg,
    status: 'published',
    publishedAt: now,
    updatedAt: now,
  };
}

export function exportInspectionToJSON(pkg: InspectionTaskPackage): string {
  return JSON.stringify(pkg, null, 2);
}

export function validateInspectionPackage(data: unknown): {
  valid: boolean;
  errors: string[];
  pkg?: InspectionTaskPackage;
} {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['巡检包格式错误：不是有效的JSON对象'] };
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
  if (!obj.updatedAt || typeof obj.updatedAt !== 'string') {
    errors.push('缺少或无效的 updatedAt 字段');
  }
  if (!obj.status || (obj.status !== 'draft' && obj.status !== 'published')) {
    errors.push('缺少或无效的 status 字段，必须为 draft 或 published');
  }
  if (!obj.filterSnapshot || typeof obj.filterSnapshot !== 'object') {
    errors.push('缺少或无效的 filterSnapshot 字段');
  }
  if (!Array.isArray(obj.selectedSlotIds)) {
    errors.push('缺少或无效的 selectedSlotIds 数组');
  }
  if (!Array.isArray(obj.route)) {
    errors.push('缺少或无效的 route 数组');
  }
  if (typeof obj.totalDistance !== 'number') {
    errors.push('缺少或无效的 totalDistance 字段');
  }
  if (typeof obj.totalPoints !== 'number') {
    errors.push('缺少或无效的 totalPoints 字段');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], pkg: data as InspectionTaskPackage };
}

export function checkInspectionImportConflicts(
  pkg: InspectionTaskPackage,
  currentLayout: WarehouseLayout,
  existingDraft: InspectionTaskPackage | null,
  existingPublished: InspectionTaskPackage | null
): InspectionImportConflict[] {
  const conflicts: InspectionImportConflict[] = [];

  if (pkg.layoutName !== currentLayout.name) {
    conflicts.push({
      type: 'layout_mismatch',
      severity: 'warn',
      message: `巡检包所属布局（${pkg.layoutName}）与当前布局（${currentLayout.name}）名称不匹配`,
      details: [`巡检包布局: ${pkg.layoutName}`, `当前布局: ${currentLayout.name}`],
    });
  }

  const pkgSlotIds = new Set(pkg.selectedSlotIds);
  const currentSlotIds = new Set(currentLayout.slots.map((s) => s.id));
  const missingSlots = Array.from(pkgSlotIds).filter((id) => !currentSlotIds.has(id));

  if (missingSlots.length > 0) {
    conflicts.push({
      type: 'slot_missing',
      severity: 'block',
      message: `巡检包中 ${missingSlots.length} 个货位在当前布局中不存在`,
      details: missingSlots.slice(0, 10).map((id) => `缺失货位: ${id}`),
    });
  }

  if (pkg.version !== '1.0.0') {
    conflicts.push({
      type: 'version_incompatible',
      severity: 'warn',
      message: `巡检包版本（${pkg.version}）可能与当前系统不兼容`,
    });
  }

  if (existingDraft && existingDraft.id === pkg.id) {
    conflicts.push({
      type: 'id_duplicate',
      severity: 'warn',
      message: `巡检包ID与现有草稿冲突，导入将覆盖现有草稿`,
      details: [`冲突ID: ${pkg.id}`, `现有草稿名称: ${existingDraft.name}`],
    });
  }

  if (existingPublished && existingPublished.id === pkg.id) {
    conflicts.push({
      type: 'id_duplicate',
      severity: 'warn',
      message: `巡检包ID与已发布内容冲突，导入将覆盖已发布内容`,
      details: [`冲突ID: ${pkg.id}`, `已发布名称: ${existingPublished.name}`],
    });
  }

  return conflicts;
}

export function prepareInspectionImportPreview(
  data: unknown,
  currentLayout: WarehouseLayout,
  existingDraft: InspectionTaskPackage | null,
  existingPublished: InspectionTaskPackage | null
): InspectionImportPreview {
  try {
    const validation = validateInspectionPackage(data);

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
    const conflicts = checkInspectionImportConflicts(pkg, currentLayout, existingDraft, existingPublished);

    const hasBlockConflict = conflicts.some((c) => c.severity === 'block');
    const hasIdDuplicate = conflicts.some((c) => c.type === 'id_duplicate');

    return {
      valid: true,
      package: pkg,
      conflicts,
      validationErrors: [],
      isParseError: false,
      canApply: !hasBlockConflict,
      applyMode: hasIdDuplicate ? 'overwrite' : 'view_only',
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

export function isDuplicateInspectionLogEntry(
  logs: { action: string; metadata?: Record<string, unknown> }[],
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

    return JSON.stringify(metadata) === JSON.stringify(log.metadata);
  });
}
