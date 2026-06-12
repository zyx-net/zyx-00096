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

export interface PersistedState {
  filters: Filters;
  confirmedConflicts: string[];
  currentPlaybackIndex: number;
  exportCount: number;
  cameraState?: CameraState;
  selectedSlotId: string | null;
}

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}
