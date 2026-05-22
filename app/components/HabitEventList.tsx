import type { HabitEvent } from "../lib/api";
import { diffDays } from "../lib/date";

export default function HabitEventList(props: {
  events: HabitEvent[];
  calYear: number;
  calMonth: number;
  busy: boolean;
  onDelete: (event: HabitEvent) => void;
}) {
  const { events, calYear, calMonth, busy, onDelete } = props;

  if (events.length === 0) {
    return (
      <div className="text-[14px] sm:text-[12px] text-gray-400">
        {calYear}年 {calMonth + 1}月 暂无打卡记录
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {[...events]
        .sort((a, b) => b.actionDate.localeCompare(a.actionDate))
        .map((e, idx, sorted) => {
          let gapText = "";
          if (idx < sorted.length - 1) {
            const gap = Math.abs(diffDays(sorted[idx + 1]!.actionDate, e.actionDate));
            gapText = `距离上次打卡间隔 ${gap} 天`;
          }
          return (
            <div
              key={e.id}
              className="flex items-center justify-between text-[14px] sm:text-[12px] py-0.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-ink font-medium shrink-0">{e.actionDate}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[12px] sm:text-[10px] font-semibold shrink-0 ${
                    e.action === "done"
                      ? "bg-[#e8f5e9] text-[#43a047]"
                      : e.action === "push"
                        ? "bg-[#fff3e0] text-[#f57c00]"
                        : "bg-[#f3e5f5] text-[#8e24aa]"
                  }`}
                >
                  {e.action === "done" ? "打卡" : e.action === "push" ? "明天" : "跳过"}
                </span>
                {e.action === "push" && e.toDueDate ? (
                  <span className="text-gray-400 text-[13px] sm:text-[11px] truncate">
                    → {e.toDueDate}
                  </span>
                ) : e.action === "skip" && e.toDueDate ? (
                  <span className="text-gray-400 text-[13px] sm:text-[11px] truncate">
                    → {e.toDueDate}
                  </span>
                ) : gapText ? (
                  <span className="text-gray-400 text-[12px] sm:text-[10px] truncate">
                    （{gapText}）
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="text-gray-300 hover:text-[#ef5350] transition-colors p-1 shrink-0"
                title="删除记录"
                onClick={() => onDelete(e)}
                disabled={busy}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
    </div>
  );
}
