import { AlertTriangle, CheckCircle, Download, Undo2, Archive, FileSpreadsheet } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { getConflictTypeLabel, getConflictTypeColor } from '@/utils/conflict';
import { exportConflictsToCSV, downloadCSV, formatTimestamp, exportSessionToCSV } from '@/utils/export';
import type { ConflictType } from '@/types';
import { useState } from 'react';
import { ImportPreviewPanel } from './ImportPreviewPanel';
import ReviewPanel from './ReviewPanel';

export default function RightPanel() {
  const { conflicts, confirmConflict, unconfirmConflict, rightPanelOpen, setSelectedSlotId, getCurrentPallets, incrementExport, currentBatchId, previewDraft, getActiveSession, isSessionArchived } = useStore();
  const [filterType, setFilterType] = useState<ConflictType | 'all'>('all');
  const currentPallets = getCurrentPallets();
  const activeSession = getActiveSession();
  const archived = isSessionArchived();

  const filteredConflicts = filterType === 'all' ? conflicts : conflicts.filter((c) => c.type === filterType);
  const unconfirmedCount = conflicts.filter((c) => !c.confirmed).length;

  const handleExport = () => {
    const batchInfo = previewDraft
      ? { batchId: previewDraft.batchId, batchName: previewDraft.summary.name, isPreview: true, batchCreatedAt: previewDraft.createdAt }
      : currentBatchId
        ? { batchId: currentBatchId, batchName: null, isPreview: false, batchCreatedAt: null }
        : null;
    const csv = exportConflictsToCSV(conflicts, batchInfo);
    const batchTag = previewDraft ? `预览_${previewDraft.batchId.slice(-6)}` : currentBatchId ? currentBatchId.slice(-6) : '手动';
    const filename = `异常清单_${batchTag}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(filename, csv);
    incrementExport();
  };

  const handleExportSession = () => {
    if (!activeSession) return;
    const { conflictsCSV, logsCSV } = exportSessionToCSV(activeSession);
    const safeName = activeSession.name.replace(/[\\/:*?"<>|]/g, '_');
    downloadCSV(`会话_${safeName}_异常清单.csv`, conflictsCSV);
    downloadCSV(`会话_${safeName}_操作日志.csv`, logsCSV);
    incrementExport();
  };

  const handleLocateConflict = (conflict: { relatedIds: string[]; type: string }) => {
    if (conflict.type === 'multi_pallet_slot') {
      const pallet = currentPallets.find((p) => conflict.relatedIds.includes(p.id));
      if (pallet) {
        setSelectedSlotId(pallet.slotId);
      }
    } else if (conflict.type === 'duplicate_pallet') {
      const pallet = currentPallets.find((p) => conflict.relatedIds.includes(p.id));
      if (pallet) {
        setSelectedSlotId(pallet.slotId);
      }
    }
  };

  if (!rightPanelOpen) return null;

  const conflictTypes = [
    { value: 'all', label: '全部' },
    { value: 'multi_pallet_slot', label: '多托盘' },
    { value: 'duplicate_pallet', label: '重复号' },
    { value: 'unknown_slot', label: '未知位' },
    { value: 'damaged_layout', label: '坏配置' },
    { value: 'empty_dataset', label: '空数据' },
  ];

  return (
    <div className="absolute right-0 top-16 bottom-20 w-96 z-10 m-4 mr-0">
      <div className="h-full bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-l-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              异常清单
              <span className="ml-1 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                {unconfirmedCount}
              </span>
            </h2>
            {archived && (
              <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
                <Archive size={12} />
                只读归档
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors"
            >
              <Download size={14} />
              导出异常
            </button>
            {activeSession && (
              <button
                onClick={handleExportSession}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors"
              >
                <FileSpreadsheet size={14} />
                导出会话
              </button>
            )}
          </div>
        </div>

        <div className="px-3 py-2 border-b border-slate-700/50 flex gap-1 overflow-x-auto">
          {conflictTypes.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value as ConflictType | 'all')}
              className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                filterType === t.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pt-3 space-y-3">
            <ReviewPanel />
            <ImportPreviewPanel />
          </div>
          {filteredConflicts.length > 0 ? (
            <div className="p-3 space-y-2">
              {filteredConflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className={`rounded-lg border p-3 transition-all ${
                    conflict.confirmed
                      ? 'bg-green-900/20 border-green-700/50'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getConflictTypeColor(conflict.type) }}
                      />
                      <span className="text-xs font-medium text-slate-400">
                        {getConflictTypeLabel(conflict.type)}
                      </span>
                    </div>
                    {conflict.confirmed ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle size={12} />
                        已确认
                      </span>
                    ) : (
                      <span className="text-xs text-red-400">待处理</span>
                    )}
                  </div>

                  <p className={`text-sm mb-3 ${conflict.confirmed ? 'text-green-300' : 'text-slate-200'}`}>
                    {conflict.description}
                  </p>

                  {conflict.confirmedAt && (
                    <p className="text-xs text-slate-500 mb-3">
                      确认时间：{formatTimestamp(conflict.confirmedAt)}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {conflict.type === 'multi_pallet_slot' || conflict.type === 'duplicate_pallet' ? (
                      <button
                        onClick={() => handleLocateConflict(conflict)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                      >
                        定位货位
                      </button>
                    ) : null}
                    {!conflict.confirmed && !archived && (
                      <button
                        onClick={() => confirmConflict(conflict.id)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                      >
                        人工确认
                      </button>
                    )}
                    {conflict.confirmed && !archived && (
                      <button
                        onClick={() => unconfirmConflict(conflict.id)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-amber-700 hover:bg-amber-600 text-white rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <Undo2 size={12} />
                        撤销确认
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-center py-12">
              <CheckCircle size={48} className="mx-auto mb-3 text-green-600/50" />
              <p className="text-sm">暂无异常</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/30">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-800/50 rounded py-2">
              <div className="text-lg font-bold text-white">{conflicts.length}</div>
              <div className="text-slate-400">总异常</div>
            </div>
            <div className="bg-red-900/30 rounded py-2">
              <div className="text-lg font-bold text-red-400">{unconfirmedCount}</div>
              <div className="text-slate-400">待处理</div>
            </div>
            <div className="bg-green-900/30 rounded py-2">
              <div className="text-lg font-bold text-green-400">
                {conflicts.length - unconfirmedCount}
              </div>
              <div className="text-slate-400">已确认</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
