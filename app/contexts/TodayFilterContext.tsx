import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'

import type { Habit } from '../lib/api'
import type { FilterTab } from '../components/FilterTabs'

type TodayFilterState = {
  filterTab: FilterTab
  habits: Habit[]
  today: string
}

type TodayFilterContextValue = TodayFilterState & {
  setFilter: (state: TodayFilterState) => void
}

const TodayFilterContext = createContext<TodayFilterContextValue | null>(null)

export function TodayFilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TodayFilterState>({
    filterTab: 'all',
    habits: [],
    today: '',
  })

  const setFilter = useCallback((s: TodayFilterState) => setState(s), [])

  const value = useMemo(() => ({ ...state, setFilter }), [state, setFilter])

  return (
    <TodayFilterContext.Provider value={value}>
      {children}
    </TodayFilterContext.Provider>
  )
}

export function useTodayFilter() {
  return useContext(TodayFilterContext)
}
