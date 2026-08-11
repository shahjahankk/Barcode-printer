import { useEffect, useState, type FormEvent } from 'react'
import { exchangeSso, login } from '../utils/api'

interface AuthGateProps {
  onUnlocked: () => void
}

export function AuthGate({ onUnlocked }: AuthGateProps) {
  const [username, setUsername] = useState('admin')
  const [password, setPasswordInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ssoBusy, setSsoBusy] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sso = params.get('sso')
    if (!sso) {
      setSsoBusy(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        await exchangeSso(sso)
        params.delete('sso')
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
        window.history.replaceState({}, '', next)
        if (!cancelled) onUnlocked()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'SSO login failed')
          setSsoBusy(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [onUnlocked])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const user = username.trim()
    const value = password.trim()
    if (!user || value.length < 4) {
      setError('Enter username and password (min 4 characters).')
      return
    }

    setBusy(true)
    try {
      await login(user, value)
      onUnlocked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  if (ssoBusy) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-stone-900">
        <p className="text-sm text-stone-600">Signing you in from POS…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-stone-900">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white/90 p-6 shadow-sm backdrop-blur">
        <p className="font-display text-2xl font-bold tracking-tight">LabelPress</p>
        <p className="mt-1 text-sm text-stone-600">
          Opened from PetZone? You should sign in automatically.
          Opening this link alone requires your LabelPress username and password.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-stone-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-stone-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
