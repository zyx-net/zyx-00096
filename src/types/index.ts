export type SlotStatus = 'empty' | 'occupied' | 'conflict' | 'warning';

export type PalletStatus = 'normal' | 'damaged' | 'expired' | 'unknown';

export type ConflictType =
  | 'duplicate_pallet'
  | 'multi_pallet_slot'
  | 'unknown_slot'
  | 'damaged_layout'
  | 'empty_dataset';

export interface Shelf {
  id: string;
  name: string;
  position: { x: number; z: number };
  rows: number;
  columns: number;
  levels: number;
}

export interface Slot {
  id: string;
  shelfId: string;
  row: number;
  column: number;
  level: number;
  status: SlotStatus;
}

export interface Pallet {
  id: string;
  palletNo: string;
  slotId: string;
  status: PalletStatus;
  sku?: string;
  quantity?: number;
  lastCheckTime?: string;
}

export interface InventoryRecord {
  id: string;
  timestamp: string;
  pallets: Pallet[];
  note?: string;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  description: string;
  relatedIds: string[];
  confirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface WarehouseLayout {
  version: string;
  name: string;
  shelves: Shelf[];
  slots: Slot[];
  pallets: Pallet[];
  inventoryRecords: InventoryRecord[];
}

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface Filters {
  statusFilter: SlotStatus | 'all';
  shelfFilter: string | 'all';
}

export interface ImportDiffSummary {
  addedSlotIds: string[];
  removedSlotIds: string[];
  overwrittenSlotIds: string[];
  addedPalletIds: string[];
  removedPalletIds: string[];
}

export interface ImportPreviewDraft {
  batchId: string;
  layout: WarehouseLayout;
  validationErrors: string[];
  isParseError: boolean;
  summary: {
    name: string;
    shelfCount: number;
    slotCount: number;
    palletCount: number;
    recordCount: number;
    diff: ImportDiffSummary;
    projectedConflicts: Conflict[];
  };
  createdAt: string;
}

export interface UndoSnapshot {
  batchId: string;
  importedLayoutName: string;
  layout: WarehouseLayout;
  conflicts: Conflict[];
  confirmedConflicts: string[];
  cameraState?: CameraState;
  filters: Filters;
  playbackIndex: number;
  selectedSlotId: string | null;
  createdAt: string;
}

export interface PersistedState {
  filters: Filters;
  confirmedConflicts: string[];
  currentPlaybackIndex: number;
  exportCount: number;
  cameraState?: CameraState;
  selectedSlotId: string | null;
  previewDraft?: ImportPreviewDraft | null;
  undoSnapshot?: UndoSnapshot | null;
  currentBatchId?: string | null;
}

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}
