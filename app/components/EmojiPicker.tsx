import { useEffect, useRef, useState } from 'react'
import { EMOJI_CATEGORIES } from '../lib/emojiData'

export default function EmojiPicker(props: {
  value: string | null
  onSelect: (emoji: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const [activeCategory, setActiveCategory] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        props.onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [props.onClose])

  const category = EMOJI_CATEGORIES[activeCategory]!

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 bg-[#f7f4ed] border border-[#eceae4] rounded-xl shadow-sm p-3 w-[280px]"
    >
      {/* Category tabs */}
      <div className="flex gap-1 mb-2 border-b border-[#eceae4] pb-2 overflow-x-auto">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            type="button"
            className={`px-2 py-0.5 rounded-full text-[12px] whitespace-nowrap transition ${
              i === activeCategory
                ? 'bg-[#1c1c1c] text-[#fcfbf8]'
                : 'text-[#5f5f5d] hover:bg-[rgba(28,28,28,0.04)]'
            }`}
            onClick={() => setActiveCategory(i)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5">
        {category.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`w-8 h-8 flex items-center justify-center rounded-md text-[18px] transition ${
              props.value === emoji
                ? 'bg-[#ede7f6]'
                : 'hover:bg-[rgba(28,28,28,0.04)]'
            }`}
            onClick={() => {
              props.onSelect(emoji)
              props.onClose()
            }}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Clear button */}
      {props.value && (
        <div className="mt-2 pt-2 border-t border-[#eceae4] flex justify-end">
          <button
            type="button"
            className="text-[11px] text-[#7e57c2] hover:underline"
            onClick={() => {
              props.onClear()
              props.onClose()
            }}
          >
            清除图标
          </button>
        </div>
      )}
    </div>
  )
}
