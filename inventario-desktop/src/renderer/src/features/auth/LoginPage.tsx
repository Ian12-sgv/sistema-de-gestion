import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/auth/AuthProvider'

export function LoginPage() {
  const nav = useNavigate()
  const { signIn, loading, error } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const err = useMemo(() => localErr ?? error, [localErr, error])

  const usernameId = React.useId()
  const passwordId = React.useId()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalErr(null)

    if (!username.trim() || !password) {
      setLocalErr('Usuario y contraseña son obligatorios')
      return
    }

    setBusy(true)
    try {
      await signIn(username.trim(), password)

      // ✅ No dependemos del state `user` (puede tardar en actualizar).
      // Dejamos que AppRouter defaultRoute() decida: ADMIN→/admin, otros→/inventory
      nav('/', { replace: true })
    } catch (e: any) {
      setLocalErr(e?.message ?? 'Error al iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  async function onQuit() {
    await window.api.app.quit()
  }

  const disabled = busy || loading

  return (
    <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold leading-tight">Inventario</h1>
          <p className="text-sm text-fg-muted">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor={usernameId}>
              Usuario
            </label>
            <input
              id={usernameId}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="input"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="label" htmlFor={passwordId}>
              Contraseña
            </label>
            <input
              id={passwordId}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
            />
          </div>

          {err && (
            <div role="alert" className="alert alert-danger">
              {err}
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button className="btn btn-primary" disabled={disabled}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>

            <button type="button" onClick={onQuit} className="btn btn-secondary">
              Salir
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}