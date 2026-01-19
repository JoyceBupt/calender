import { Solar } from 'lunar-typescript';

export interface LunarInfo {
  /** 农历日，如 "初一"、"十五" */
  day: string;
  /** 农历月，如 "正月"、"腊月" */
  month: string;
  /** 节气，如 "立春"、"小暑"，无则为 null */
  solarTerm: string | null;
  /** 传统节日，如 "春节"、"中秋节"，无则为 null */
  festival: string | null;
}

/**
 * 获取指定公历日期的农历信息
 * @param year 公历年
 * @param month 公历月 (1-12)
 * @param day 公历日
 */
export function getLunarInfo(year: number, month: number, day: number): LunarInfo {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();

  // 获取节气
  const jieQi = lunar.getJieQi();
  const solarTerm = jieQi || null;

  // 获取节日（优先农历节日，其次公历节日）
  const lunarFestivals = lunar.getFestivals();
  const solarFestivals = solar.getFestivals();
  const festival = lunarFestivals[0] || solarFestivals[0] || null;

  return {
    day: lunar.getDayInChinese(),
    month: lunar.getMonthInChinese() + '月',
    solarTerm,
    festival,
  };
}

/**
 * 获取日期单元格显示的农历文本
 * 优先级：节日 > 节气 > 农历日
 */
export function getLunarDayText(year: number, month: number, day: number): string {
  const info = getLunarInfo(year, month, day);

  // 节日优先
  if (info.festival) {
    return info.festival;
  }

  // 节气次之
  if (info.solarTerm) {
    return info.solarTerm;
  }

  // 农历日（初一显示月份）
  if (info.day === '初一') {
    return info.month;
  }

  return info.day;
}

/**
 * 判断是否为特殊日期（节日或节气）
 */
export function isSpecialLunarDay(year: number, month: number, day: number): boolean {
  const info = getLunarInfo(year, month, day);
  return !!(info.festival || info.solarTerm);
}
