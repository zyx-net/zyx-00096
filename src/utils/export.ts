import type { Conflict, ReviewLogEntry, ReviewSession, LogActionType } from '@/types';
import { getConflictTypeLabel } from './conflict';

interface BatchInfo {
  batchId: string;
  batchName: string | null;
  isPreview: boolean;
  batchCreatedAt: string | null;
}

export function exportConflictsToCSV(conflicts: Conflict[], batchInfo?: BatchInfo | null): string {
  const headers = ['序号', '冲突类型', '描述', '相关ID', '是否已确认', '确认时间', '导入批次ID', '批次名称', '是否预览标记', '批次生成时间'];
  const rows = conflicts.map((c, index) => [
    index + 1,
    getConflictTypeLabel(c.type),
    c.description,
    c.relatedIds.join('; '),
    c.confirmed ? '是' : '否',
    c.confirmedAt || '-',
    batchInfo?.batchId || '-',
    batchInfo?.batchName || '-',
    batchInfo ? (batchInfo.isPreview ? '是（导入前预览）' : '否（已应用）') : '-',
    batchInfo?.batchCreatedAt ? new Date(batchInfo.batchCreatedAt).toLocaleString('zh-CN', { hour12: false }) : '-',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return '\uFEFF' + csvContent;
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatTimestamp(date?: Date | string): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getLogActionLabel(action: LogActionType): string {
  const map: Record<LogActionType, string> = {
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
    create_review: '生成复盘',
    export_review_json: '导出复盘JSON',
    export_review_csv: '导出复盘CSV',
    import_review: '导入复盘',
    apply_review: '应用复盘',
    undo_review: '撤销复盘',
    create_inspection_draft: '创建巡检草稿',
    update_inspection_draft: '更新巡检草稿',
    publish_inspection: '发布巡检任务',
    undo_publish_inspection: '撤销发布巡检',
    export_inspection_json: '导出巡检JSON',
    import_inspection: '导入巡检',
    apply_inspection_import: '应用巡检导入',
    clear_inspection_draft: '清除巡检草稿',
  };
  return map[action] || action;
}

export function exportLogsToCSV(logs: ReviewLogEntry[], session?: ReviewSession | null): string {
  const headers = ['序号', '时间', '操作类型', '操作描述', '会话ID', '会话名称', '元数据'];
  const rows = logs.map((log, index) => [
    index + 1,
    formatTimestamp(log.timestamp),
    getLogActionLabel(log.action),
    log.description,
    log.sessionId,
    session?.name || '-',
    log.metadata ? JSON.stringify(log.metadata) : '-',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return '\uFEFF' + csvContent;
}

export function exportSessionToCSV(session: ReviewSession): { conflictsCSV: string; logsCSV: string } {
  const batchInfo = {
    batchId: session.id,
    batchName: session.name,
    isPreview: false,
    batchCreatedAt: session.createdAt,
  };
  const conflictsCSV = exportConflictsToCSV(session.conflicts, batchInfo);
  const logsCSV = exportLogsToCSV(session.logs, session);
  return { conflictsCSV, logsCSV };
}
