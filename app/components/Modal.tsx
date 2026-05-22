import React from 'react'

export default function Modal(props: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
  footer?: React.ReactNode
}) {
  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-hidden">
      <button
        type="button"
        className="fixed inset-0 bg-ink/30 backdrop-blur-[2px]"
        onClick={props.onClose}
        aria-label="Close"
      />
      <div className="relative w-full sm:max-w-xl bg-white border border-line rounded-t-xl sm:rounded-xl px-5 py-5 sm:px-6 sm:py-6 max-h-[75vh] sm:max-h-[90vh] overflow-y-auto flex flex-col shadow-deep">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[18px] font-bold tracking-[-0.25px] text-ink">
            {props.title}
          </h2>
        </div>
        <div className="mt-4 flex-1 overflow-y-auto">{props.children}</div>
        {props.footer ? (
          <div className="mt-4 flex gap-2 border-t border-line pt-4 sm:border-0 sm:pt-0">
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
