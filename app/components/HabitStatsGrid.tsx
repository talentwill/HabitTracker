export default function HabitStatsGrid(props: {
  doneCount: number
  avgGap: number | null
  lastGap: number | null
  pushCount: number
  skipCount: number
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div className="rounded-lg bg-warm-white px-3 py-3 text-center">
        <div className="text-[13px] sm:text-[11px] font-semibold text-muted-light">
          打卡次数
        </div>
        <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
          {props.doneCount}
        </div>
      </div>
      <div className="rounded-lg bg-warm-white px-3 py-3 text-center">
        <div className="text-[13px] sm:text-[11px] font-semibold text-muted-light">
          平均间隔
        </div>
        <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
          {props.avgGap ?? '—'}
          {props.avgGap ? (
            <span className="text-[13px] sm:text-[11px] text-muted-light ml-0.5">
              天
            </span>
          ) : null}
        </div>
      </div>
      <div className="rounded-lg bg-warm-white px-3 py-3 text-center">
        <div className="text-[13px] sm:text-[11px] font-semibold text-muted-light">
          最近间隔
        </div>
        <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
          {props.lastGap ?? '—'}
          {props.lastGap ? (
            <span className="text-[13px] sm:text-[11px] text-muted-light ml-0.5">
              天
            </span>
          ) : null}
        </div>
      </div>
      <div className="rounded-lg bg-warm-white px-3 py-3 text-center">
        <div className="text-[13px] sm:text-[11px] font-semibold text-muted-light">
          推迟/跳过
        </div>
        <div className="mt-0.5 text-[22px] font-bold tracking-[-0.25px] text-ink">
          {props.pushCount}/{props.skipCount}
        </div>
      </div>
    </div>
  )
}
