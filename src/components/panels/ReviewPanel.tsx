import { useState, useRef } from 'react';
import {
  GitCompare,
  Download,
  Upload,
  X,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  MapPin,
  Undo2,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatTimestamp } from '@/utils/export';
import type { ChangeType } from '@/types';

const changeTypeLabels: Record<ChangeType, string> = {
  added: '新增',
  removed: '移除',
  modified: '修改',
  unchanged: '无变化',
};

const changeTypeColors: Record<ChangeType, string> = {
  added: 'text-green-400 bg-green-500/20',
  removed: 'text-red-400 bg-red-500/20',
  modified: 'text-yellow-400 bg-yellow-500/20',
  unchanged: 'text-slate-400 bg-slate-500/20',
};

const changeTypeBadgeColors: Record<ChangeType, string> = {
  added: 'bg-green-500',
  removed: 'bg-red-500',
  modified: 'bg-yellow-500',
  unchanged: 'bg-slate-500',
};

export default function ReviewPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    layout,
    reviewState,
    setReviewEnabled,
    computeReviewDiff,
    clearReviewDiff,
    toggleReviewSlotSelection,
    clearReviewSlotSelection,
    exportReviewJSON,
    exportReviewCSV,
    prepareReviewImport,
    cancelReviewImport,
    applyReviewImport,
    undoReviewImport,
    refreshReviewFromStorage,
    setSelectedSlotId,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'summary' | 'slots' | 'pallets' | 'confirmations'>('summary');
  const [diffFilter, setDiffFilter] = useState<ChangeType | 'all'>('all');

  const { enabled, selection, diff, selectedSlotIds, importPreview, undoSnapshot, lastImportedPackageId } = reviewState;

  const records = layout.inventoryRecords;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      prepareReviewImport(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getSnapshotLabel = (index: number) => {
    if (index === -1 || index >= records.length) return '当前状态';
    const record = records[index];
    return `快照${index + 1} - ${formatTimestamp(record.timestamp)}`;
  };

  const filteredSlotDiffs = diff
    ? diffFilter === 'all'
      ? diff.slotDiffs
      : diff.slotDiffs.filter((d) => d.changeType === diffFilter)
    : [];

  const filteredPalletDiffs = diff
    ? diffFilter === 'all'
      ? diff.palletDiffs
      : diff.palletDiffs.filter((d) => d.changeType === diffFilter)
    : [];

  const filteredConfirmationDiffs = diff
    ? diffFilter === 'all'
      ? diff.confirmationDiffs
      : diff.confirmationDiffs.filter((d) => d.changeType === diffFilter)
    : [];

  if (!enabled) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium flex items-center gap-2">
            <GitCompare size={16} className="text-purple-400" />
            异常复盘
          </h3>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          选择两次盘点快照进行对比，分析货位、托盘状态和人工确认记录的变化。
        </p>
        <button
          onClick={() => setReviewEnabled(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md transition-colors text-sm"
        >
          <GitCompare size={16} />
          开始复盘
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-medium flex items-center gap-2">
            <GitCompare size={16} className="text-purple-400" />
            异常复盘
          </h3>
          <div className="flex items-center gap-1">
            {undoSnapshot && (
              <button
                onClick={undoReviewImport}
                className="p-1.5 rounded hover:bg-slate-700 text-amber-400 transition-colors"
                title="撤销复盘导入"
              >
                <Undo2 size={14} />
              </button>
            )}
            <button
              onClick={refreshReviewFromStorage}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 transition-colors"
              title="从存储刷新"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => {
                setReviewEnabled(false);
                clearReviewDiff();
              }}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 transition-colors"
              title="关闭复盘"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {selection && (
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-purple-400">A:</span>
              <span>{getSnapshotLabel(selection.snapshotAIndex)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">B:</span>
              <span>{getSnapshotLabel(selection.snapshotBIndex)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-b border-slate-700/50">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={computeReviewDiff}
            disabled={!selection || selection.snapshotAIndex === selection.snapshotBIndex}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md transition-colors"
          >
            <GitCompare size={14} />
            生成对比
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              importPreview
                ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-400/50'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <Upload size={14} />
            {importPreview ? '继续导入...' : '导入复盘'}
          </button>
          {diff && (
            <>
              <button
                onClick={() => exportReviewJSON()}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors"
              >
                <FileJson size={14} />
              </button>
              <button
                onClick={() => exportReviewCSV()}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors"
              >
                <FileSpreadsheet size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {importPreview && (
        <div className="px-3 py-3 border-b border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white font-medium">
              导入预览：{importPreview.package?.name || '未知'}
            </span>
            <button
              onClick={cancelReviewImport}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {importPreview.validationErrors.length > 0 && (
            <div className="mb-2 p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
              <div className="flex items-center gap-1 mb-1">
                <AlertCircle size={12} />
                <span className="font-medium">校验错误</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {importPreview.validationErrors.slice(0, 3).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {importPreview.conflicts.length > 0 && (
            <div className="mb-2 space-y-1">
              {importPreview.conflicts.map((conflict, i) => (
                <div
                  key={i}
                  className={`p-2 rounded text-xs ${
                    conflict.severity === 'block'
                      ? 'bg-red-900/30 border border-red-700/50 text-red-300'
                      : conflict.severity === 'warn'
                      ? 'bg-yellow-900/30 border border-yellow-700/50 text-yellow-300'
                      : 'bg-blue-900/30 border border-blue-700/50 text-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {conflict.severity === 'block' ? (
                      <AlertCircle size={12} />
                    ) : conflict.severity === 'warn' ? (
                      <AlertTriangle size={12} />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    <span className="font-medium">{conflict.message}</span>
                  </div>
                  {conflict.details && (
                    <ul className="list-disc list-inside space-y-0.5 opacity-80">
                      {conflict.details.slice(0, 2).map((d, j) => (
                        <li key={j}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              应用模式：
              <span className={importPreview.applyMode === 'full' ? 'text-green-400' : 'text-yellow-400'}>
                {importPreview.applyMode === 'full' ? '完整模式' : '只读模式'}
              </span>
            </span>
            <button
              onClick={applyReviewImport}
              disabled={!importPreview.canApply}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md transition-colors"
            >
              <Download size={14} />
              应用复盘
            </button>
          </div>
        </div>
      )}

      {lastImportedPackageId && (
        <div className="px-3 py-2 border-b border-slate-700/50 bg-purple-900/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-300">已应用复盘包</span>
            <span className="text-slate-400 font-mono">{lastImportedPackageId.slice(-8)}</span>
          </div>
        </div>
      )}

      {diff && (
        <>
          <div className="px-3 py-2 border-b border-slate-700/50 flex gap-1 overflow-x-auto">
            {(['summary', 'slots', 'pallets', 'confirmations'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {tab === 'summary' && `摘要`}
                {tab === 'slots' && `货位 (${diff.slotDiffs.length})`}
                {tab === 'pallets' && `托盘 (${diff.palletDiffs.length})`}
                {tab === 'confirmations' && `确认记录 (${diff.confirmationDiffs.length})`}
              </button>
            ))}
          </div>

          {activeTab !== 'summary' && (
            <div className="px-3 py-2 border-b border-slate-700/50 flex gap-1 overflow-x-auto">
              {(['all', 'added', 'removed', 'modified', 'unchanged'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setDiffFilter(type)}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    diffFilter === type
                      ? type === 'all'
                        ? 'bg-slate-600 text-white'
                        : `${changeTypeBadgeColors[type]} text-white`
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {type === 'all' ? '全部' : changeTypeLabels[type]}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto p-3">
            {activeTab === 'summary' && diff && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">货位变化</div>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      <div>
                        <div className="text-green-400 font-bold">{diff.summary.slotChanges.added}</div>
                        <div className="text-slate-500">新增</div>
                      </div>
                      <div>
                        <div className="text-red-400 font-bold">{diff.summary.slotChanges.removed}</div>
                        <div className="text-slate-500">移除</div>
                      </div>
                      <div>
                        <div className="text-yellow-400 font-bold">{diff.summary.slotChanges.modified}</div>
                        <div className="text-slate-500">修改</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold">{diff.summary.slotChanges.unchanged}</div>
                        <div className="text-slate-500">无变</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">托盘变化</div>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      <div>
                        <div className="text-green-400 font-bold">{diff.summary.palletChanges.added}</div>
                        <div className="text-slate-500">新增</div>
                      </div>
                      <div>
                        <div className="text-red-400 font-bold">{diff.summary.palletChanges.removed}</div>
                        <div className="text-slate-500">移除</div>
                      </div>
                      <div>
                        <div className="text-yellow-400 font-bold">{diff.summary.palletChanges.modified}</div>
                        <div className="text-slate-500">修改</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold">{diff.summary.palletChanges.unchanged}</div>
                        <div className="text-slate-500">无变</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">确认记录</div>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      <div>
                        <div className="text-green-400 font-bold">{diff.summary.confirmationChanges.added}</div>
                        <div className="text-slate-500">新增</div>
                      </div>
                      <div>
                        <div className="text-red-400 font-bold">{diff.summary.confirmationChanges.removed}</div>
                        <div className="text-slate-500">移除</div>
                      </div>
                      <div>
                        <div className="text-yellow-400 font-bold">{diff.summary.confirmationChanges.modified}</div>
                        <div className="text-slate-500">修改</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold">{diff.summary.confirmationChanges.unchanged}</div>
                        <div className="text-slate-500">无变</div>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedSlotIds.length > 0 && (
                  <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-purple-400" />
                        <span className="text-sm text-white font-medium">
                          已选中 {selectedSlotIds.length} 个货位
                        </span>
                      </div>
                      <button
                        onClick={clearReviewSlotSelection}
                        className="text-xs text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                        清空
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedSlotIds.slice(0, 10).map((id) => (
                        <button
                          key={id}
                          onClick={() => {
                            toggleReviewSlotSelection(id);
                            setSelectedSlotId(id);
                          }}
                          className="px-2 py-0.5 text-xs bg-purple-600/30 text-purple-300 rounded hover:bg-purple-600/50 transition-colors font-mono"
                        >
                          {id}
                        </button>
                      ))}
                      {selectedSlotIds.length > 10 && (
                        <span className="px-2 py-0.5 text-xs text-slate-400">
                          +{selectedSlotIds.length - 10} 更多
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'slots' && (
              <div className="space-y-2">
                {filteredSlotDiffs.length > 0 ? (
                  filteredSlotDiffs.map((item) => (
                    <div
                      key={item.slotId}
                      className={`rounded-lg border p-3 transition-all ${
                        selectedSlotIds.includes(item.slotId)
                          ? 'bg-purple-900/30 border-purple-600'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-xs rounded ${changeTypeColors[item.changeType]}`}>
                            {changeTypeLabels[item.changeType]}
                          </span>
                          <span className="text-white font-mono text-sm">{item.slotId}</span>
                        </div>
                        <button
                          onClick={() => {
                            toggleReviewSlotSelection(item.slotId);
                            setSelectedSlotId(item.slotId);
                          }}
                          className={`p-1 rounded transition-colors ${
                            selectedSlotIds.includes(item.slotId)
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                          title={selectedSlotIds.includes(item.slotId) ? '取消选中' : '选中货位'}
                        >
                          <MapPin size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">货架：</span>
                          <span className="text-slate-300">{item.shelfId}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-purple-400">A:</span>
                          <span className="text-slate-300">{item.statusA || '-'}</span>
                        </div>
                        <div />
                        <div className="flex items-center gap-1">
                          <span className="text-cyan-400">B:</span>
                          <span className="text-slate-300">{item.statusB || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无货位变化数据
                  </div>
                )}
              </div>
            )}

            {activeTab === 'pallets' && (
              <div className="space-y-2">
                {filteredPalletDiffs.length > 0 ? (
                  filteredPalletDiffs.map((item) => (
                    <div
                      key={item.palletId}
                      className="bg-slate-800/50 rounded-lg border border-slate-700 p-3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-xs rounded ${changeTypeColors[item.changeType]}`}>
                            {changeTypeLabels[item.changeType]}
                          </span>
                          <span className="text-white font-mono text-sm">{item.palletNo}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {item.sku && (
                          <div>
                            <span className="text-slate-500">SKU：</span>
                            <span className="text-slate-300">{item.sku}</span>
                          </div>
                        )}
                        {item.quantity !== undefined && (
                          <div>
                            <span className="text-slate-500">数量：</span>
                            <span className="text-slate-300">{item.quantity}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-purple-400">A状态：</span>
                          <span className="text-slate-300">{item.statusA || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-cyan-400">B状态：</span>
                          <span className="text-slate-300">{item.statusB || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-purple-400">A货位：</span>
                          <span className="text-slate-300 font-mono">{item.slotIdA || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-cyan-400">B货位：</span>
                          <span className="text-slate-300 font-mono">{item.slotIdB || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无托盘变化数据
                  </div>
                )}
              </div>
            )}

            {activeTab === 'confirmations' && (
              <div className="space-y-2">
                {filteredConfirmationDiffs.length > 0 ? (
                  filteredConfirmationDiffs.map((item) => (
                    <div
                      key={item.conflictId}
                      className="bg-slate-800/50 rounded-lg border border-slate-700 p-3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-xs rounded ${changeTypeColors[item.changeType]}`}>
                            {changeTypeLabels[item.changeType]}
                          </span>
                          <span className="text-xs text-slate-400">{item.type}</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-200 mb-2">{item.description}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-purple-400">A确认：</span>
                          <span className={item.confirmedA ? 'text-green-400' : 'text-slate-400'}>
                            {item.confirmedA ? '已确认' : '未确认'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-cyan-400">B确认：</span>
                          <span className={item.confirmedB ? 'text-green-400' : 'text-slate-400'}>
                            {item.confirmedB ? '已确认' : '未确认'}
                          </span>
                        </div>
                        {item.confirmedAtA && (
                          <div>
                            <span className="text-purple-400">A时间：</span>
                            <span className="text-slate-300">{formatTimestamp(item.confirmedAtA)}</span>
                          </div>
                        )}
                        {item.confirmedAtB && (
                          <div>
                            <span className="text-cyan-400">B时间：</span>
                            <span className="text-slate-300">{formatTimestamp(item.confirmedAtB)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无确认记录变化
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!diff && !importPreview && (
        <div className="p-6 text-center text-slate-500 text-sm">
          {selection ? (
            <div>
              <p className="mb-2">已选择快照，点击"生成对比"开始分析</p>
              <p className="text-xs text-slate-600">
                或在下方时间轴上调整快照选择
              </p>
            </div>
          ) : (
            <div>
              <GitCompare size={32} className="mx-auto mb-2 text-slate-600" />
              <p>在时间轴上点击标记来选择两次快照</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
