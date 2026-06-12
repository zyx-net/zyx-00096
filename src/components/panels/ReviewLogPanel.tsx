import { ScrollText, X, CheckCircle, XCircle, Upload, Undo2, FolderOpen, Plus, Edit3, Archive, Download } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatTimestamp } from '@/utils/export';
import type { LogActionType, ReviewLogEntry } from '@/types';

const actionLabels: Record<LogActionType, string> = {
  confirm_conflict: '确认异常',
  unconfirm_conflict: '撤销确认',
  apply_import: '导入应用',
  undo_import: '撤销导入',
  restore_session: '会话恢复',
  create_session: '创建会话',
  rename_session: '重命名会话',
  archive_session: '归档会话',
  unarchive_session: '取消归档',
  export_csv: '导出CSV',
};

const actionIcons: Record<LogActionType, typeof CheckCircle> = {
  confirm_conflict: CheckCircle,
  unconfirm_conflict: XCircle,
  apply_import: Upload,
  undo_import: Undo2,
  restore_session: FolderOpen,
  create_session: Plus,
  rename_session: Edit3,
  archive_session: Archive,
  unarchive_session: Archive,
  export_csv: Download,
};

const actionColors: Record<LogActionType, string> = {
  confirm_conflict: 'text-green-400 bg-green-900/30',
  unconfirm_conflict: 'text-amber-400 bg-amber-900/30',
  apply_import: 'text-blue-400 bg-blue-900/30',
  undo_import: 'text-orange-400 bg-orange-900/30',
  restore_session: 'text-cyan-400 bg-cyan-900/30',
  create_session: 'text-emerald-400 bg-emerald-900/30',
  rename_session: 'text-purple-400 bg-purple-900/30',
  archive_session: 'text-slate-400 bg-slate-700/50',
  unarchive_session: 'text-teal-400 bg-teal-900/30',
  export_csv: 'text-pink-400 bg-pink-900/30',
};

export default function ReviewLogPanel() {
  const { logPanelOpen, setLogPanelOpen, getActiveSession } = useStore();
  const activeSession = getActiveSession();

  if (!logPanelOpen) return null;

  const logs = activeSession?.logs ?? [];
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getIcon = (action: LogActionType) => {
    const Icon = actionIcons[action] || ScrollText;
    return Icon;
  };

  return (
    <div className="fixed right-4 bottom-24 w-96 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-96">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <ScrollText size={18} className="text-blue-400" />
          复核日志
          {activeSession && (
            <span className="text-xs text-slate-400 font-normal">
              - {activeSession.name}
            </span>
          )}
        </h3>
        <button
          onClick={() => setLogPanelOpen(false)}
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <ScrollText size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无操作日志</p>
            <p className="text-xs mt-1">
              {activeSession ? '当前会话的操作将记录在这里' : '创建或恢复会话后开始记录'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {sortedLogs.map((log: ReviewLogEntry) => {
              const Icon = getIcon(log.action);
              const colorClass = actionColors[log.action] || 'text-slate-400 bg-slate-700/30';
              return (
                <div key={log.id} className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-medium">
                          {actionLabels[log.action] || log.action}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm">{log.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/30 text-xs text-slate-400">
        共 {sortedLogs.length} 条记录
      </div>
    </div>
  );
}
