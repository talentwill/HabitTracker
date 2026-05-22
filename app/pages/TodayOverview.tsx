import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import FilterTabs from '../components/FilterTabs'
import type { FilterTab } from '../components/FilterTabs'
import HabitCard from '../components/HabitCard'
import HabitDetailPanel from '../components/desktop/HabitDetailPanel'
import EmojiPicker from '../components/EmojiPicker'
import Modal from '../components/Modal'
import MobileHabitSheet from '../components/mobile/MobileHabitSheet'
import TagInput from '../components/TagInput'
import type { Habit, HabitEvent, StatsSummary } from '../lib/api'
import * as api from '../lib/api'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useTodayFilter } from '../contexts/TodayFilterContext'
import { getApiErrorMessage } from '../lib/errorHelpers'
import {
  statusForDue,
  todayDateOnly,
  upcomingGroup,
  UPCOMING_GROUP_ORDER,
} from '../lib/date'
import { getFirstTextChar } from '../lib/utils'

type HabitDraft = {
  id?: string
  title: string
  note: string
  intervalDays: number
  startDate: string
  archived?: boolean
  tag: string
  icon: string
}

function sortByDue(a: Habit, b: Habit, today: string) {
  const cA = statusForDue(a.nextDueDate, today)
  const cB = statusForDue(b.nextDueDate, today)
  const order = { overdue: 0, today: 1, upcoming: 2 }
  const diff = (order[cA] ?? 2) - (order[cB] ?? 2)
  if (diff !== 0) return diff

  if (a.nextDueDate !== b.nextDueDate) {
    return a.nextDueDate.localeCompare(b.nextDueDate)
  }
  return a.createdAt < b.createdAt ? 1 : -1
}

const LEFT_MIN = 380
const RIGHT_MIN = 400

