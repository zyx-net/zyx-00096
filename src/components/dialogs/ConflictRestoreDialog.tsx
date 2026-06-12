import { AlertTriangle, Eye, CheckCircle, X } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function ConflictRestoreDialog() {
  const { conflictRestoreDialog, _restoreSessionInternal, setConflictRestoreDialog } = useStore();

  if (!conflictRestoreDialog?.open || !conflictRestoreDialog.session || !conflictRestoreDialog.conflicts) {
    return null;
  }

  const { session, conflicts } = conflictRestoreDialog;

  const handleViewOnly = () => {
    _restoreSessionInternal(session, 'view_only', conflicts);
    setConflictRestoreDialog(null);
  };

  const handleCancel = () => {
    setConflictRestoreDialog(null);
  };

  const hasMissing = conflicts.missingSlotIds.length > 0 || conflicts.missingPalletIds.length > 0;
  const hasExtra = conflicts.extraSlotIds.length > 0 || conflicts.extraPalletIds.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-amber-700/50 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-amber-900/20">
          <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            <AlertTriangle size={22} />
            布局不匹配警告
          </h2>
          <button
            onClick={handleCancel}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-300 mb-4">
            会话 <span className="text-white font-semibold">"{session.name}"</span> 创建时的布局与当前仓库布局不一致。
            强行恢复可能导致数据错乱，请选择恢复方式：
          </p>

          <div className="space-y-3 mb-6">
            {hasMissing && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                <h4 className="text-red-400 font-medium mb-2 flex items-center gap-1.5">
                  <X size={16} />
                  会话中存在但当前已缺失
                </h4>
                {conflicts.missingSlotIds.length > 0 && (
                  <p className="text-sm text-red-300 mb-1">
                    货位 ({conflicts.missingSlotIds.length} 个)：
                    <span className="font-mono ml-1">
                      {conflicts.missingSlotIds.slice(0, 5).join(', ')}
                      {conflicts.missingSlotIds.length > 5 ? '...' : ''}
                    </span>
                  </p>
                )}
                {conflicts.missingPalletIds.length > 0 && (
                  <p className="text-sm text-red-300">
                    托盘 ({conflicts.missingPalletIds.length} 个)：
                    <span className="font-mono ml-1">
                      {conflicts.missingPalletIds.slice(0, 5).join(', ')}
                      {conflicts.missingPalletIds.length > 5 ? '...' : ''}
                    </span>
                  </p>
                )}
              </div>
            )}

            {hasExtra && (
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <h4 className="text-blue-400 font-medium mb-2 flex items-center gap-1.5">
                  <CheckCircle size={16} />
                  当前存在但会话中没有
                </h4>
                {conflicts.extraSlotIds.length > 0 && (
                  <p className="text-sm text-blue-300 mb-1">
                    货位 ({conflicts.extraSlotIds.length} 个)：
                    <span className="font-mono ml-1">
                      {conflicts.extraSlotIds.slice(0, 5).join(', ')}
                      {conflicts.extraSlotIds.length > 5 ? '...' : ''}
                    </span>
                  </p>
                )}
                {conflicts.extraPalletIds.length > 0 && (
                  <p className="text-sm text-blue-300">
                    托盘 ({conflicts.extraPalletIds.length} 个)：
                    <span className="font-mono ml-1">
                      {conflicts.extraPalletIds.slice(0, 5).join(', ')}
                      {conflicts.extraPalletIds.length > 5 ? '...' : ''}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleViewOnly}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <Eye size={18} />
              仅恢复视角和筛选条件（推荐）
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
            >
              取消恢复
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
