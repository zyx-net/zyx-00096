import type { Conflict } from '@/types';
import { getConflictTypeLabel } from './conflict';

export function exportConflictsToCSV(conflicts: Conflict[]): string {
  const headers = ['序号', '冲突类型', '描述', '相关ID', '是否已确认', '确认时间'];
  const rows = conflicts.map((c, index) => [
    index + 1,
    getConflictTypeLabel(c.type),
    c.description,
    c.relatedIds.join('; '),
    c.confirmed ? '是' : '否',
    c.confirmedAt || '-',
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
