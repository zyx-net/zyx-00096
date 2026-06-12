import { FileJson, AlertTriangle, CheckCircle, XCircle, ArrowRightLeft, Eye, Check, X, Package, Grid3x3, MapPin, History } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { getConflictTypeLabel, getConflictTypeColor } from '@/utils/conflict';
import { formatTimestamp } from '@/utils/export';
import type { ConflictType } from '@/types';

export function ImportPreviewPanel() {
  const { previewDraft, cancelImportPreview, applyImportPreview, layout, undoSnapshot, undoLastImport } = useStore();

  if (!previewDraft) {
    if (!undoSnapshot) return null;
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-slate-300">
            <History className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium">上次导入可撤销</span>
          </div>
          <button
            onClick={undoLastImport}
            className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
          >
            <ArrowRightLeft className="w-3 h-3" />
            撤销本次导入
          </button>
        </div>
        <div className="text-xs text-slate-400 space-y-0.5">
          <div>导入的布局：<span className="text-slate-200">{undoSnapshot.importedLayoutName}</span></div>
          <div>导入前布局：<span className="text-slate-200">{undoSnapshot.layout.name}</span></div>
          <div>导入时间：{formatTimestamp(undoSnapshot.createdAt)}</div>
          <div className="text-amber-400">撤销将恢复布局、冲突、筛选、确认状态和相机视角</div>
        </div>
      </div>
    );
  }

  const hasErrors = previewDraft.validationErrors.length > 0;
  const { diff, projectedConflicts } = previewDraft.summary;

  return (
    <div className="bg-slate-800/90 border-2 rounded-lg p-3 mb-3 backdrop-blur-sm" style={{ borderColor: hasErrors ? '#ef4444' : '#3b82f6' }}>
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-100">导入预览</span>
          <span className="text-[10px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded">#{previewDraft.batchId.slice(-6)}</span>
        </div>
        <span className="text-[10px] text-slate-500">{formatTimestamp(previewDraft.createdAt)}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2 bg-slate-900/40 rounded p-2">
          <FileJson className={`w-5 h-5 flex-shrink-0 mt-0.5 ${hasErrors ? 'text-red-400' : 'text-blue-400'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-100 truncate">{previewDraft.summary.name}</div>
            <div className="grid grid-cols-4 gap-1 mt-1 text-[11px]">
              <div className="flex items-center gap-1 text-slate-400">
                <Grid3x3 className="w-3 h-3 text-slate-500" />
                <span>{previewDraft.summary.shelfCount}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <MapPin className="w-3 h-3 text-slate-500" />
                <span>{previewDraft.summary.slotCount}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Package className="w-3 h-3 text-slate-500" />
                <span>{previewDraft.summary.palletCount}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <History className="w-3 h-3 text-slate-500" />
                <span>{previewDraft.summary.recordCount}</span>
              </div>
            </div>
          </div>
        </div>

        {hasErrors && (
          <div className="bg-red-950/40 border border-red-800/60 rounded p-2">
            <div className="flex items-center gap-1 text-xs text-red-400 font-semibold mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>校验失败（{previewDraft.validationErrors.length}项）— 无法应用</span>
            </div>
            <ul className="space-y-0.5">
              {previewDraft.validationErrors.slice(0, 8).map((err, i) => (
                <li key={i} className="text-[11px] text-red-300 leading-snug pl-4 relative">
                  <span className="absolute left-0 top-0.5 w-2 h-2 rounded-full bg-red-500/80" />
                  {err}
                </li>
              ))}
              {previewDraft.validationErrors.length > 8 && (
                <li className="text-[11px] text-red-400/80 italic pl-4">...另有 {previewDraft.validationErrors.length - 8} 项错误</li>
              )}
            </ul>
          </div>
        )}

        {!hasErrors && (
          <>
            <div className="bg-slate-900/40 rounded p-2">
              <div className="text-xs text-slate-400 font-medium mb-1.5">货位变更摘要（当前布局 {layout.slots.length} → 目标 {previewDraft.summary.slotCount}）</div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <div className="bg-emerald-950/40 border border-emerald-900/60 rounded p-1.5">
                  <div className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />新增
                  </div>
                  <div className="text-emerald-200 text-lg font-bold">{diff.addedSlotIds.length}</div>
                  {diff.addedSlotIds.slice(0, 3).map((id) => (
                    <div key={id} className="text-emerald-300/80 truncate text-[10px]">{id}</div>
                  ))}
                  {diff.addedSlotIds.length > 3 && <div className="text-emerald-400/70 text-[10px]">+{diff.addedSlotIds.length - 3} 更多</div>}
                </div>
                <div className="bg-amber-950/40 border border-amber-900/60 rounded p-1.5">
                  <div className="text-amber-400 font-semibold flex items-center gap-1">
                    <ArrowRightLeft className="w-3 h-3" />覆盖
                  </div>
                  <div className="text-amber-200 text-lg font-bold">{diff.overwrittenSlotIds.length}</div>
                  {diff.overwrittenSlotIds.slice(0, 3).map((id) => (
                    <div key={id} className="text-amber-300/80 truncate text-[10px]">{id}</div>
                  ))}
                  {diff.overwrittenSlotIds.length > 3 && <div className="text-amber-400/70 text-[10px]">+{diff.overwrittenSlotIds.length - 3} 更多</div>}
                </div>
                <div className="bg-rose-950/40 border border-rose-900/60 rounded p-1.5">
                  <div className="text-rose-400 font-semibold flex items-center gap-1">
                    <XCircle className="w-3 h-3" />移除
                  </div>
                  <div className="text-rose-200 text-lg font-bold">{diff.removedSlotIds.length}</div>
                  {diff.removedSlotIds.slice(0, 3).map((id) => (
                    <div key={id} className="text-rose-300/80 truncate text-[10px]">{id}</div>
                  ))}
                  {diff.removedSlotIds.length > 3 && <div className="text-rose-400/70 text-[10px]">+{diff.removedSlotIds.length - 3} 更多</div>}
                </div>
              </div>
              {diff.addedPalletIds.length > 0 || diff.removedPalletIds.length > 0 ? (
                <div className="mt-1.5 text-[10px] text-slate-400">
                  托盘：<span className="text-emerald-400">+{diff.addedPalletIds.length}</span> / <span className="text-rose-400">-{diff.removedPalletIds.length}</span>
                </div>
              ) : null}
            </div>

            <div className="bg-slate-900/40 rounded p-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs text-slate-400 font-medium">导入后投影冲突</div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${projectedConflicts.length > 0 ? 'bg-red-900/60 text-red-300' : 'bg-emerald-900/60 text-emerald-300'}`}>
                  {projectedConflicts.length} 项
                </span>
              </div>
              {projectedConflicts.length === 0 ? (
                <div className="text-[11px] text-emerald-400 py-1 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  未检测到冲突，可安全导入
                </div>
              ) : (
                <ul className="space-y-1 max-h-28 overflow-y-auto">
                  {projectedConflicts.map((c) => (
                    <li key={c.id} className="text-[11px] leading-snug border-l-2 pl-1.5 py-0.5" style={{ borderColor: getConflictTypeColor(c.type as ConflictType) }}>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-300 font-medium">{getConflictTypeLabel(c.type as ConflictType)}</span>
                      </div>
                      <div className="text-slate-400 truncate">{c.description}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={cancelImportPreview}
            className="flex-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            取消预览
          </button>
          <button
            onClick={applyImportPreview}
            disabled={hasErrors}
            className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors ${
              hasErrors
                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            应用导入
          </button>
        </div>
      </div>
    </div>
  );
}
