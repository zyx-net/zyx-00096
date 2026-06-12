import { Package, MapPin, Calendar, Tag, Hash, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatTimestamp } from '@/utils/export';

export default function LeftPanel() {
  const { layout, selectedSlotId, leftPanelOpen, conflicts, getCurrentPallets } = useStore();
  const pallets = getCurrentPallets();

  const selectedSlot = layout.slots.find((s) => s.id === selectedSlotId);
  const selectedShelf = selectedSlot ? layout.shelves.find((sh) => sh.id === selectedSlot.shelfId) : null;
  const slotPallets = selectedSlot ? pallets.filter((p) => p.slotId === selectedSlot.id) : [];
  const slotConflicts = selectedSlot
    ? conflicts.filter((c) => c.type === 'multi_pallet_slot' && c.relatedIds.some((rid) => slotPallets.some((sp) => sp.id === rid)))
    : [];

  const statusLabels: Record<string, string> = {
    empty: '空置',
    occupied: '已占用',
    conflict: '冲突',
    warning: '预警',
  };

  const statusColors: Record<string, string> = {
    empty: 'bg-gray-500',
    occupied: 'bg-green-500',
    conflict: 'bg-red-500',
    warning: 'bg-yellow-500',
  };

  const palletStatusLabels: Record<string, string> = {
    normal: '正常',
    damaged: '破损',
    expired: '过期',
    unknown: '未知',
  };

  const palletStatusColors: Record<string, string> = {
    normal: 'text-green-400',
    damaged: 'text-orange-400',
    expired: 'text-pink-400',
    unknown: 'text-purple-400',
  };

  if (!leftPanelOpen) return null;

  return (
    <div className="absolute left-0 top-16 bottom-20 w-80 z-10 m-4 ml-0">
      <div className="h-full bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-r-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Package size={18} className="text-blue-400" />
            货位详情
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedSlot ? (
            <>
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">货位编号</span>
                  <span className="text-white font-mono font-medium">{selectedSlot.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">所属货架</span>
                  <span className="text-white">{selectedShelf?.name || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">位置</span>
                  <span className="text-slate-300 text-sm font-mono">
                    第{selectedSlot.column + 1}列 · 第{selectedSlot.level + 1}层
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">状态</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusColors[selectedSlot.status]}`} />
                    <span className="text-white text-sm">{statusLabels[selectedSlot.status]}</span>
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-slate-300 text-sm font-medium mb-2 flex items-center gap-2">
                  <MapPin size={14} className="text-slate-400" />
                  托盘列表 ({slotPallets.length})
                </h3>

                {slotPallets.length > 0 ? (
                  <div className="space-y-2">
                    {slotPallets.map((pallet) => (
                      <div key={pallet.id} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-mono text-sm">{pallet.palletNo}</span>
                          <span className={`text-xs ${palletStatusColors[pallet.status]}`}>
                            {palletStatusLabels[pallet.status]}
                          </span>
                        </div>
                        {pallet.sku && (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Tag size={12} />
                            <span>{pallet.sku}</span>
                          </div>
                        )}
                        {pallet.quantity !== undefined && (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Hash size={12} />
                            <span>{pallet.quantity} 件</span>
                          </div>
                        )}
                        {pallet.lastCheckTime && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar size={12} />
                            <span>{formatTimestamp(pallet.lastCheckTime)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm text-center py-6">
                    暂无托盘
                  </div>
                )}
              </div>

              {slotConflicts.length > 0 && (
                <div>
                  <h3 className="text-red-400 text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    冲突预警 ({slotConflicts.length})
                  </h3>
                  <div className="space-y-2">
                    {slotConflicts.map((conflict) => (
                      <div
                        key={conflict.id}
                        className={`rounded-lg p-3 text-sm ${
                          conflict.confirmed
                            ? 'bg-green-900/30 border border-green-700/50'
                            : 'bg-red-900/30 border border-red-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {conflict.confirmed ? (
                            <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                          ) : (
                            <XCircle size={14} className="text-red-400 flex-shrink-0" />
                          )}
                          <span className={conflict.confirmed ? 'text-green-300' : 'text-red-300'}>
                            {conflict.description}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-500 text-center py-12">
              <Package size={48} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm">点击货位查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
