import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import * as api from '../lib/api'

type AuthContextValue = {
  user: api.User | null
  loading: boolean
  login: (args: { email: string; password: string }) => Promise<void>
  register: (args: {
    email: string
    password: string
    name?: string
  }) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<api.User | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const res = await api.me()
      setUser(res.user)
    } catch {
      setUser(null)
    }
  }

  async function login(args: { email: string; password: string }) {
    const res = await api.login(args)
    setUser(res.user)
  }

  async function register(args: {
    email: string
    password: string
    name?: string
  }) {
    const res = await api.register(args)
    setUser(res.user)
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.me()
        if (!cancelled) setUser(res.user)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
