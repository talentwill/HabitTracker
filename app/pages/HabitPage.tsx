import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import Heatmap from "../components/Heatmap";
import EmojiPicker from "../components/EmojiPicker";
import Modal from "../components/Modal";
import TagInput, { tagColor } from "../components/TagInput";
import MonthCalendar from "../components/MonthCalendar";
import * as api from "../lib/api";
import type { Habit, HabitEvent } from "../lib/api";
import { getApiErrorMessage } from "../lib/errorHelpers";
import { compareDateOnly, diffDays, nowInCST, statusForDue, todayDateOnly } from "../lib/date";

type HabitDraft = {
  title: string;
  note: string;
  intervalDays: number;
  startDate: string;
  tag: string;
  icon: string;
};

function statusText(nextDueDate: string, today: string) {
  const s = statusForDue(nextDueDate, today);
  if (s === "overdue") return "已逾期";
  if (s === "today") return "今天到期";
  return "未到期";
}

export default function HabitPage() {
  const { id } = useParams();
  const habitId = id ?? "";
  const today = todayDateOnly();

  const [habit, setHabit] = useState<Habit | null>(null);
  const [events, setEvents] = useState<HabitEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<HabitDraft | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  const [calYear, setCalYear] = useState(nowInCST().getFullYear());
  const [calMonth, setCalMonth] = useState(nowInCST().getMonth());
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<HabitEvent | null>(null);
  const [confirmManualDone, setConfirmManualDone] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDeleteHabit, setConfirmDeleteHabit] = useState(false);

  const load = useCallback(async () => {
    if (!habitId) return;
    setLoading(true);
    setError(null);
    try {
      const [hRes, eRes, tRes] = await Promise.all([
        api.getHabit(habitId),
        api.habitEvents(habitId),
        api.listTags(),
      ]);
      setHabit(hRes.habit);
      setEvents(eRes.events);
      setAllTags(tRes.tags.map((t) => t.name));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [habitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const doneDates = events
      .filter((e) => e.action === "done")
      .map((e) => e.actionDate)
      .sort(compareDateOnly);
    const doneCount = doneDates.length;
    const gaps: number[] = [];
    for (let i = 1; i < doneDates.length; i++)
      gaps.push(diffDays(doneDates[i - 1]!, doneDates[i]!));
    const avgGap = gaps.length
      ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10
      : null;
    const lastGap = gaps.length ? gaps[gaps.length - 1] : null;
    const skipCount = events.filter((e) => e.action === "skip").length;
    const pushCount = events.filter((e) => e.action === "push").length;
    return { doneCount, avgGap, lastGap, skipCount, pushCount };
  }, [events]);

  const canAct = habit ? !habit.archived : false;

  async function act(kind: "done" | "push" | "skip") {
    if (!habit) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "done") await api.habitDone(habit.id);
      if (kind === "push") await api.habitPush(habit.id);
      if (kind === "skip") await api.habitSkip(habit.id);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function openEdit() {
    if (!habit) return;
    // Refresh tags before opening modal
    try {
      const tRes = await api.listTags();
      setAllTags(tRes.tags.map((t) => t.name));
    } catch {
      // Ignore tag fetch errors
    }
    setDraft({
      title: habit.title,
      note: habit.note,
      intervalDays: habit.intervalDays,
      startDate: habit.startDate,
      tag: habit.tag ?? "",
      icon: habit.icon ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!habit || !draft) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateHabit(habit.id, {
        title: draft.title,
        note: draft.note,
        intervalDays: draft.intervalDays,
        startDate: draft.startDate,
        tag: draft.tag,
        icon: draft.icon,
      });
      setEditOpen(false);
      setDraft(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!habit) return;
    setConfirmArchive(true);
  }

  async function performArchive() {
    if (!habit) return;
    setBusy(true);
    try {
      await api.updateHabit(habit.id, { archived: 1 });
      setConfirmArchive(false);
      setEditOpen(false);
      setDraft(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!habit) return;
    setConfirmDeleteHabit(true);
  }

  async function performRemove() {
    if (!habit) return;
    setBusy(true);
    try {
      await api.deleteHabit(habit.id);
      location.href = "/";
    } catch (err) {
      setError(getApiErrorMessage(err));
      setBusy(false);
    }
  }

  function handleMonthClick(year: number, month: number) {
    setCalYear(year);
    setCalMonth(month);
  }

  function handleCalDateClick(date: string, event?: HabitEvent) {
    if (!habit) return;
    if (event && (event.action === "done" || event.action === "push")) {
      setConfirmDeleteEvent(event);
    } else {
      setConfirmManualDone(date);
    }
  }

  return (
    <div className="min-h-full pb-16 sm:pb-0">
      <div className="mx-auto w-full max-w-[800px] px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline mb-4"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回概览
        </Link>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="paper px-4 py-4 text-[14px] text-muted">加载中…</div>
        ) : habit ? (
          <div className="grid gap-5">
            <div className="paper px-5 py-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {habit.icon && (
                      <span className="w-10 h-10 rounded-full bg-[#ede7f6] flex items-center justify-center text-[20px] shrink-0">
                        {habit.icon}
                      </span>
                    )}
                    <h1 className="text-[24px] font-bold leading-[1.2] tracking-[-0.5px] text-ink">
                      {habit.title}
                    </h1>
                  </div>
                  {habit.note ? (
                    <div className="mt-1.5 text-[13px] text-muted">{habit.note}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {habit.tag ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#e8f5e9] text-[#2e7d32]"
                      style={tagColor(habit.tag)}
                    >
                      🏷 {habit.tag}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="btn text-[12px] px-2 sm:px-3 py-1"
                    onClick={openEdit}
                  >
                    <span>⚙️</span>
                    <span className="hidden sm:inline">编辑</span>
                  </button>
                </div>
              </div>

              {/* Actions & Status Chips Row */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1.5 mr-auto">
                  {canAct && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary text-[12px] px-2 sm:px-3 py-1"
                        onClick={() => void act("done")}
                        disabled={busy}
                      >
                        <span>✅</span>
                        <span className="hidden sm:inline">打卡</span>
                      </button>
                      <button
                        type="button"
                        className="btn text-[12px] px-2 sm:px-3 py-1"
                        onClick={() => void act("push")}
                        disabled={busy}
                      >
                        <span>⏰</span>
                        <span className="hidden sm:inline">推迟</span>
                      </button>
                      <button
                        type="button"
                        className="btn text-[12px] px-2 sm:px-3 py-1"
                        onClick={() => void act("skip")}
                        disabled={busy}
                      >
                        <span>⏭</span>
                        <span className="hidden sm:inline">跳过</span>
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {habit.startDate ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#fff3e0] text-[#e65100]">
                      📆 {habit.startDate}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#ede7f6] text-[#7e57c2]">
                    🔄 每{habit.intervalDays}天
                  </span>
                </div>
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    statusForDue(habit.nextDueDate, today) === "overdue" &&
                      "bg-[#fce4ec] text-[#c62828]",
                    statusForDue(habit.nextDueDate, today) === "today" &&
                      "bg-[#fff3e0] text-[#e65100]",
                    statusForDue(habit.nextDueDate, today) === "upcoming" &&
                      "bg-[#e3f2fd] text-[#1565c0]"
                  )}
                >
                  📅 {habit.nextDueDate} ({statusText(habit.nextDueDate, today)})
                </span>
                {habit.archived ? (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-black/5 text-muted">
                    已归档
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg bg-warm-white px-3 py-3">
                <div className="text-[11px] font-semibold text-muted-light">打卡次数</div>
                <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
                  {stats.doneCount}
                </div>
              </div>
              <div className="rounded-lg bg-warm-white px-3 py-3">
                <div className="text-[11px] font-semibold text-muted-light">平均间隔</div>
                <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
                  {stats.avgGap ?? "—"}
                  {stats.avgGap ? (
                    <span className="text-[11px] text-muted-light ml-0.5">天</span>
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg bg-warm-white px-3 py-3">
                <div className="text-[11px] font-semibold text-muted-light">最近间隔</div>
                <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
                  {stats.lastGap ?? "—"}
                  {stats.lastGap ? (
                    <span className="text-[11px] text-muted-light ml-0.5">天</span>
                  ) : null}
                </div>
              </div>
              <div className="rounded-lg bg-warm-white px-3 py-3">
                <div className="text-[11px] font-semibold text-muted-light">推迟/跳过</div>
                <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
                  {stats.pushCount}/{stats.skipCount}
                </div>
              </div>
            </div>

            <div className="paper px-5 py-5">
              <Heatmap
                events={events}
                nextDueDate={habit.nextDueDate}
                onMonthClick={handleMonthClick}
              />
            </div>

            <div className="paper px-5 py-5">
              <MonthCalendar
                events={events}
                nextDueDate={habit.nextDueDate}
                year={calYear}
                month={calMonth}
                onReset={() => {
                  const now = nowInCST();
                  setCalYear(now.getFullYear());
                  setCalMonth(now.getMonth());
                }}
                onPrev={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear(calYear - 1);
                  } else setCalMonth(calMonth - 1);
                }}
                onNext={() => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear(calYear + 1);
                  } else setCalMonth(calMonth + 1);
                }}
                onDateClick={handleCalDateClick}
              />
            </div>
          </div>
        ) : (
          <div className="paper px-4 py-4 text-[14px] text-muted">未找到</div>
        )}
      </div>

      <Modal
        open={editOpen}
        title="编辑习惯"
        onClose={() => {
          setEditOpen(false);
          setDraft(null);
        }}
        footer={
          <>
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={() => void archive()} disabled={busy}>
                归档
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void remove()}
                disabled={busy}
              >
                删除
              </button>
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                className="btn"
                onClick={() => setEditOpen(false)}
                disabled={busy}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveEdit()}
                disabled={busy || !draft?.title.trim()}
              >
                保存
              </button>
            </div>
          </>
        }
      >
        {draft ? (
          <div className="grid gap-4">
            <div>
              <div className="label">标题</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="relative">
                  <button
                    type="button"
                    className="w-9 h-9 rounded-lg border border-[#eceae4] bg-[#f7f4ed] flex items-center justify-center text-[18px] shrink-0 hover:border-[rgba(28,28,28,0.4)] transition"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    {draft.icon || "😊"}
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      value={draft.icon || null}
                      onSelect={(emoji) => {
                        setDraft({ ...draft, icon: emoji });
                        setShowEmojiPicker(false);
                      }}
                      onClear={() => {
                        setDraft({ ...draft, icon: "" });
                        setShowEmojiPicker(false);
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
                <input
                  className="input flex-1"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
            </div>
            <div>
              <div className="label">标签（可选）</div>
              <TagInput
                value={draft.tag}
                onChange={(v) => setDraft({ ...draft, tag: v })}
                suggestions={allTags}
              />
            </div>
            <div>
              <div className="label">备注</div>
              <textarea
                className="input mt-1 min-h-20 resize-y"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="label">周期（天）</div>
                <input
                  className="input mt-1"
                  type="number"
                  min={1}
                  max={365}
                  value={draft.intervalDays}
                  onChange={(e) => setDraft({ ...draft, intervalDays: Number(e.target.value) })}
                />
              </div>
              <div>
                <div className="label">打卡开始日期</div>
                <input
                  className="input mt-1"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!confirmDeleteEvent}
        title="确认删除记录"
        onClose={() => setConfirmDeleteEvent(null)}
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              className="btn text-[13px] px-4 py-1.5"
              onClick={() => setConfirmDeleteEvent(null)}
              disabled={busy}
            >
              取消
            </button>
            <button
              type="button"
              className="btn bg-[#ef5350] text-white hover:bg-[#d32f2f] text-[13px] px-4 py-1.5 border-none"
              onClick={async () => {
                if (!habit || !confirmDeleteEvent) return;
                setBusy(true);
                try {
                  await api.habitDeleteEvent(habit.id, confirmDeleteEvent.id);
                  await load();
                  setConfirmDeleteEvent(null);
                } catch {
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              删除
            </button>
          </div>
        }
      >
        <div className="py-2 text-[14px] text-gray-600">
          确定要删除 {confirmDeleteEvent?.actionDate} 的
          <span className="font-bold text-ink mx-1">
            {confirmDeleteEvent?.action === "done"
              ? "打卡"
              : confirmDeleteEvent?.action === "push"
                ? "明天"
                : "跳过"}
          </span>
          记录吗？该操作无法恢复。
        </div>
      </Modal>

      <Modal
        open={!!confirmManualDone}
        title="确认补打卡"
        onClose={() => setConfirmManualDone(null)}
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              className="btn text-[13px] px-4 py-1.5"
              onClick={() => setConfirmManualDone(null)}
              disabled={busy}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary text-[13px] px-4 py-1.5"
              onClick={async () => {
                if (!habit || !confirmManualDone) return;
                setBusy(true);
                try {
                  await api.habitManualDone(habit.id, confirmManualDone);
                  await load();
                  setConfirmManualDone(null);
                } catch {
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              确认补打卡
            </button>
          </div>
        }
      >
        <div className="py-2 text-[14px] text-gray-600">
          确定要补打卡 <span className="font-bold text-ink">{confirmManualDone}</span> 吗？
        </div>
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
              disabled={busy}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary text-[13px] px-4 py-1.5"
              onClick={() => void performArchive()}
              disabled={busy}
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
              disabled={busy}
            >
              取消
            </button>
            <button
              type="button"
              className="btn bg-[#ef5350] text-white hover:bg-[#d32f2f] text-[13px] px-4 py-1.5 border-none"
              onClick={() => void performRemove()}
              disabled={busy}
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
  );
}
