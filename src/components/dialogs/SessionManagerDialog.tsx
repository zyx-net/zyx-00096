import { useState } from 'react';
import { X, Plus, FolderOpen, Archive, Edit3, Trash2, Clock, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatTimestamp } from '@/utils/export';
import type { ReviewSession } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SessionManagerDialog({ open, onClose }: Props) {
  const {
    sessions,
    activeSessionId,
    createSession,
    renameSession,
    archiveSession,
    unarchiveSession,
    deleteSession,
    restoreSession,
    getSessionUnconfirmedCount,
    addToast,
  } = useStore();

  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (!open) return null;

  const handleCreate = () => {
    const name = newSessionName.trim();
    if (!name) {
      addToast({ type: 'warning', message: '请输入会话名称' });
      return;
    }
    createSession(name);
    setNewSessionName('');
    setShowCreateInput(false);
  };

  const handleStartRename = (session: ReviewSession) => {
    setEditingId(session.id);
    setEditingName(session.name);
    setConfirmDelete(null);
  };

  const handleRename = (sessionId: string) => {
    const name = editingName.trim();
    if (!name) {
      addToast({ type: 'warning', message: '请输入会话名称' });
      return;
    }
    renameSession(sessionId, name);
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = (sessionId: string) => {
    deleteSession(sessionId);
    setConfirmDelete(null);
  };

  const handleRestore = (session: ReviewSession) => {
    restoreSession(session.id, 'full');
    onClose();
  };

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText size={22} className="text-blue-400" />
            复核会话管理
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-700/50">
          {showCreateInput ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="输入会话名称..."
                className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                创建
              </button>
              <button
                onClick={() => {
                  setShowCreateInput(false);
                  setNewSessionName('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateInput(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              保存当前状态为新会话
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {sortedSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FolderOpen size={48} className="mx-auto mb-3 opacity-50" />
              <p>暂无复核会话</p>
              <p className="text-sm mt-1">点击上方按钮保存当前状态</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSessions.map((session) => {
                const unconfirmed = getSessionUnconfirmedCount(session);
                const isActive = session.id === activeSessionId;
                const isArchived = session.status === 'archived';

                return (
                  <div
                    key={session.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-blue-900/30 border-blue-600/50'
                        : isArchived
                          ? 'bg-slate-800/50 border-slate-700/50 opacity-75'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {editingId === session.id ? (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1 bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 text-sm"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleRename(session.id)}
                            />
                            <button
                              onClick={() => handleRename(session.id)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-semibold truncate">{session.name}</h3>
                            {isActive && (
                              <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                                当前
                              </span>
                            )}
                            {isArchived && (
                              <span className="px-2 py-0.5 text-xs bg-slate-600/50 text-slate-400 rounded-full flex items-center gap-1">
                                <Archive size={10} />
                                已归档
                              </span>
                            )}
                          </div>
                        )}

                        <p className="text-slate-400 text-sm mb-3">
                          布局：{session.layoutName}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Clock size={12} />
                            <span>创建：{formatTimestamp(session.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Clock size={12} />
                            <span>最近：{formatTimestamp(session.lastOpenedAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-sm">
                            <AlertTriangle size={14} className="text-red-400" />
                            <span className="text-white font-mono">{session.conflicts.length}</span>
                            <span className="text-slate-400">总异常</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <AlertTriangle size={14} className="text-amber-400" />
                            <span className="text-amber-400 font-mono">{unconfirmed}</span>
                            <span className="text-slate-400">待确认</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <CheckCircle size={14} className="text-green-400" />
                            <span className="text-green-400 font-mono">{session.confirmedConflictIds.length}</span>
                            <span className="text-slate-400">已确认</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {confirmDelete === session.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-400 mr-1">确认删除？</span>
                            <button
                              onClick={() => handleDelete(session.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs"
                            >
                              是
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                            >
                              否
                            </button>
                          </div>
                        ) : (
                          <>
                            {!isActive && (
                              <button
                                onClick={() => handleRestore(session)}
                                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                title="恢复到当前看板"
                              >
                                <FolderOpen size={16} />
                              </button>
                            )}
                            {!isArchived ? (
                              <button
                                onClick={() => archiveSession(session.id)}
                                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                title="归档会话"
                              >
                                <Archive size={16} />
                              </button>
                            ) : (
                              <button
                                onClick={() => unarchiveSession(session.id)}
                                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                title="取消归档"
                              >
                                <FolderOpen size={16} />
                              </button>
                            )}
                            {!isArchived && (
                              <button
                                onClick={() => handleStartRename(session)}
                                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                title="重命名"
                              >
                                <Edit3 size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDelete(session.id)}
                              className="p-2 rounded-lg hover:bg-red-900/50 text-slate-400 hover:text-red-400 transition-colors"
                              title="删除会话"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
