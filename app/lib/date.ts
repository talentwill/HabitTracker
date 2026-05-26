function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// 使用浏览器本地时区，支持全球任意地点打卡
export function nowInLocal(): Date {
  return new Date();
}

export function todayDateOnly(): string {
  const d = nowInLocal();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function compareDateOnly(a: string, b: string): number {
  // Works for YYYY-MM-DD.
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function statusForDue(
  nextDueDate: string,
  today = todayDateOnly()
): "overdue" | "today" | "upcoming" {
  const cmp = compareDateOnly(nextDueDate, today);
  if (cmp < 0) return "overdue";
  if (cmp === 0) return "today";
  return "upcoming";
}

export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map((v) => Number(v));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function diffDays(a: string, b: string): number {
  const ms = parseDateOnly(b).getTime() - parseDateOnly(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function upcomingGroup(nextDueDate: string, today: string): string {
  const d = diffDays(today, nextDueDate);
  if (d <= 1) return "明天";
  if (d === 2) return "后天";
  const dueDate = parseDateOnly(nextDueDate);
  const todayDate = parseDateOnly(today);
  const endOfWeek = new Date(todayDate);
  const dow = todayDate.getDay();
  const daysToSun = dow === 0 ? 0 : 7 - dow;
  endOfWeek.setDate(endOfWeek.getDate() + daysToSun);
  if (dueDate <= endOfWeek) return "本周";
  return "以后";
}

export const UPCOMING_GROUP_ORDER = ["明天", "后天", "本周", "以后"];
