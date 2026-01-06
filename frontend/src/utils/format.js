// 日期格式化
export function formatDate(date, format = 'full') {
  if (!date) return '-';
  const d = new Date(date);

  if (format === 'date') {
    return d.toLocaleDateString();
  }
  if (format === 'time') {
    return d.toLocaleTimeString();
  }
  return d.toLocaleString();
}

// 数字格式化
export function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

// 百分比格式化
export function formatPercent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

// 截断文本
export function truncate(text, length = 50) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

// 格式化文件大小
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
