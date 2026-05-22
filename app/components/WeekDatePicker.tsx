import clsx from 'clsx'

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function getWeekDays(
  baseDate: string
): { label: string; date: string; day: number }[] {
  const [y, m, d] = baseDate.split('-').map(Number)
  const ref = new Date(y, m - 1, d)
  const dow = ref.getDay()
  const sun = new Date(ref)
  sun.setDate(sun.getDate() - dow)

  const days: { label: string; date: string; day: number }[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(sun)
    dt.setDate(dt.getDate() + i)
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    days.push({
      label: DAY_LABELS[dt.getDay()],
      date: `${dt.getFullYear()}-${mm}-${dd}`,
      day: dt.getDate(),
    })
  }
  return days
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

export default function WeekDatePicker(props: {
  today: string
  selectedDate: string
  weekOffset: number
  doneCounts: Map<string, number>
  onSelect: (date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onResetWeek?: () => void
}) {
  const refDate = addDays(props.today, props.weekOffset * 7)
  const days = getWeekDays(refDate)

  const first = days[0]!
  const last = days[6]!
  const [fy, fm] = first.date.split('-').map(Number)
  const [ly, lm] = last.date.split('-').map(Number)
  const rangeLabel =
    fy !== ly
      ? `${fy}/${fm} – ${ly}/${lm}`
      : fm !== lm
        ? `${fm}月${first.day}日 – ${lm}月${last.day}日`
        : `${fm}月${first.day}日 – ${last.day}日`

  return (
    <div className="px-3 py-2">
      {/* Week nav */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          className="btn text-[14px] px-2.5 py-1 font-bold"
          onClick={props.onPrevWeek}
        >
          ←
        </button>
        <span className="text-[14px] sm:text-[13px] font-semibold text-gray-600">
          {rangeLabel}
        </span>
        <button
          type="button"
          className="btn text-[14px] px-2.5 py-1 font-bold"
          onClick={props.onNextWeek}
        >
          →
        </button>
      </div>

      {/* Day cells */}
      <div className="flex items-start justify-between gap-0.5">
        {days.map((d) => {
          const isSelected = d.date === props.selectedDate
          const isToday = d.date === props.today
          const doneCount = props.doneCounts.get(d.date) ?? 0

          return (
            <button
              key={d.date}
              type="button"
              className={clsx(
                'flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 sm:py-1.5 transition flex-1',
                isSelected ? 'bg-[#ede7f6]' : 'hover:bg-black/[0.03]'
              )}
              onClick={() => props.onSelect(d.date)}
            >
              <span
                className={clsx(
                  'text-[12px] sm:text-[10px] font-medium',
                  isSelected ? 'text-[#7e57c2]' : 'text-gray-400'
                )}
              >
                {d.label}
              </span>
              <span
                className={clsx(
                  'text-[16px] sm:text-[14px] font-semibold leading-none w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-full',
                  isSelected
                    ? 'bg-[#7e57c2] text-white'
                    : isToday
                      ? 'text-[#7e57c2]'
                      : 'text-gray-600'
                )}
              >
                {d.day}
              </span>
              {/* Done count below date */}
              <span
                className={clsx(
                  'text-[11px] sm:text-[9px] font-medium leading-none h-3',
                  doneCount > 0
                    ? isSelected
                      ? 'text-[#7e57c2]'
                      : 'text-[#9e9e9e]'
                    : 'text-transparent'
                )}
              >
                {doneCount > 0 ? doneCount : '0'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
