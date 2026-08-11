export function formatCountdown(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);

  const totalHours = days * 24 + hours;
  const total =
    totalHours > 0
      ? `${totalHours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return `${parts.join('')}｜${total}`;
}

export function countdownPrefix(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);

  return parts.join('');
}

export function getCountdownText(targetDate: string): string {
  const now = Date.now();
  const target = new Date(targetDate).getTime();
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  return formatCountdown(diff);
}

export function isOverdue(targetDate: string): boolean {
  return new Date(targetDate).getTime() <= Date.now();
}
