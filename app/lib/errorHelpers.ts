import { ApiError } from './api'

export function getApiErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return '网络或服务器错误'

  const errorMessages: Record<string, string> = {
    NOT_FOUND: '找不到该习惯',
    HABIT_ARCHIVED: '这个习惯已归档',
    FUTURE_DATE: '不能补打卡未来日期',
    ALREADY_DONE: '该日期已有打卡记录',
    BEFORE_START_DATE: '不能在开始日期之前打卡',
  }

  return errorMessages[err.code] || `请求失败：${err.code}`
}