export default function TodayOverview() {
  const [searchParams] = useSearchParams()
  const tagFilter = searchParams.get('tag')
  const [habits, setHabits] = useState<Habit[]>([])
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'card'>(
    () => (localStorage.getItem('viewMode') as 'list' | 'card') || 'card'
  )
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [selectedHabitId, setSelectedHabitIdRaw] = useState<string | null>(
    () =>
      typeof window !== 'undefined' && window.innerWidth >= 640
        ? window.location.hash.slice(1) || null
        : null
  )
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === 'undefined' || window.innerWidth < 640) return 380
    return Math.max(LEFT_MIN, Math.floor(window.innerWidth / 2))
  })
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  function setSelectedHabitId(id: string | null) {
    setSelectedHabitIdRaw(id)
    window.location.hash = id ?? ''
  }
  const isDesktop = useIsDesktop()
  const todayFilter = useTodayFilter()

  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<HabitDraft | null>(null)
  const editing = Boolean(draft?.id)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDeleteHabit, setConfirmDeleteHabit] = useState(false)

  const today = summary?.today ?? todayDateOnly()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [hRes, sRes, tRes] = await Promise.all([
        api.listHabits({ archived: false }),
        api.summary(),
        api.listTags(),
      ])
      setHabits(hRes.habits)
      setSummary(sRes)
      setAllTags(tRes.tags.map((t) => t.name))
      // Default select first habit on desktop only
      if (
        window.innerWidth >= 640 &&
        !window.location.hash.slice(1) &&
        hRes.habits.length > 0
      ) {
        setSelectedHabitId(hRes.habits[0]!.id)
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
      setDetailRefreshKey((k) => k + 1)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (todayFilter && today) {
      todayFilter.setFilter({ filterTab, habits, today })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTab, habits, today])

  const filteredHabits = useMemo(() => {
    let list = habits

    if (filterTab === 'todo') {
      list = list.filter(
        (h) =>
          statusForDue(h.nextDueDate, today) === 'today' ||
          statusForDue(h.nextDueDate, today) === 'overdue'
      )
    } else if (filterTab === 'upcoming') {
      list = list.filter(
        (h) =>
          statusForDue(h.nextDueDate, today) === 'upcoming' &&
          h.lastDoneDate !== today
      )
    } else if (filterTab === 'done') {
      list = list.filter((h) => h.lastDoneDate === today)
    }

    if (tagFilter) {
      list = list.filter((h) => h.tag === tagFilter)
    }

    return [...list].sort((a, b) => sortByDue(a, b, today))
  }, [habits, today, filterTab, tagFilter])

  const groupedHabits = useMemo(() => {
    if (filterTab === 'todo') {
      const todayList = filteredHabits.filter(
        (h) => statusForDue(h.nextDueDate, today) === 'today'
      )
      const overdueList = filteredHabits.filter(
        (h) => statusForDue(h.nextDueDate, today) === 'overdue'
      )
      const groups: { label: string; habits: Habit[] }[] = []
      if (todayList.length > 0)
        groups.push({ label: '今日到期', habits: todayList })
      if (overdueList.length > 0)
        groups.push({ label: '已逾期', habits: overdueList })
      return groups
    }

    if (filterTab === 'upcoming') {
      const groups = new Map<string, Habit[]>()
      for (const h of filteredHabits) {
        const g = upcomingGroup(h.nextDueDate, today)
        if (!groups.has(g)) groups.set(g, [])
        groups.get(g)!.push(h)
      }
      return UPCOMING_GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
        label: g,
        habits: groups.get(g)!,
      }))
    }

    if (!tagFilter) {
      const groups = new Map<string, Habit[]>()
      for (const h of filteredHabits) {
        const t = h.tag || '未分类'
        if (!groups.has(t)) groups.set(t, [])
        groups.get(t)!.push(h)
      }
      return [...groups.entries()].map(([label, habits]) => ({ label, habits }))
    }

    return [{ label: '', habits: filteredHabits }]
  }, [filteredHabits, today, filterTab, tagFilter])

  function handleViewChange() {
    const next = viewMode === 'card' ? 'list' : 'card'
    setViewMode(next)
    localStorage.setItem('viewMode', next)
  }

  async function openCreate() {
    setDraft({
      title: '',
      note: '',
      intervalDays: 1,
      startDate: today,
      tag: '',
      icon: '',
    })
    // Refresh tags before opening modal
    try {
      const tRes = await api.listTags()
      setAllTags(tRes.tags.map((t) => t.name))
    } catch {
      // Ignore tag fetch errors
    }
    setModalOpen(true)
  }

  async function openEdit(h: Habit) {
    setDraft({
      id: h.id,
      title: h.title,
      note: h.note,
      intervalDays: h.intervalDays,
      startDate: h.startDate,
      tag: h.tag ?? '',
      icon: h.icon ?? '',
    })
    // Refresh tags before opening modal
    try {
      const tRes = await api.listTags()
      setAllTags(tRes.tags.map((t) => t.name))
    } catch {
      // Ignore tag fetch errors
    }
    setModalOpen(true)
  }

  async function saveHabit() {
    if (!draft) return
    setBusy('modal')
    setError(null)
    try {
      const safeInterval = draft.intervalDays || 1
      if (draft.id) {
        await api.updateHabit(draft.id, {
          title: draft.title,
          note: draft.note,
          intervalDays: safeInterval,
          startDate: draft.startDate,
          tag: draft.tag,
          icon: draft.icon,
        })
      } else {
        await api.createHabit({
          title: draft.title,
          note: draft.note,
          intervalDays: safeInterval,
          startDate: draft.startDate,
          tag: draft.tag || undefined,
          icon: draft.icon || undefined,
        })
      }
      setModalOpen(false)
      setDraft(null)
      await loadAll()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function archiveHabit() {
    setConfirmArchive(true)
  }

  async function performArchive() {
    if (!draft?.id) return
    setBusy('modal')
    setError(null)
    try {
      await api.updateHabit(draft.id, { archived: 1 })
      setConfirmArchive(false)
      setModalOpen(false)
      setDraft(null)
      setSelectedHabitId(null)
      await loadAll()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function deleteHabit() {
    setConfirmDeleteHabit(true)
  }

  async function performDelete() {
    if (!draft?.id) return
    setBusy('modal')
    setError(null)
    try {
      await api.deleteHabit(draft.id)
      setConfirmDeleteHabit(false)
      setModalOpen(false)
      setDraft(null)
      setSelectedHabitId(null)
      await loadAll()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function act(id: string, kind: 'done' | 'push' | 'skip') {
    setBusy(id)
    setError(null)
    try {
      let updated: Habit | undefined
      if (kind === 'done') {
        const h = habits.find((h) => h.id === id)
        if (h && h.lastDoneDate === today) {
          const eRes = await api.habitEvents(id)
          const todayEvent = eRes.events.find(
            (e: HabitEvent) => e.action === 'done' && e.actionDate === today
          )
          if (todayEvent) {
            const res = await api.habitDeleteEvent(id, todayEvent.id)
            updated = res.habit
          }
        } else {
          const res = await api.habitDone(id)
          updated = res.habit
        }
      }
      if (kind === 'push') {
        const res = await api.habitPush(id)
        updated = res.habit
      }
      if (kind === 'skip') {
        const res = await api.habitSkip(id)
        updated = res.habit
      }
      if (updated) {
        setHabits((prev) => prev.map((h) => (h.id === updated!.id ? updated! : h)))
      }
      // Only refresh stats, not the full list
      try {
        const sRes = await api.summary()
        setSummary(sRes)
      } catch { /* non-critical */ }
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  function handleDividerDown(e: React.MouseEvent) {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      let newLeft = ev.clientX - rect.left
      newLeft = Math.max(LEFT_MIN, Math.min(rect.width - RIGHT_MIN, newLeft))
      setLeftWidth(newLeft)
    }

    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="pb-16 sm:pb-0 h-full">
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[14px] sm:text-[12px] text-red-700">
          {error}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="flex h-[calc(100vh-28px)] sm:h-[calc(100vh-32px)]"
      >
        {/* Left panel */}
        <div
          className="w-full flex flex-col overflow-hidden shrink-0 grow-0"
          style={isDesktop ? { flex: `0 0 ${leftWidth}px` } : undefined}
        >
          {/* Row 1: Title + actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(180,160,200,0.15)]">
            <span className="text-[18px] sm:text-[16px] font-bold text-ink">
              📋 今日概览
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className="rounded-md p-1 hover:bg-black/[0.03] transition"
                onClick={handleViewChange}
                title={
                  viewMode === 'card' ? '切换到列表视图' : '切换到卡片视图'
                }
              >
                {viewMode === 'card' ? (
                  <svg
                    className="h-4 w-4 text-gray-400"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <rect x="1" y="2" width="14" height="2" rx="0.5" />
                    <rect x="1" y="7" width="14" height="2" rx="0.5" />
                    <rect x="1" y="12" width="14" height="2" rx="0.5" />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4 text-gray-400"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <rect x="1" y="1" width="6" height="6" rx="1" />
                    <rect x="9" y="1" width="6" height="6" rx="1" />
                    <rect x="1" y="9" width="6" height="6" rx="1" />
                    <rect x="9" y="9" width="6" height="6" rx="1" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-black/[0.03] transition"
                onClick={openCreate}
                title="新建习惯"
              >
                <svg
                  className="h-4 w-4 text-gray-400"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </button>
            </div>
          </div>

          {/* Row 2: Filter Tabs (full width, equal spacing) */}
          <div className="px-3 py-1 border-b border-[rgba(180,160,200,0.15)]">
            <FilterTabs value={filterTab} onChange={setFilterTab} />
          </div>

          {/* Habit List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {loading ? (
              <div className="text-[15px] sm:text-[13px] text-gray-400 px-3 py-4">
                加载中...
              </div>
            ) : habits.length === 0 ? (
              <div className="px-3 py-6">
                <div className="text-[18px] sm:text-[16px] font-bold text-ink">
                  从一个微小的动作开始
                </div>
                <div className="mt-2 text-[14px] sm:text-[12px] text-gray-400">
                  先创建 1 个习惯，然后用打卡来管理节奏。
                </div>
                <button
                  type="button"
                  className="btn btn-primary mt-3 text-[14px] sm:text-[12px]"
                  onClick={openCreate}
                >
                  新建第一个习惯
                </button>
              </div>
            ) : filteredHabits.length === 0 ? (
              <div className="text-[14px] sm:text-[12px] text-gray-400 px-3 py-4">
                没有符合条件的习惯
              </div>
            ) : viewMode === 'card' ? (
              <div className="space-y-3">
                {groupedHabits.map((group) => (
                  <div key={group.label}>
                    {group.label ? (
                      <div className="text-[13px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">
                        {group.label}
                      </div>
                    ) : null}
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(240px, 1fr))',
                      }}
                    >
                      {group.habits.map((h) => (
                        <HabitCard
                          key={h.id}
                          habit={h}
                          today={today}
                          selected={selectedHabitId === h.id}
                          busy={busy === h.id}
                          onSelect={() => setSelectedHabitId(h.id)}
                          onDone={() => void act(h.id, 'done')}
                          onPush={() => void act(h.id, 'push')}
                          onSkip={() => void act(h.id, 'skip')}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {groupedHabits.map((group) => (
                  <div key={group.label}>
                    {group.label ? (
                      <div className="text-[13px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">
                        {group.label}
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      {group.habits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          className={`w-full text-left rounded-lg px-3 py-2 transition flex items-center gap-2 ${selectedHabitId === h.id ? 'bg-[#ede7f6]' : 'hover:bg-gray-50'}`}
                          onClick={() => setSelectedHabitId(h.id)}
                        >
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[13px] sm:text-[11px] font-bold shrink-0 ${h.lastDoneDate === today ? 'bg-[#e8f5e9] text-[#43a047]' : 'bg-[#ede7f6] text-[#7e57c2]'}`}
                          >
                            {h.icon || getFirstTextChar(h.title)}
                          </span>
                          <span
                            className={`text-[16px] sm:text-[12px] font-medium truncate flex-1 ${h.lastDoneDate === today ? 'line-through opacity-50' : ''}`}
                          >
                            {h.title}
                          </span>
                          <button
                            type="button"
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${h.lastDoneDate === today ? 'bg-[#7e57c2] text-white' : 'border border-gray-200'}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (busy !== h.id) void act(h.id, 'done')
                            }}
                          >
                            {h.lastDoneDate === today ? (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : null}
                          </button>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resizable divider */}
        {isDesktop && (
          <div
            className="w-px cursor-col-resize bg-[rgba(180,160,200,0.2)] hover:bg-[#7e57c2]/30 active:bg-[#7e57c2]/50 transition-colors shrink-0 mx-2"
            onMouseDown={handleDividerDown}
          />
        )}

        {/* Right panel */}
        {isDesktop ? (
          <div
            className="overflow-y-auto min-w-0 flex-1 flex justify-center"
            style={{ minWidth: RIGHT_MIN }}
          >
            <div className="w-full" style={{ maxWidth: 830 }}>
              <HabitDetailPanel
                habitId={selectedHabitId}
                onDone={loadAll}
                onEdit={(h) => openEdit(h)}
                refreshKey={detailRefreshKey}
              />
            </div>
          </div>
        ) : selectedHabitId ? (
          <MobileHabitSheet
            habitId={selectedHabitId}
            onClose={() => setSelectedHabitId(null)}
            onRefresh={loadAll}
            onEdit={(h) => {
              setSelectedHabitId(null)
              openEdit(h)
            }}
          />
        ) : null}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? '编辑习惯' : '新建习惯'}
        onClose={() => {
          setModalOpen(false)
          setDraft(null)
        }}
        footer={
          <div className="flex w-full items-center">
            {editing && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn text-[13px] sm:text-[11px]"
                  onClick={() => void archiveHabit()}
                  disabled={busy === 'modal'}
                >
                  归档
                </button>
                <button
                  type="button"
                  className="btn btn-danger text-[13px] sm:text-[11px]"
                  onClick={() => void deleteHabit()}
                  disabled={busy === 'modal'}
                >
                  删除
                </button>
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                className="btn text-[13px] sm:text-[11px]"
                onClick={() => setModalOpen(false)}
                disabled={busy === 'modal'}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary text-[13px] sm:text-[11px]"
                onClick={() => void saveHabit()}
                disabled={busy === 'modal' || !draft?.title.trim()}
              >
                保存
              </button>
            </div>
          </div>
        }
      >
        {draft ? (
          <div className="grid gap-3">
            <div>
              <div className="text-[14px] sm:text-[12px] font-semibold text-ink mb-1">
                标题
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    className="w-9 h-9 rounded-lg border border-[#eceae4] bg-[#f7f4ed] flex items-center justify-center text-[18px] shrink-0 hover:border-[rgba(28,28,28,0.4)] transition"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    {draft.icon || '😊'}
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      value={draft.icon || null}
                      onSelect={(emoji) => {
                        setDraft({ ...draft, icon: emoji })
                        setShowEmojiPicker(false)
                      }}
                      onClear={() => {
                        setDraft({ ...draft, icon: '' })
                        setShowEmojiPicker(false)
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
                <input
                  className="input text-[14px] py-2 font-medium flex-1"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="例如：晨间拉伸"
                />
              </div>
            </div>
            <div>
              <div className="text-[14px] sm:text-[12px] font-semibold text-ink mb-1">
                标签（可选）
              </div>
              <TagInput
                value={draft.tag}
                onChange={(v) => setDraft({ ...draft, tag: v })}
                suggestions={allTags}
              />
            </div>
            <div>
              <div className="text-[14px] sm:text-[12px] font-semibold text-ink mb-1">
                备注（可选）
              </div>
              <textarea
                className="input text-[13px] py-1.5 min-h-16 resize-y"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="写一句话，给未来的你一个更明确的动作。"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[14px] sm:text-[12px] font-semibold text-ink mb-1">
                  周期（天）
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn w-8 h-8 flex items-center justify-center text-[14px] font-bold shrink-0"
                    onClick={() => {
                      const current = draft.intervalDays || 1
                      setDraft({
                        ...draft,
                        intervalDays: Math.max(1, current - 1),
                      })
                    }}
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="input text-[14px] py-1 text-center font-semibold flex-1 min-w-0"
                    value={draft.intervalDays || ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value)
                      if (e.target.value === '') {
                        setDraft({ ...draft, intervalDays: NaN })
                      } else if (!isNaN(v) && v >= 1) {
                        setDraft({ ...draft, intervalDays: Math.min(365, v) })
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn w-8 h-8 flex items-center justify-center text-[14px] font-bold shrink-0"
                    onClick={() => {
                      const current = draft.intervalDays || 1
                      setDraft({
                        ...draft,
                        intervalDays: Math.min(365, current + 1),
                      })
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[14px] sm:text-[12px] font-semibold text-ink mb-1">
                  打卡开始日期
                </div>
                <input
                  className="input text-[13px] py-1.5"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) =>
                    setDraft({ ...draft, startDate: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={confirmArchive}
        title="归档习惯"
        onClose={() => setConfirmArchive(false)}
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              className="btn text-[13px] px-4 py-1.5"
              onClick={() => setConfirmArchive(false)}
              disabled={busy === 'modal'}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary text-[13px] px-4 py-1.5"
              onClick={() => void performArchive()}
              disabled={busy === 'modal'}
            >
              确认归档
            </button>
          </div>
        }
      >
        <div className="py-2 text-[14px] text-gray-600">
          确定要归档这个习惯吗？归档后将不再显示在今日概览中。
        </div>
      </Modal>

      <Modal
        open={confirmDeleteHabit}
        title="删除习惯"
        onClose={() => setConfirmDeleteHabit(false)}
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              className="btn text-[13px] px-4 py-1.5"
              onClick={() => setConfirmDeleteHabit(false)}
              disabled={busy === 'modal'}
            >
              取消
            </button>
            <button
              type="button"
              className="btn bg-[#ef5350] text-white hover:bg-[#d32f2f] text-[13px] px-4 py-1.5 border-none"
              onClick={() => void performDelete()}
              disabled={busy === 'modal'}
            >
              删除
            </button>
          </div>
        }
      >
        <div className="py-2 text-[14px] text-gray-600">
          确定要删除这个习惯吗？该操作将删除所有历史打卡记录且
          <span className="font-bold text-red-600 ml-1">无法恢复</span>。
        </div>
      </Modal>
    </div>
  )
}
