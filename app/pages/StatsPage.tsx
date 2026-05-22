import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ApiError } from '../lib/api'
import type { Habit, HabitEvent, StatsSummary } from '../lib/api'
import * as api from '../lib/api'
import { diffDays, todayDateOnly } from '../lib/date'
import { tagColor } from '../components/TagInput'

function errorText(err: unknown): string {
  if (!(err instanceof ApiError)) return '网络或服务器错误'
  return `请求失败：${err.code}`
}

type HabitStats = {
  id: string
  title: string
  tag: string | null
  doneCount: number
  totalCount: number
  completionRate: number
  longestStreak: number
}

type TagStats = {
  tag: string
  habitCount: number
  avgCompletionRate: number
}

export default function StatsPage() {
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitStatsList, setHabitStatsList] = useState<HabitStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = summary?.today ?? todayDateOnly()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sRes, hRes] = await Promise.all([
        api.summary(),
        api.listHabits({ archived: false }),
      ])
      setSummary(sRes)
      setHabits(hRes.habits)

      // Compute per-habit stats from events
      const statsPromises = hRes.habits.map(async (h) => {
        let events: HabitEvent[] = []
        try {
          const eRes = await api.habitEvents(h.id)
          events = eRes.events
        } catch {}

        const doneEvents = events
          .filter((e) => e.action === 'done')
          .sort((a, b) => (a.actionDate < b.actionDate ? -1 : 1))
        const doneCount = doneEvents.length

        // Total expected check-ins: from createdAt to today
        const createdDate = h.createdAt.slice(0, 10)
        const totalDays = diffDays(createdDate, today)
        const totalIntervals = Math.max(
          1,
          Math.ceil((totalDays + 1) / h.intervalDays)
        )
        const completionRate =
          totalIntervals > 0
            ? Math.round((doneCount / totalIntervals) * 100)
            : 0

        // Longest streak
        let longestStreak = 0
        let currentStreak = 0
        for (let i = 0; i < doneEvents.length; i++) {
          if (i === 0) {
            currentStreak = 1
          } else {
            const gap = diffDays(
              doneEvents[i - 1]!.actionDate,
              doneEvents[i]!.actionDate
            )
            currentStreak = gap <= h.intervalDays ? currentStreak + 1 : 1
          }
          longestStreak = Math.max(longestStreak, currentStreak)
        }

        return {
          id: h.id,
          title: h.title,
          tag: h.tag,
          doneCount,
          totalCount: totalIntervals,
          completionRate: Math.min(completionRate, 100),
          longestStreak,
        }
      })

      const stats = await Promise.all(statsPromises)
      setHabitStatsList(stats)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Aggregate stats
  const totalCheckins = useMemo(
    () => habitStatsList.reduce((s, h) => s + h.doneCount, 0),
    [habitStatsList]
  )
  const totalHabits = habits.length
  const avgCompletionRate = useMemo(() => {
    if (habitStatsList.length === 0) return 0
    return Math.round(
      habitStatsList.reduce((s, h) => s + h.completionRate, 0) /
        habitStatsList.length
    )
  }, [habitStatsList])
  const longestStreak = useMemo(() => {
    return Math.max(0, ...habitStatsList.map((h) => h.longestStreak))
  }, [habitStatsList])

  // Ranked habits by completion rate
  const rankedHabits = useMemo(() => {
    return [...habitStatsList].sort(
      (a, b) => b.completionRate - a.completionRate
    )
  }, [habitStatsList])

  // Tag stats
  const tagStats = useMemo((): TagStats[] => {
    const map = new Map<string, HabitStats[]>()
    for (const h of habitStatsList) {
      const key = h.tag || ''
      const list = map.get(key) || []
      list.push(h)
      map.set(key, list)
    }
    return Array.from(map.entries())
      .map(([tag, items]) => ({
        tag: tag || '未分类',
        habitCount: items.length,
        avgCompletionRate: Math.round(
          items.reduce((s, h) => s + h.completionRate, 0) / items.length
        ),
      }))
      .sort((a, b) => b.avgCompletionRate - a.avgCompletionRate)
  }, [habitStatsList])

  const sortedRecentEvents = useMemo(() => {
    return [...(summary?.recentEvents ?? [])].sort((a, b) => {
      const dateCompare = b.actionDate.localeCompare(a.actionDate)
      if (dateCompare !== 0) return dateCompare
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [summary])

  return (
    <div className="pb-16 sm:pb-0 max-w-[800px] mx-auto">
      <h1 className="section-title mb-4">📊 统计</h1>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[14px] sm:text-[12px] text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="paper px-4 py-4 text-[14px] text-muted">加载中…</div>
      ) : (
        <>
          {/* Core Stats - 4 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            <div className="rounded-lg bg-warm-white px-3 py-3">
              <div className="text-[15px] sm:text-[11px] font-semibold text-muted-light">
                总打卡次数
              </div>
              <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
                {totalCheckins}
              </div>
            </div>
            <div className="rounded-lg bg-warm-white px-3 py-3">
              <div className="text-[15px] sm:text-[11px] font-semibold text-muted-light">
                总习惯数
              </div>
              <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
                {totalHabits}
              </div>
            </div>
            <div className="rounded-lg bg-warm-white px-3 py-3">
              <div className="text-[15px] sm:text-[11px] font-semibold text-muted-light">
                平均完成率
              </div>
              <div
                className="mt-0.5 text-[22px] font-bold tracking-[-0.25px]"
                style={{
                  color:
                    avgCompletionRate >= 70
                      ? '#43a047'
                      : avgCompletionRate >= 40
                        ? '#f57c00'
                        : '#ef5350',
                }}
              >
                {avgCompletionRate}%
              </div>
            </div>
            <div className="rounded-lg bg-warm-white px-3 py-3">
              <div className="text-[15px] sm:text-[11px] font-semibold text-muted-light">
                最长连续天数
              </div>
              <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
                {longestStreak}
              </div>
            </div>
          </div>

          {/* Habit Ranking */}
          <div className="mb-5">
            <div className="text-[16px] font-semibold text-ink mb-2">
              习惯排行
            </div>
            <div className="rounded-lg border border-line bg-paper overflow-hidden">
              {rankedHabits.length === 0 ? (
                <div className="px-3.5 py-3 text-[14px] text-muted">
                  暂无数据
                </div>
              ) : (
                rankedHabits.map((h, i) => (
                  <div
                    key={h.id}
                    className={clsx(
                      'flex items-center gap-3 px-3.5 py-2.5',
                      i < rankedHabits.length - 1 && 'border-b border-line'
                    )}
                  >
                    <span
                      className={clsx(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[14px] sm:text-[10px] font-bold shrink-0',
                        i === 0
                          ? 'bg-[#fff3e0] text-[#f57c00]'
                          : i === 1
                            ? 'bg-[#ede7f6] text-[#7e57c2]'
                            : i === 2
                              ? 'bg-[#e8f5e9] text-[#43a047]'
                              : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[16px] sm:text-[12px] font-medium text-ink truncate">
                          {h.title}
                        </span>
                        <span className="text-[14px] sm:text-[10px] text-gray-400">
                          {h.doneCount}次
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${h.completionRate}%`,
                            background:
                              h.completionRate >= 70
                                ? '#43a047'
                                : h.completionRate >= 40
                                  ? '#f57c00'
                                  : '#ef5350',
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className={clsx(
                        'text-[16px] sm:text-[12px] font-semibold shrink-0',
                        h.completionRate >= 70
                          ? 'text-[#43a047]'
                          : h.completionRate >= 40
                            ? 'text-[#f57c00]'
                            : 'text-[#ef5350]'
                      )}
                    >
                      {h.completionRate}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tag Statistics */}
          {tagStats.length > 0 && (
            <div className="mb-5">
              <div className="text-[16px] font-semibold text-ink mb-2">
                标签统计
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {tagStats.map((t) => {
                  const c = tagColor(t.tag)
                  return (
                    <div
                      key={t.tag}
                      className="rounded-lg border border-line bg-paper px-3 py-2.5"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: c.color }}
                        />
                        <span className="text-[16px] sm:text-[12px] font-semibold text-ink truncate">
                          {t.tag}
                        </span>
                        <span className="text-[14px] sm:text-[10px] text-gray-400 ml-auto">
                          {t.habitCount}个
                        </span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${t.avgCompletionRate}%`,
                            background: c.color,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <div className="text-[14px] sm:text-[10px] text-gray-400 mt-0.5">
                        平均完成率 {t.avgCompletionRate}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Events */}
          <div>
            <div className="text-[16px] font-semibold text-ink mb-2">
              最近动态
            </div>
            <div className="rounded-lg border border-line bg-paper overflow-hidden">
              {sortedRecentEvents.length ? (
                sortedRecentEvents.map((e, i) => {
                  const habit = habits.find((h) => h.id === e.habit.id)
                  const tag = habit?.tag
                  return (
                    <div
                      key={e.id}
                      className={clsx(
                        'flex items-center gap-2 px-3.5 py-2 text-[16px] sm:text-[12px]',
                        i < sortedRecentEvents.length - 1 &&
                          'border-b border-line'
                      )}
                    >
                      <span
                        className={clsx(
                          'rounded px-1.5 py-0.5 text-[14px] sm:text-[10px] font-semibold',
                          e.action === 'done' && 'bg-[#e8f5e9] text-[#43a047]',
                          e.action === 'skip' && 'bg-[#fff3e0] text-[#f57c00]',
                          e.action === 'push' && 'bg-warm-white text-muted'
                        )}
                      >
                        {e.action === 'done'
                          ? '打卡'
                          : e.action === 'push'
                            ? '推迟'
                            : '跳过'}
                      </span>
                      <span className="font-medium text-ink">
                        {e.habit.title}
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        {tag && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full border opacity-70"
                            style={{
                              borderColor: tagColor(tag).color,
                              color: tagColor(tag).color,
                              backgroundColor: tagColor(tag).backgroundColor,
                            }}
                          >
                            {tag}
                          </span>
                        )}
                        <span className="text-muted-light">{e.actionDate}</span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="px-3.5 py-3 text-[14px] text-muted">
                  暂无记录
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
