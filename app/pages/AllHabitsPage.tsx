import { useCallback, useEffect, useMemo, useState } from "react";

import EmojiPicker from "../components/EmojiPicker";
import HabitCard from "../components/HabitCard";
import Modal from "../components/Modal";
import TagInput from "../components/TagInput";
import type { Habit, HabitEvent, StatsSummary } from "../lib/api";
import * as api from "../lib/api";
import { getApiErrorMessage } from "../lib/errorHelpers";
import { todayDateOnly } from "../lib/date";
import { useIsDesktop } from "../hooks/useIsDesktop";
import MobileHabitSheet from "../components/mobile/MobileHabitSheet";

type HabitDraft = {
  id?: string;
  title: string;
  note: string;
  intervalDays: number;
  startDate: string;
  tag: string;
  icon: string;
};

type GroupBy = "tag" | "interval";

export default function AllHabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("tag");
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const today = summary?.today ?? todayDateOnly();

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, sRes] = await Promise.all([api.listHabits({ archived: false }), api.summary()]);
      setHabits(hRes.habits);
      setSummary(sRes);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Habit[]>();
    for (const h of habits) {
      const key = groupBy === "tag" ? h.tag || "" : String(h.intervalDays);
      const list = groups.get(key) || [];
      list.push(h);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([key, items]) => ({
        key,
        label: groupBy === "tag" ? key || "未分类" : `每${key}天`,
        items,
      }));
  }, [habits, groupBy]);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<HabitDraft | null>(null);
  const editing = Boolean(draft?.id);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  async function openCreate() {
    setDraft({
      title: "",
      note: "",
      intervalDays: 1,
      startDate: today,
      tag: "",
      icon: "",
    });
    // Refresh tags before opening modal
    try {
      const tRes = await api.listTags();
      setAllTags(tRes.tags.map((t) => t.name));
    } catch {
      // Ignore tag fetch errors
    }
    setModalOpen(true);
  }

  async function openEdit(h: Habit) {
    setDraft({
      id: h.id,
      title: h.title,
      note: h.note,
      intervalDays: h.intervalDays,
      startDate: h.startDate,
      tag: h.tag ?? "",
      icon: h.icon ?? "",
    });
    // Refresh tags before opening modal
    try {
      const tRes = await api.listTags();
      setAllTags(tRes.tags.map((t) => t.name));
    } catch {
      // Ignore tag fetch errors
    }
    setModalOpen(true);
  }

  async function saveHabit() {
    if (!draft) return;
    setBusy("modal");
    setError(null);
    try {
      if (draft.id) {
        await api.updateHabit(draft.id, {
          title: draft.title,
          note: draft.note,
          intervalDays: draft.intervalDays,
          startDate: draft.startDate,
          tag: draft.tag || undefined,
          icon: draft.icon,
        });
      } else {
        await api.createHabit({
          title: draft.title,
          note: draft.note,
          intervalDays: draft.intervalDays,
          startDate: draft.startDate,
          tag: draft.tag || undefined,
          icon: draft.icon || undefined,
        });
      }
      setModalOpen(false);
      setDraft(null);
      await loadAll();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function archiveHabit() {
    if (!draft?.id) return;
    if (!confirm("确定要归档这个习惯吗？")) return;
    setBusy("modal");
    setError(null);
    try {
      await api.updateHabit(draft.id, { archived: 1 });
      setModalOpen(false);
      setDraft(null);
      await loadAll();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function deleteHabit() {
    if (!draft?.id) return;
    if (!confirm("确定要删除吗？无法恢复。")) return;
    setBusy("modal");
    setError(null);
    try {
      await api.deleteHabit(draft.id);
      setModalOpen(false);
      setDraft(null);
      await loadAll();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, kind: "done" | "push" | "skip") {
    setBusy(id);
    setError(null);
    try {
      let updated: Habit | undefined;
      if (kind === "done") {
        const h = habits.find((h) => h.id === id);
        if (h && h.lastDoneDate === today) {
          const eRes = await api.habitEvents(id);
          const todayEvent = eRes.events.find(
            (e: HabitEvent) => e.action === "done" && e.actionDate === today
          );
          if (todayEvent) {
            const res = await api.habitDeleteEvent(id, todayEvent.id);
            updated = res.habit;
          }
        } else {
          const res = await api.habitDone(id);
          updated = res.habit;
        }
      }
      if (kind === "push") {
        const res = await api.habitPush(id);
        updated = res.habit;
      }
      if (kind === "skip") {
        const res = await api.habitSkip(id);
        updated = res.habit;
      }
      if (updated) {
        setHabits((prev) => prev.map((h) => (h.id === updated!.id ? updated! : h)));
      }
      try {
        const sRes = await api.summary();
        setSummary(sRes);
      } catch {
        /* non-critical */
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="pb-16 sm:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="section-title">📑 全部习惯</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
            <button
              type="button"
              className={`px-2.5 py-1 text-[14px] sm:text-[12px] font-medium rounded-full transition ${groupBy === "tag" ? "bg-paper text-ink shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
              onClick={() => setGroupBy("tag")}
            >
              按标签
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 text-[14px] sm:text-[12px] font-medium rounded-full transition ${groupBy === "interval" ? "bg-paper text-ink shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
              onClick={() => setGroupBy("interval")}
            >
              按间隔
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary text-[14px] sm:text-[12px]"
            onClick={openCreate}
          >
            + 新建
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[14px] sm:text-[12px] text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="paper px-4 py-4 text-[14px] text-muted">加载中…</div>
      ) : habits.length === 0 ? (
        <div className="paper px-5 py-6 text-[14px] text-muted">暂无活跃习惯</div>
      ) : (
        <div className="grid gap-5">
          {grouped.map(({ key, label, items }) => (
            <section key={key}>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-[14px] sm:text-[12px] font-semibold text-muted">{label}</div>
                <span className="text-[12px] sm:text-[10px] text-gray-400">{items.length}个</span>
              </div>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                }}
              >
                {items.map((h) => (
                  <HabitCard
                    key={h.id}
                    habit={h}
                    today={today}
                    selected={selectedHabitId === h.id}
                    busy={busy === h.id}
                    onSelect={() => setSelectedHabitId(selectedHabitId === h.id ? null : h.id)}
                    onDone={() => void act(h.id, "done")}
                    onPush={() => void act(h.id, "push")}
                    onSkip={() => void act(h.id, "skip")}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Detail Panel for selected habit (mobile only) */}
      {!isDesktop && selectedHabitId && (
        <MobileHabitSheet
          habitId={selectedHabitId}
          onClose={() => setSelectedHabitId(null)}
          onRefresh={loadAll}
          onEdit={(h) => {
            setSelectedHabitId(null);
            openEdit(h);
          }}
        />
      )}

      <Modal
        open={modalOpen}
        title={editing ? "编辑习惯" : "新建习惯"}
        onClose={() => {
          setModalOpen(false);
          setDraft(null);
        }}
        footer={
          <div className="flex w-full items-center">
            {editing && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn text-[13px] sm:text-[11px]"
                  onClick={() => void archiveHabit()}
                  disabled={busy === "modal"}
                >
                  归档
                </button>
                <button
                  type="button"
                  className="btn btn-danger text-[13px] sm:text-[11px]"
                  onClick={() => void deleteHabit()}
                  disabled={busy === "modal"}
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
                disabled={busy === "modal"}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary text-[13px] sm:text-[11px]"
                onClick={() => void saveHabit()}
                disabled={busy === "modal" || !draft?.title.trim()}
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
              <div className="text-[14px] sm:text-[12px] font-semibold text-ink mb-1">标题</div>
              <div className="flex items-center gap-2">
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
                  className="input text-[14px] py-2 font-medium flex-1"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
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
                    onClick={() =>
                      setDraft({
                        ...draft,
                        intervalDays: Math.max(1, draft.intervalDays - 1),
                      })
                    }
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="input text-[14px] py-1 text-center font-semibold flex-1 min-w-0"
                    value={draft.intervalDays}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 1)
                        setDraft({ ...draft, intervalDays: Math.min(365, v) });
                    }}
                  />
                  <button
                    type="button"
                    className="btn w-8 h-8 flex items-center justify-center text-[14px] font-bold shrink-0"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        intervalDays: Math.min(365, draft.intervalDays + 1),
                      })
                    }
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
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
