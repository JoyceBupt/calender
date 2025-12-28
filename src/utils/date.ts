export function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODateLocal(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function getTodayISODateLocal(): string {
  return toISODateLocal(new Date());
}

export function addDaysISODateLocal(isoDate: string, days: number): string {
  const date = parseISODateLocal(isoDate);
  date.setDate(date.getDate() + days);
  return toISODateLocal(date);
}

export function addMonthsISODateLocal(isoDate: string, months: number): string {
  const date = parseISODateLocal(isoDate);
  date.setMonth(date.getMonth() + months);
  return toISODateLocal(date);
}

export function getMonthStartISODateLocal(isoDate: string): string {
  const date = parseISODateLocal(isoDate);
  date.setDate(1);
  return toISODateLocal(date);
}

export function getWeekStartISODateLocal(
  isoDate: string,
  firstDay: number = 1, // 1=周一
): string {
  const date = parseISODateLocal(isoDate);
  const weekday = date.getDay(); // 0=周日
  const diff = (weekday - firstDay + 7) % 7;
  date.setDate(date.getDate() - diff);
  return toISODateLocal(date);
}
