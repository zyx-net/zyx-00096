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

export type ReviewSessionStatus = 'active' | 'archived';

export type LogActionType =
  | 'confirm_conflict'
  | 'unconfirm_conflict'
  | 'apply_import'
  | 'undo_import'
  | 'restore_session'
  | 'create_session'
  | 'rename_session'
  | 'archive_session'
  | 'unarchive_session'
  | 'export_csv'
  | 'create_review'
  | 'export_review_json'
  | 'export_review_csv'
  | 'import_review'
  | 'apply_review'
  | 'undo_review';

export type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ReviewSnapshotSelection {
  snapshotAIndex: number;
  snapshotBIndex: number;
}

export interface SlotDiffItem {
  slotId: string;
  changeType: ChangeType;
  statusA?: SlotStatus;
  statusB?: SlotStatus;
  shelfId: string;
}

export interface PalletDiffItem {
  palletId: string;
  changeType: ChangeType;
  palletNo: string;
  statusA?: PalletStatus;
  statusB?: PalletStatus;
  slotIdA?: string;
  slotIdB?: string;
  sku?: string;
  quantity?: number;
}

export interface ConfirmationDiffItem {
  conflictId: string;
  changeType: ChangeType;
  description: string;
  type: ConflictType;
  confirmedA: boolean;
  confirmedB: boolean;
  confirmedAtA?: string;
  confirmedAtB?: string;
  confirmedByA?: string;
  confirmedByB?: string;
}

export interface ReviewDiffSummary {
  slotChanges: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
  palletChanges: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
  confirmationChanges: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

export interface ReviewDiff {
  selection: ReviewSnapshotSelection;
  summary: ReviewDiffSummary;
  slotDiffs: SlotDiffItem[];
  palletDiffs: PalletDiffItem[];
  confirmationDiffs: ConfirmationDiffItem[];
  createdAt: string;
}

export interface ReviewPackage {
  id: string;
  version: string;
  name: string;
  description?: string;
  layoutName: string;
  createdAt: string;
  snapshotSelection: ReviewSnapshotSelection;
  snapshotA: {
    timestamp: string;
    note?: string;
    pallets: Pallet[];
    conflicts: Conflict[];
  };
  snapshotB: {
    timestamp: string;
    note?: string;
    pallets: Pallet[];
    conflicts: Conflict[];
  };
  diff: ReviewDiff;
  selectedSlotIds: string[];
  metadata?: Record<string, unknown>;
}

export interface ReviewImportConflict {
  type: 'layout_mismatch' | 'snapshot_missing' | 'version_incompatible';
  severity: 'block' | 'warn' | 'info';
  message: string;
  details?: string[];
}

export interface ReviewImportPreview {
  valid: boolean;
  package: ReviewPackage | null;
  conflicts: ReviewImportConflict[];
  validationErrors: string[];
  isParseError: boolean;
  canApply: boolean;
  applyMode: 'full' | 'view_only';
}

export interface ReviewState {
  enabled: boolean;
  selection: ReviewSnapshotSelection | null;
  diff: ReviewDiff | null;
  selectedSlotIds: string[];
  importPreview: ReviewImportPreview | null;
  undoSnapshot: {
    selectedSlotIds: string[];
    diff: ReviewDiff | null;
    selection: ReviewSnapshotSelection | null;
  } | null;
  lastImportedPackageId: string | null;
}

export interface ReviewLogEntry {
  id: string;
  sessionId: string;
  action: LogActionType;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ReviewSession {
  id: string;
  name: string;
  status: ReviewSessionStatus;
  createdAt: string;
  lastOpenedAt: string;
  layoutName: string;
  conflicts: Conflict[];
  confirmedConflictIds: string[];
  filters: Filters;
  selectedSlotId: string | null;
  cameraState?: CameraState;
  playbackIndex: number;
  slotIds: string[];
  palletIds: string[];
  logs: ReviewLogEntry[];
}

export interface RestoreConflict {
  missingSlotIds: string[];
  missingPalletIds: string[];
  extraSlotIds: string[];
  extraPalletIds: string[];
}

export type RestoreMode = 'full' | 'view_only';

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
  activeSessionId?: string | null;
  reviewState?: {
    selection: ReviewSnapshotSelection | null;
    selectedSlotIds: string[];
    lastImportedPackageId: string | null;
  };
}
