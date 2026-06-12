import { Info } from 'lucide-react';

export default function Legend() {
  const slotStatuses = [
    { color: '#10b981', label: '正常占用' },
    { color: '#4b5563', label: '空置' },
    { color: '#ef4444', label: '冲突' },
    { color: '#3b82f6', label: '选中' },
  ];

  const palletStatuses = [
    { color: '#22c55e', label: '正常' },
    { color: '#f97316', label: '破损' },
    { color: '#ec4899', label: '过期' },
    { color: '#8b5cf6', label: '未知' },
  ];

  return (
    <div className="absolute bottom-28 left-4 z-10">
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-lg p-3 text-xs">
        <div className="flex items-center gap-1.5 mb-2 text-slate-300">
          <Info size={12} />
          <span className="font-medium">状态图例</span>
        </div>
        <div className="space-y-1.5">
          <div className="text-slate-500 text-[10px] uppercase tracking-wide">货位</div>
          <div className="flex gap-3">
            {slotStatuses.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-slate-300">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wide mt-2">托盘</div>
          <div className="flex gap-3">
            {palletStatuses.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-slate-300">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
