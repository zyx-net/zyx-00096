import type { Conflict, Pallet, Slot, WarehouseLayout, ConflictType } from '@/types';

function generateDeterministicId(type: string, key: string): string {
  return `conflict-${type}-${key}`;
}

export function detectConflicts(layout: WarehouseLayout): Conflict[] {
  const conflicts: Conflict[] = [];
  const { shelves, slots, pallets } = layout;

  if (shelves.length === 0 || slots.length === 0) {
    conflicts.push({
      id: generateDeterministicId('empty_dataset', 'main'),
      type: 'empty_dataset',
      description: '数据集为空：货架或货位数量为零',
      relatedIds: [],
      confirmed: false,
    });
    return conflicts;
  }

  const slotIdMap = new Map<string, Slot>();
  slots.forEach((slot) => slotIdMap.set(slot.id, slot));

  const palletBySlot = new Map<string, Pallet[]>();
  pallets.forEach((pallet) => {
    if (!palletBySlot.has(pallet.slotId)) {
      palletBySlot.set(pallet.slotId, []);
    }
    palletBySlot.get(pallet.slotId)!.push(pallet);
  });

  palletBySlot.forEach((palletList, slotId) => {
    if (palletList.length > 1) {
      const sortedNos = palletList.map((p) => p.palletNo).sort().join('-');
      conflicts.push({
        id: generateDeterministicId('multi_pallet_slot', `${slotId}-${sortedNos}`),
        type: 'multi_pallet_slot',
        description: `货位 ${slotId} 被 ${palletList.length} 个托盘占用：${palletList.map((p) => p.palletNo).join('、')}`,
        relatedIds: palletList.map((p) => p.id),
        confirmed: false,
      });
    }
  });

  const palletByNo = new Map<string, Pallet[]>();
  pallets.forEach((pallet) => {
    if (!palletByNo.has(pallet.palletNo)) {
      palletByNo.set(pallet.palletNo, []);
    }
    palletByNo.get(pallet.palletNo)!.push(pallet);
  });

  palletByNo.forEach((palletList, palletNo) => {
    if (palletList.length > 1) {
      const slotIds = palletList.map((p) => p.slotId).sort().join('-');
      conflicts.push({
        id: generateDeterministicId('duplicate_pallet', `${palletNo}-${slotIds}`),
        type: 'duplicate_pallet',
        description: `重复托盘号 ${palletNo}，出现在 ${palletList.length} 个位置`,
        relatedIds: palletList.map((p) => p.id),
        confirmed: false,
      });
    }
  });

  pallets.forEach((pallet) => {
    if (!slotIdMap.has(pallet.slotId)) {
      conflicts.push({
        id: generateDeterministicId('unknown_slot', `${pallet.palletNo}-${pallet.slotId}`),
        type: 'unknown_slot',
        description: `托盘 ${pallet.palletNo} 位于未知货位 ${pallet.slotId}`,
        relatedIds: [pallet.id],
        confirmed: false,
      });
    }
  });

  return conflicts;
}

export function validateLayout(data: unknown): { valid: boolean; errors: string[]; layout?: WarehouseLayout } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['配置文件格式错误：不是有效的JSON对象'] };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.version || typeof obj.version !== 'string') {
    errors.push('缺少或无效的 version 字段');
  }
  if (!obj.name || typeof obj.name !== 'string') {
    errors.push('缺少或无效的 name 字段');
  }
  if (!Array.isArray(obj.shelves)) {
    errors.push('缺少或无效的 shelves 数组');
  }
  if (!Array.isArray(obj.slots)) {
    errors.push('缺少或无效的 slots 数组');
  }
  if (!Array.isArray(obj.pallets)) {
    errors.push('缺少或无效的 pallets 数组');
  }
  if (!Array.isArray(obj.inventoryRecords)) {
    errors.push('缺少或无效的 inventoryRecords 数组');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const shelves = obj.shelves as unknown[];
  shelves.forEach((shelf, index) => {
    if (!shelf || typeof shelf !== 'object') {
      errors.push(`货架[${index}]: 不是有效的对象`);
      return;
    }
    const s = shelf as Record<string, unknown>;
    if (!s.id || typeof s.id !== 'string') {
      errors.push(`货架[${index}]: 缺少或无效的 id 字段`);
    }
    if (!s.name || typeof s.name !== 'string') {
      errors.push(`货架[${index}]: 缺少或无效的 name 字段`);
    }
    if (typeof s.columns !== 'number' || !Number.isFinite(s.columns) || s.columns <= 0) {
      errors.push(`货架[${index}]: columns 必须为正整数，当前值: ${String(s.columns)}`);
    }
    if (typeof s.levels !== 'number' || !Number.isFinite(s.levels) || s.levels <= 0) {
      errors.push(`货架[${index}]: levels 必须为正整数，当前值: ${String(s.levels)}`);
    }
    if (typeof s.rows !== 'number' || !Number.isFinite(s.rows) || s.rows <= 0) {
      errors.push(`货架[${index}]: rows 必须为正整数，当前值: ${String(s.rows)}`);
    }
    if (!s.position || typeof s.position !== 'object') {
      errors.push(`货架[${index}]: 缺少或无效的 position 对象`);
    } else {
      const pos = s.position as Record<string, unknown>;
      if (typeof pos.x !== 'number' || !Number.isFinite(pos.x)) {
        errors.push(`货架[${index}]: position.x 必须为有效数字，当前值: ${String(pos.x)}`);
      }
      if (typeof pos.z !== 'number' || !Number.isFinite(pos.z)) {
        errors.push(`货架[${index}]: position.z 必须为有效数字，当前值: ${String(pos.z)}`);
      }
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], layout: data as WarehouseLayout };
}

export function getConflictTypeLabel(type: ConflictType): string {
  const map: Record<ConflictType, string> = {
    duplicate_pallet: '重复托盘号',
    multi_pallet_slot: '货位多托盘',
    unknown_slot: '未知货位',
    damaged_layout: '损坏配置',
    empty_dataset: '空数据集',
  };
  return map[type] || type;
}

export function getConflictTypeColor(type: ConflictType): string {
  const map: Record<ConflictType, string> = {
    duplicate_pallet: '#f59e0b',
    multi_pallet_slot: '#ef4444',
    unknown_slot: '#8b5cf6',
    damaged_layout: '#dc2626',
    empty_dataset: '#6b7280',
  };
  return map[type] || '#6b7280';
}
