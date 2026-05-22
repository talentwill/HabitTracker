import { useEffect, useRef, useState } from "react";

import Heatmap from "../Heatmap";
import Modal from "../Modal";
import MonthCalendar from "../MonthCalendar";
import HabitStatsGrid from "../HabitStatsGrid";
import HabitEventList from "../HabitEventList";
import { useHabitDetail } from "../../hooks/useHabitDetail";
import type { Habit } from "../../lib/api";
import { diffDays, statusForDue } from "../../lib/date";
import { getFirstTextChar } from "../../lib/utils";

export default function MobileHabitSheet(props: {
  habitId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onEdit: (habit: Habit) => void;
}) {
  const d = useHabitDetail(props.habitId, undefined, props.onRefresh);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, currentY: 0, dragging: false });

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function close() {
    setVisible(false);
    setTimeout(props.onClose, 200);
  }

  function handleDragStart(e: React.TouchEvent) {
    dragRef.current = {
      startY: e.touches[0].clientY,
      currentY: 0,
      dragging: true,
    };
  }

  function handleDragMove(e: React.TouchEvent) {
    if (!dragRef.current.dragging) return;
    const delta = e.touches[0].clientY - dragRef.current.startY;
    if (delta < 0) return;
    dragRef.current.currentY = delta;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }

  function handleDragEnd() {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    if (dragRef.current.currentY > 80) {
      close();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
  }

  if (!props.habitId) return null;

  const status = statusForDue(d.habit?.nextDueDate ?? "", d.today);
  const canAct = d.habit ? !d.habit.archived : false;
  const doneToday = !!d.todayDoneEvent;

  return (
    <>
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          onClick={close}
          aria-label="Close"
        />

        <div
          ref={sheetRef}
          className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-deep h-[92vh] flex flex-col transition-transform duration-200 ease-out ${
            visible ? "translate-y-0" : "translate-y-full"
          }`}
        >
          {/* 拖拽条 */}
          <div
            className="flex justify-center pt-2 pb-1 touch-none cursor-pointer"
            onClick={close}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* 可滚动内容区 */}
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            {d.loading ? (
              <div className="flex items-center justify-center py-20 text-[15px] text-gray-400">
                加载中...
              </div>
            ) : !d.habit ? (
              <div className="flex items-center justify-center py-20 text-[15px] text-gray-400">
                未找到该习惯
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {/* 头部 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-[16px] font-bold bg-[#ede7f6] text-[#7e57c2] shrink-0">
                      {d.habit.icon || getFirstTextChar(d.habit.title)}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[18px] font-bold text-ink truncate">{d.habit.title}</h2>
                      {d.habit.note ? (
                        <div className="text-[14px] text-gray-400 mt-0.5 truncate">
                          {d.habit.note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {d.habit.tag ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold bg-[#e8f5e9] text-[#2e7d32]">
                        🏷 {d.habit.tag}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="btn text-[14px] px-2 py-1"
                      onClick={() => props.onEdit(d.habit!)}
                      title="编辑"
                    >
                      <span>⚙️</span>
                    </button>
                  </div>
                </div>

                {/* 操作按钮行 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {canAct && (
                    <>
                      <button
                        type="button"
                        className={
                          doneToday
                            ? "btn text-[14px] px-3 py-2 border border-[#ef5350] text-[#ef5350] hover:bg-[#fce4ec]"
                            : "btn btn-primary text-[14px] px-3 py-2"
                        }
                        onClick={d.handleDone}
                        disabled={d.busy}
                      >
                        {doneToday ? (
                          <>
                            <span>↩️</span>
                            <span>取消打卡</span>
                          </>
                        ) : (
                          <>
                            <span>✅</span>
                            <span>打卡</span>
                          </>
                        )}
                      </button>
                      {!doneToday && (status === "overdue" || status === "today") && (
                        <>
                          <button
                            type="button"
                            className="btn text-[14px] px-3 py-2"
                            onClick={d.handlePush}
                            disabled={d.busy}
                          >
                            <span>⏰</span>
                            <span>明天</span>
                          </button>
                          <button
                            type="button"
                            className="btn text-[14px] px-3 py-2"
                            onClick={d.handleSkip}
                            disabled={d.busy}
                          >
                            <span>⏭</span>
                            <span>跳过</span>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* 状态标签行 */}
                <div className="flex flex-wrap items-center gap-2">
                  {d.habit.startDate ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold bg-[#fff3e0] text-[#e65100]">
                      📆 {d.habit.startDate}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold bg-[#ede7f6] text-[#7e57c2]">
                    🔄 每{d.habit.intervalDays}天
                  </span>
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
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold ${colorClass}`}
                      >
                        📅 {d.habit.nextDueDate} {suffix}
                      </span>
                    );
                  })()}
                </div>

                <HabitStatsGrid {...d.stats} />

                {/* 热力图 */}
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

                {/* 月历 */}
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

                {/* 打卡记录 */}
                <div className="paper px-4 py-3">
                  <div className="text-[15px] font-semibold text-ink mb-2">打卡记录</div>
                  <HabitEventList
                    events={d.currentMonthEvents}
                    calYear={d.calYear}
                    calMonth={d.calMonth}
                    busy={d.busy}
                    onDelete={(e) => d.setConfirmDeleteEvent(e)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <Modal
        open={!!d.confirmDeleteEvent}
        title="确认删除记录"
        onClose={() => d.setConfirmDeleteEvent(null)}
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              className="btn text-[14px] px-4 py-2"
              onClick={() => d.setConfirmDeleteEvent(null)}
              disabled={d.busy}
            >
              取消
            </button>
            <button
              type="button"
              className="btn bg-[#ef5350] text-white hover:bg-[#d32f2f] text-[14px] px-4 py-2 border-none"
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
