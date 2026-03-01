import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { login as apiLogin, me as apiMe, type AuthMe, type SafeUser } from '../../features/auth/authApi'
import { setMemToken } from '../../api/http'
import { formatNestError } from '../../api/errors'

type AuthState = {
  loading: boolean
  token: string | null
  user: (AuthMe & { safeUser?: SafeUser }) | null
  error: string | null
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider missing')
  return v
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<(AuthMe & { safeUser?: SafeUser }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const t = await window.api.auth.getToken()
        setToken(t)
        setMemToken(t)
        if (t) {
          const u = await apiMe()
          setUser(u)
        }
      } catch {
        setToken(null)
        setMemToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function signIn(username: string, password: string) {
    setError(null)

    const res = await apiLogin(username, password).catch((e) => {
      throw new Error(formatNestError(e))
    })

    await window.api.auth.setToken(res.access_token)
    setToken(res.access_token)
    setMemToken(res.access_token)

    const u = await apiMe().catch(() => null)
    setUser(
      u
        ? { ...u, safeUser: res.user }
        : { id: res.user.id, username: res.user.username, fullName: res.user.fullName, roles: res.user.roles, safeUser: res.user }
    )
  }

  async function signOut() {
    await window.api.auth.clearToken()
    setToken(null)
    setMemToken(null)
    setUser(null)
  }

  const value = useMemo<AuthState>(
    () => ({ loading, token, user, error, signIn, signOut }),
    [loading, token, user, error]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}