import type { Conflict } from '@/types';
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
