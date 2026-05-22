import Heatmap from "../Heatmap";
import Modal from "../Modal";
import MonthCalendar from "../MonthCalendar";
import HabitStatsGrid from "../HabitStatsGrid";
import HabitEventList from "../HabitEventList";
import { useHabitDetail } from "../../hooks/useHabitDetail";
import type { Habit } from "../../lib/api";
import { diffDays, statusForDue } from "../../lib/date";
import { getFirstTextChar } from "../../lib/utils";

export default function HabitDetailPanel(props: {
  habitId: string | null;
  onDone: () => void;
  onEdit: (habit: Habit) => void;
  refreshKey?: number;
}) {
  const d = useHabitDetail(props.habitId, props.refreshKey, props.onDone);

  if (!props.habitId) {
    return (
      <div className="flex-1 flex items-center justify-center text-[14px] text-gray-400">
        请选择一个习惯查看详情
      </div>
    );
  }

  if (d.loading) {
    return <div className="flex-1 p-6 text-[14px] text-gray-400">加载中...</div>;
  }

  if (!d.habit) {
    return <div className="flex-1 p-6 text-[14px] text-gray-400">未找到</div>;
  }

  const doneToday = !!d.todayDoneEvent;
  const status = statusForDue(d.habit.nextDueDate, d.today);
  const canAct = !d.habit.archived;

  return (
    <>
      <div className="flex flex-col">
        <div className="flex-1 p-5">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-[16px] font-bold bg-[#ede7f6] text-[#7e57c2] shrink-0">
                  {d.habit.icon || getFirstTextChar(d.habit.title)}
                </span>
                <div>
                  <h2 className="text-[16px] font-bold text-ink">{d.habit.title}</h2>
                  {d.habit.note ? (
                    <div className="text-[12px] text-gray-400 mt-0.5">{d.habit.note}</div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {d.habit.tag ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#e8f5e9] text-[#2e7d32]">
                    🏷 {d.habit.tag}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="btn text-[12px] px-2 py-1"
                  onClick={() => props.onEdit(d.habit!)}
                  title="更多操作"
                >
                  <span>⚙️</span>
                </button>
              </div>
            </div>

            {/* Actions & Status */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1.5 mr-auto">
                {canAct && (
                  <>
                    <button
                      type="button"
                      className={
                        doneToday
                          ? "btn text-[12px] px-2 sm:px-3 py-1 border border-[#ef5350] text-[#ef5350] hover:bg-[#fce4ec]"
                          : "btn btn-primary text-[12px] px-2 sm:px-3 py-1"
                      }
                      onClick={d.handleDone}
                      disabled={d.busy}
                    >
                      {doneToday ? (
                        <>
                          <span>↩️</span>
                          <span className="hidden sm:inline">取消打卡</span>
                        </>
                      ) : (
                        <>
                          <span>✅</span>
                          <span className="hidden sm:inline">打卡</span>
                        </>
                      )}
                    </button>
                    {!doneToday && (status === "overdue" || status === "today") && (
                      <>
                        <button
                          type="button"
                          className="btn text-[12px] px-2 sm:px-3 py-1"
                          onClick={d.handlePush}
                          disabled={d.busy}
                        >
                          <span>⏰</span>
                          <span className="hidden sm:inline">明天</span>
                        </button>
                        <button
                          type="button"
                          className="btn text-[12px] px-2 sm:px-3 py-1"
                          onClick={d.handleSkip}
                          disabled={d.busy}
                        >
                          <span>⏭</span>
                          <span className="hidden sm:inline">跳过</span>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {d.habit.startDate ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#fff3e0] text-[#e65100]">
                    📆 {d.habit.startDate}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#ede7f6] text-[#7e57c2]">
                  🔄 每{d.habit.intervalDays}天
                </span>
              </div>
              {(() => {
                const daysUntil = diffDays(d.today, d.habit.nextDueDate);
                const isOverdue = daysUntil < 0;
                const isToday = daysUntil === 0;
                const suffix = isOverdue
                  ? `（逾期${Math.abs(daysUntil)}天）`
                  : isToday
                    ? "（今天）"
                    : daysUntil === 1
                      ? "（明天）"
                      : `（还剩${daysUntil}天）`;
                const colorClass = isOverdue
                  ? "bg-[#fce4ec] text-[#c62828]"
                  : isToday
                    ? "bg-[#fff3e0] text-[#e65100]"
                    : "bg-[#e3f2fd] text-[#1565c0]";
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${colorClass}`}
                  >
                    📅 {d.habit.nextDueDate} {suffix}
                  </span>
                );
              })()}
            </div>

            <HabitStatsGrid {...d.stats} />

            {/* Heatmap */}
            <div className="paper px-4 py-3">
              <Heatmap
                events={d.events}
                nextDueDate={d.habit.nextDueDate}
                onMonthClick={(y, m) => {
                  d.setCalYear(y);
                  d.setCalMonth(m);
                }}
              />
            </div>

            {/* Month Calendar */}
            <div className="paper px-4 py-3">
              <MonthCalendar
                events={d.events}
                nextDueDate={d.habit.nextDueDate}
                startDate={d.habit.startDate}
                year={d.calYear}
                month={d.calMonth}
                onReset={d.resetMonth}
                onPrev={() => d.navigateMonth(-1)}
                onNext={() => d.navigateMonth(1)}
                onDateClick={async (date, event) => {
                  if (!d.habit) return;
                  if (event && (event.action === "done" || event.action === "push")) {
                    d.setConfirmDeleteEvent(event);
                  } else {
                    await d.handleManualDone(date);
                  }
                }}
              />
            </div>

            {/* Habit Log */}
            <div className="paper px-4 py-3">
              <div className="text-[13px] font-semibold text-ink mb-2">打卡记录</div>
              <HabitEventList
                events={d.currentMonthEvents}
                calYear={d.calYear}
                calMonth={d.calMonth}
                busy={d.busy}
                onDelete={(e) => d.setConfirmDeleteEvent(e)}
              />
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={!!d.confirmDeleteEvent}
        title="确认删除记录"
        onClose={() => d.setConfirmDeleteEvent(null)}
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              className="btn text-[13px] px-4 py-1.5"
              onClick={() => d.setConfirmDeleteEvent(null)}
              disabled={d.busy}
            >
              取消
            </button>
            <button
              type="button"
              className="btn bg-[#ef5350] text-white hover:bg-[#d32f2f] text-[13px] px-4 py-1.5 border-none"
              onClick={() => {
                if (d.confirmDeleteEvent) d.handleDeleteEvent(d.confirmDeleteEvent);
              }}
              disabled={d.busy}
            >
              删除
            </button>
          </div>
        }
      >
        <div className="py-2 text-[14px] text-gray-600">
          确定要删除 {d.confirmDeleteEvent?.actionDate} 的
          <span className="font-bold text-ink mx-1">
            {d.confirmDeleteEvent?.action === "done"
              ? "打卡"
              : d.confirmDeleteEvent?.action === "push"
                ? "明天"
                : "跳过"}
          </span>
          记录吗？该操作无法恢复。
        </div>
      </Modal>
    </>
  );
}
