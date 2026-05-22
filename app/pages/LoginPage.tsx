import { useMemo, useState } from 'react'

import { ApiError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

function errorText(err: unknown): string {
  if (!(err instanceof ApiError)) return '网络或服务器错误'
  switch (err.code) {
    case 'EMAIL_IN_USE':
      return '这个邮箱已经注册过了'
    case 'INVALID_CREDENTIALS':
      return '邮箱或密码不正确'
    case 'BAD_REQUEST':
      return '请检查输入格式（邮箱 / 密码长度）'
    default:
      return `请求失败：${err.code}`
  }
}

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = useMemo(() => (mode === 'login' ? '登录' : '注册'), [mode])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') {
        await login({ email, password })
      } else {
        await register({
          email,
          password,
          name: name.trim() ? name.trim() : undefined,
        })
      }
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex items-start justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-[400px]">
        <div className="paper px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[14px] font-medium text-muted">
                Habit Tracker
              </div>
              <h1 className="mt-2 text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink">
                {title}
              </h1>
              <p className="mt-2 text-[14px] text-muted leading-[1.5]">
                本地部署版本：数据保存在本机 SQLite 文件里。
              </p>
            </div>
            <span className="pill mt-1">Local</span>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            {mode === 'register' ? (
              <div>
                <div className="label">昵称（可选）</div>
                <input
                  className="input mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：Will"
                  autoComplete="nickname"
                />
              </div>
            ) : null}

            <div>
              <div className="label">邮箱</div>
              <input
                className="input mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="label">密码</div>
              <input
                className="input mt-1"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? '至少 8 位' : '输入密码'}
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
                {error}
              </div>
            ) : null}

            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? '请稍等…' : mode === 'login' ? '登录' : '创建账号'}
            </button>

            <div className="text-center text-[14px] text-muted">
              {mode === 'login' ? (
                <>
                  还没有账号？{' '}
                  <button
                    type="button"
                    className="font-semibold text-accent hover:underline"
                    onClick={() => setMode('register')}
                  >
                    去注册
                  </button>
                </>
              ) : (
                <>
                  已经有账号？{' '}
                  <button
                    type="button"
                    className="font-semibold text-accent hover:underline"
                    onClick={() => setMode('login')}
                  >
                    去登录
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        <div className="mt-3 text-[12px] text-muted-light px-1">
          提示：如果忘了密码，直接删除数据库文件即可重置本地数据（仅本机）。
        </div>
      </div>
    </div>
  )
}
