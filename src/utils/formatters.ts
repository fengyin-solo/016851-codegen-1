/**
 * 格式化时间戳为相对时间
 * @param timestamp 时间戳（毫秒）
 * @returns 相对时间字符串
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) {
    return '刚刚';
  }
  
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }
  
  if (hours < 24) {
    return `${hours} 小时前`;
  }
  
  if (days < 7) {
    return `${days} 天前`;
  }
  
  // 超过 7 天显示具体日期
  return formatDate(timestamp);
}

/**
 * 格式化时间戳为日期字符串
 * @param timestamp 时间戳（毫秒）
 * @returns 日期字符串
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间戳为完整日期时间字符串
 * @param timestamp 时间戳（毫秒）
 * @returns 日期时间字符串
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 格式化响应时间
 * @param ms 毫秒数
 * @returns 格式化的时间字符串
 */
export function formatResponseTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * 格式化 Token 数量
 * @param count Token 数量
 * @returns 格式化的字符串
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) {
    return String(count);
  }
  
  if (count < 1000000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  
  return `${(count / 1000000).toFixed(2)}M`;
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化的大小字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 截断文本
 * @param text 原始文本
 * @param maxLength 最大长度
 * @param suffix 后缀（默认 ...）
 * @returns 截断后的文本
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 从消息内容生成对话标题
 * @param content 消息内容
 * @param maxLength 最大长度
 * @returns 生成的标题
 */
export function generateConversationTitle(content: string, maxLength: number = 30): string {
  if (!content) {
    return '新对话';
  }
  
  // 移除 Markdown 语法
  const plainText = content
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`[^`]+`/g, '') // 移除行内代码
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留文本
    .replace(/[#*_~]/g, '') // 移除 Markdown 标记
    .replace(/\n+/g, ' ') // 换行替换为空格
    .trim();
  
  return truncateText(plainText, maxLength) || '新对话';
}

/**
 * 格式化数字（添加千位分隔符）
 * @param num 数字
 * @returns 格式化的字符串
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}
