import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import HabitCard from "../components/HabitCard";
import HabitDetailPanel from "../components/desktop/HabitDetailPanel";
import MobileHabitSheet from "../components/mobile/MobileHabitSheet";
import WeekDatePicker from "../components/WeekDatePicker";
import { ApiError } from "../lib/api";
import type { Habit, HabitEvent, StatsSummary } from "../lib/api";
import * as api from "../lib/api";
import { todayDateOnly } from "../lib/date";
import { useIsDesktop } from "../hooks/useIsDesktop";

function errorText(err: unknown): string {
  if (!(err instanceof ApiError)) return "网络或服务器错误";
  return `请求失败：${err.code}`;
}

const LEFT_MIN = 380;
const RIGHT_MIN = 400;

export default function WeekOverview() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayDateOnly());
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedHabitId, setSelectedHabitIdRaw] = useState<string | null>(() =>
    typeof window !== "undefined" && window.innerWidth >= 640
      ? window.location.hash.slice(1) || null
      : null
  );

  function setSelectedHabitId(id: string | null) {
    setSelectedHabitIdRaw(id);
    window.location.hash = id ?? "";
  }
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === "undefined" || window.innerWidth < 640) return 380;
    const rightNeed = 820;
    const sidebarW = 220;
    const initial = window.innerWidth - sidebarW - rightNeed;
    return Math.max(280, Math.min(initial, 600));
  });
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const isDesktop = useIsDesktop();

  const today = summary?.today ?? todayDateOnly();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, sRes] = await Promise.all([api.listHabits({ archived: false }), api.summary()]);
      setHabits(hRes.habits);
      setSummary(sRes);
      if (window.innerWidth >= 640 && !window.location.hash.slice(1) && hRes.habits.length > 0) {
        setSelectedHabitId(hRes.habits[0]!.id);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
      setDetailRefreshKey((k) => k + 1);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // doneCounts: date -> number of habits done on that date
  const doneCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of habits) {
      if (h.lastDoneDate) {
        map.set(h.lastDoneDate, (map.get(h.lastDoneDate) ?? 0) + 1);
      }
    }
    return map;
  }, [habits]);

  // Show only habits done on selectedDate
  const doneHabits = useMemo(() => {
    return habits.filter((h) => h.lastDoneDate === selectedDate);
  }, [habits, selectedDate]);

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
        setDetailRefreshKey((k) => k + 1);
      }
      try {
        const sRes = await api.summary();
        setSummary(sRes);
      } catch {
        /* non-critical */
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  function handleDividerDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let newLeft = ev.clientX - rect.left;
      newLeft = Math.max(LEFT_MIN, Math.min(rect.width - RIGHT_MIN, newLeft));
      setLeftWidth(newLeft);
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div className="pb-16 sm:pb-0 h-full">
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[14px] sm:text-[12px] text-red-700">
          {error}
        </div>
      ) : null}

      <div ref={containerRef} className="flex h-[calc(100vh-28px)] sm:h-[calc(100vh-32px)]">
        {/* Left panel */}
        <div
          className="w-full flex flex-col overflow-hidden shrink-0 grow-0"
          style={isDesktop ? { flex: `0 0 ${leftWidth}px` } : undefined}
        >
          {/* Row 1: Title + actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(180,160,200,0.15)]">
            <span className="text-[18px] sm:text-[16px] font-bold text-ink">📅 本周概览</span>
            <div className="flex items-center gap-1 shrink-0">
              {(selectedDate !== today || weekOffset !== 0) && (
                <button
                  type="button"
                  className="rounded-md px-2 py-0.5 text-[13px] sm:text-[11px] font-medium text-[#7e57c2] hover:bg-[#7e57c2]/5 transition border border-[#7e57c2]/20"
                  onClick={() => {
                    setSelectedDate(today);
                    setWeekOffset(0);
                  }}
                >
                  回到今日
                </button>
              )}
            </div>
          </div>

          {/* Week Date Picker */}
          <WeekDatePicker
            today={today}
            selectedDate={selectedDate}
            weekOffset={weekOffset}
            doneCounts={doneCounts}
            onSelect={setSelectedDate}
            onPrevWeek={() => setWeekOffset(weekOffset - 1)}
            onNextWeek={() => setWeekOffset(weekOffset + 1)}
            onResetWeek={() => setWeekOffset(0)}
          />

          <div className="px-3 py-1 border-b border-[rgba(180,160,200,0.15)]">
            <span className="text-[13px] sm:text-[11px] font-medium text-gray-400">
              {selectedDate} · 已完成 {doneHabits.length} 项
            </span>
          </div>

          {/* Done habits list */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {loading ? (
              <div className="text-[15px] sm:text-[13px] text-gray-400 px-3 py-4">加载中...</div>
            ) : doneHabits.length === 0 ? (
              <div className="text-[14px] sm:text-[12px] text-gray-400 px-3 py-4">
                这一天没有打卡记录
              </div>
            ) : (
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                }}
              >
                {doneHabits.map((h) => (
                  <HabitCard
                    key={h.id}
                    habit={h}
                    today={selectedDate}
                    selected={selectedHabitId === h.id}
                    busy={busy === h.id}
                    onSelect={() => setSelectedHabitId(h.id)}
                    onDone={() => void act(h.id, "done")}
                    onPush={() => void act(h.id, "push")}
                    onSkip={() => void act(h.id, "skip")}
                  />
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
            className="overflow-hidden min-w-0 flex-1 flex justify-center"
            style={{ minWidth: RIGHT_MIN }}
          >
            <div className="w-full" style={{ maxWidth: 830 }}>
              <HabitDetailPanel
                habitId={selectedHabitId}
                onDone={loadAll}
                onEdit={() => {}}
                refreshKey={detailRefreshKey}
              />
            </div>
          </div>
        ) : selectedHabitId ? (
          <MobileHabitSheet
            habitId={selectedHabitId}
            onClose={() => setSelectedHabitId(null)}
            onRefresh={loadAll}
            onEdit={() => {}}
          />
        ) : null}
      </div>
    </div>
  );
}
