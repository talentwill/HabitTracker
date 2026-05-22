import { useCallback, useEffect, useState } from 'react'

import HabitRow from '../components/HabitRow'
import { ApiError } from '../lib/api'
import type { Habit } from '../lib/api'
import * as api from '../lib/api'
import { todayDateOnly } from '../lib/date'

function errorText(err: unknown): string {
  if (!(err instanceof ApiError)) return '网络或服务器错误'
  return `请求失败：${err.code}`
}

export default function ArchivedPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const today = todayDateOnly()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.listHabits({ archived: true })
      setHabits(res.habits)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function restore(id: string) {
    setBusy(id)
    setError(null)
    try {
      await api.updateHabit(id, { archived: 0 })
      await load()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('确定要删除吗？这会同时删除历史记录，无法恢复。')) return
    setBusy(id)
    setError(null)
    try {
      await api.deleteHabit(id)
      await load()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="pb-16 sm:pb-0">
      <h1 className="section-title mb-4">归档 · {habits.length}</h1>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="paper px-4 py-4 text-[14px] text-muted">加载中…</div>
      ) : habits.length === 0 ? (
        <div className="paper px-5 py-6 text-[14px] text-muted">
          暂无归档习惯
        </div>
      ) : (
        <div className="grid gap-1.5">
          {habits.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              today={today}
              busy={busy === h.id}
              variant="archived"
              onEdit={() => void restore(h.id)}
              onDone={() => {}}
              onPush={() => {}}
              onSkip={() => void remove(h.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
