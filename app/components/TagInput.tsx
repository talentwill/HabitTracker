import { useRef, useState } from 'react'

const TAG_COLORS = [
  { bg: '#ede7f6', text: '#5e35b1' },
  { bg: '#e3f2fd', text: '#1565c0' },
  { bg: '#e8f5e9', text: '#2e7d32' },
  { bg: '#fff3e0', text: '#e65100' },
  { bg: '#fce4ec', text: '#c2185b' },
  { bg: '#e0f7fa', text: '#00838f' },
  { bg: '#fff8e1', text: '#f9a825' },
  { bg: '#f3e5f5', text: '#7b1fa2' },
]

function tagColor(tag: string): React.CSSProperties {
  let hash = 0
  for (let i = 0; i < tag.length; i++)
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  const c = TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
  return { backgroundColor: c.bg, color: c.text }
}

export { tagColor }

export default function TagInput(props: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
}) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const query = props.value.trim().toLowerCase()
  const filtered = query
    ? props.suggestions.filter(
        (t) => t.toLowerCase().includes(query) && t !== props.value
      )
    : props.suggestions.filter((t) => t !== props.value)

  // 如果 query 不为空且没有完全匹配的已有标签，则允许"创建新标签"选项
  const exactMatch = props.suggestions.some(
    (t) => t.toLowerCase() === query && t !== props.value
  )
  const canCreate = query.length > 0 && !exactMatch

  const showDropdown = focused && (filtered.length > 0 || canCreate)

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          className="input mt-0 flex-1 text-[16px] sm:text-[12px]"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="选择或创建标签"
          maxLength={30}
        />
        {props.value ? (
          <button
            type="button"
            className="mt-1 text-[11px] text-muted-light hover:text-ink"
            onClick={() => props.onChange('')}
          >
            清除
          </button>
        ) : null}
      </div>
      {showDropdown ? (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-md border border-line bg-paper shadow-lg max-h-36 overflow-y-auto">
          {filtered.slice(0, 8).map((t) => (
            <button
              key={t}
              type="button"
              className="w-full px-3 py-1.5 text-left text-[14px] sm:text-[12px] hover:bg-warm-white flex items-center gap-1.5"
              onMouseDown={() => {
                props.onChange(t)
                inputRef.current?.blur()
              }}
            >
              <span
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[12px] sm:text-[10px] font-semibold"
                style={tagColor(t)}
              >
                {t}
              </span>
            </button>
          ))}
          {canCreate && (
            <button
              key="__create__"
              type="button"
              className="w-full px-3 py-1.5 text-left text-[14px] sm:text-[12px] hover:bg-warm-white text-accent flex items-center gap-1.5 border-t border-line"
              onMouseDown={() => {
                props.onChange(query)
                inputRef.current?.blur()
              }}
            >
              <span className="text-[12px] sm:text-[10px]">+</span>
              <span>创建标签: {query}</span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
