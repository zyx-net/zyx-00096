import { useRef } from 'react';
import { Upload, RotateCcw, Filter, Layers, ChevronLeft, ChevronRight, Download, RefreshCw, Undo2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { SlotStatus } from '@/types';

export default function TopToolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    layout,
    filters,
    setFilters,
    importLayout,
    loadSampleData,
    leftPanelOpen,
    rightPanelOpen,
    toggleLeftPanel,
    toggleRightPanel,
    getExportCount,
    undoSnapshot,
    undoLastImport,
    previewDraft,
  } = useStore();

  const exportCount = getExportCount();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importLayout(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResetCamera = () => {
    localStorage.removeItem('warehouse_inspection_state');
    window.location.reload();
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-700">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleLeftPanel}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title={leftPanelOpen ? '收起左侧面板' : '展开左侧面板'}
        >
          {leftPanelOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>

        <div className="flex items-center gap-2">
          <Layers className="text-blue-400" size={20} />
          <h1 className="text-lg font-bold text-white tracking-wide">{layout.name}</h1>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">货架：</span>
          <span className="text-white font-mono">{layout.shelves.length}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">货位：</span>
          <span className="text-white font-mono">{layout.slots.length}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">托盘：</span>
          <span className="text-white font-mono">{layout.pallets.length}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filters.shelfFilter}
            onChange={(e) => setFilters({ ...filters, shelfFilter: e.target.value })}
            className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-md border border-slate-600 focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部货架</option>
            {layout.shelves.map((shelf) => (
              <option key={shelf.id} value={shelf.id}>
                {shelf.name}
              </option>
            ))}
          </select>

          <select
            value={filters.statusFilter}
            onChange={(e) =>
              setFilters({ ...filters, statusFilter: e.target.value as SlotStatus | 'all' })
            }
            className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-md border border-slate-600 focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="occupied">已占用</option>
            <option value="empty">空置</option>
            <option value="conflict">冲突</option>
          </select>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              previewDraft
                ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-400/50'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <Upload size={16} />
            {previewDraft ? '继续预览...' : '导入布局'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {undoSnapshot && (
          <button
            onClick={undoLastImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-700/80 hover:bg-amber-600 text-white rounded-md transition-colors animate-pulse ring-1 ring-amber-500/40"
            title={`撤销导入，恢复到导入前的 ${undoSnapshot.layout.name}`}
          >
            <Undo2 size={16} />
            撤销导入
          </button>
        )}

        <button
          onClick={loadSampleData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
        >
          <RefreshCw size={16} />
          重置样例
        </button>

        <button
          onClick={handleResetCamera}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
          title="重置视角和状态"
        >
          <RotateCcw size={16} />
          复位
        </button>

        <div className="h-6 w-px bg-slate-700" />

        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <Download size={16} />
          <span>已导出</span>
          <span className="text-white font-mono">{exportCount}</span>
          <span>次</span>
        </div>

        <button
          onClick={toggleRightPanel}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title={rightPanelOpen ? '收起右侧面板' : '展开右侧面板'}
        >
          {rightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </div>
  );
}
