import { useCallback, useEffect, useMemo, useState } from "react";

import * as api from "../lib/api";
import type { Habit, HabitEvent } from "../lib/api";
import { diffDays, nowInCST, todayDateOnly } from "../lib/date";

export function useHabitDetail(habitId: string | null, refreshKey?: number, onDone?: () => void) {
  const [habit, setHabit] = useState<Habit | null>(null);
  const [events, setEvents] = useState<HabitEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [calYear, setCalYear] = useState(nowInCST().getFullYear());
  const [calMonth, setCalMonth] = useState(nowInCST().getMonth());
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<HabitEvent | null>(null);

  const today = todayDateOnly();

  const load = useCallback(async () => {
    if (!habitId) return;
    setLoading(true);
    try {
      const [hRes, eRes] = await Promise.all([api.getHabit(habitId), api.habitEvents(habitId)]);
      setHabit(hRes.habit);
      setEvents(eRes.events);
    } catch {
      setHabit(null);
    } finally {
      setLoading(false);
    }
  }, [habitId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const stats = useMemo(() => {
    const doneDates = events
      .filter((e) => e.action === "done")
      .map((e) => e.actionDate)
      .sort();
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

  const currentMonthEvents = useMemo(() => {
    return events.filter((e) => {
      const [y, m] = e.actionDate.split("-").map(Number);
      return y === calYear && m === calMonth + 1;
    });
  }, [events, calYear, calMonth]);

  const todayDoneEvent = useMemo(() => {
    return events.find((e) => e.action === "done" && e.actionDate === today);
  }, [events, today]);

  async function handleDone() {
    if (!habit) return;
    setBusy(true);
    try {
      if (todayDoneEvent) {
        await api.habitDeleteEvent(habit.id, todayDoneEvent.id);
      } else {
        await api.habitDone(habit.id);
      }
      await load();
      onDone?.();
    } catch {
      /* handled silently */
    } finally {
      setBusy(false);
    }
  }

  async function handlePush() {
    if (!habit) return;
    setBusy(true);
    try {
      await api.habitPush(habit.id);
      await load();
      onDone?.();
    } catch {
      /* handled silently */
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    if (!habit) return;
    setBusy(true);
    try {
      await api.habitSkip(habit.id);
      await load();
      onDone?.();
    } catch {
      /* handled silently */
    } finally {
      setBusy(false);
    }
  }

  async function handleManualDone(date: string) {
    if (!habit) return;
    setBusy(true);
    try {
      await api.habitManualDone(habit.id, date);
      await load();
      onDone?.();
    } catch {
      /* handled silently */
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEvent(event: HabitEvent) {
    if (!habit) return;
    setBusy(true);
    try {
      await api.habitDeleteEvent(habit.id, event.id);
      await load();
      onDone?.();
      setConfirmDeleteEvent(null);
    } catch {
      /* handled silently */
    } finally {
      setBusy(false);
    }
  }

  function navigateMonth(delta: number) {
    if (delta < 0) {
      if (calMonth === 0) {
        setCalMonth(11);
        setCalYear(calYear - 1);
      } else setCalMonth(calMonth - 1);
    } else {
      if (calMonth === 11) {
        setCalMonth(0);
        setCalYear(calYear + 1);
      } else setCalMonth(calMonth + 1);
    }
  }

  function resetMonth() {
    const now = nowInCST();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
  }

  return {
    habit,
    events,
    loading,
    busy,
    stats,
    today,
    calYear,
    calMonth,
    currentMonthEvents,
    todayDoneEvent,
    confirmDeleteEvent,
    setConfirmDeleteEvent,
    handleDone,
    handlePush,
    handleSkip,
    handleManualDone,
    handleDeleteEvent,
    navigateMonth,
    resetMonth,
    setCalYear,
    setCalMonth,
    load,
  };
}
