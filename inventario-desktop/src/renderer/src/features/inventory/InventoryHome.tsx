import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/auth/AuthProvider'
import { formatNestError } from '../../api/errors'
import { getMeProfile } from './inventoryApi'
import { StockPanel } from './StockPanel'
import { MovementsPanel } from './MovementsPanel'
import { DocsPanel } from './DocsPanel'

type Tab = 'stock' | 'movements' | 'docs'

function isEditableTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = (t.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (t as any).isContentEditable
}

function NavButton({
  active,
  disabled,
  onClick,
  title,
  subtitle,
  shortcut
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  subtitle?: string
  shortcut?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full text-left rounded-md border px-3 py-2 transition',
        active ? 'bg-muted border-primary/30' : 'bg-surface border-border hover:bg-muted',
        disabled ? 'opacity-60 pointer-events-none' : ''
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          {subtitle ? <div className="text-xs text-fg-muted mt-0.5 truncate">{subtitle}</div> : null}
        </div>
        {shortcut ? <div className="text-[11px] text-fg-muted shrink-0">{shortcut}</div> : null}
      </div>
    </button>
  )
}

export function InventoryHome() {
  const nav = useNavigate()
  const { user, signOut } = useAuth()

  const [tab, setTab] = useState<Tab>('stock')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)

  const isAdmin = (user?.roles ?? []).includes('ADMIN')

  async function logout() {
    await signOut()
    nav('/login', { replace: true })
  }

  async function loadProfile() {
    setErr(null)
    setLoading(true)
    try {
      const p = await getMeProfile()
      setProfile(p)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hotkeys (desktop)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey) return
      if (isEditableTarget(e.target)) return

      if (e.key === '1') {
        e.preventDefault()
        setTab('stock')
      } else if (e.key === '2') {
        e.preventDefault()
        setTab('movements')
      } else if (e.key === '3') {
        e.preventDefault()
        setTab('docs')
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        loadProfile()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ctx = useMemo(() => {
    const warehouseId = profile?.defaultWarehouse?.id ?? profile?.defaultWarehouseId ?? null
    const warehouseName = profile?.defaultWarehouse?.name ?? null

    const branchId = profile?.defaultBranch?.id ?? profile?.defaultBranchId ?? null
    const branchName = profile?.defaultBranch?.name ?? null

    return { warehouseId, warehouseName, branchId, branchName }
  }, [profile])

  const title = tab === 'stock' ? 'Stock' : tab === 'movements' ? 'Movimientos / Kardex' : 'Documentos'

  return (
    <div className="h-screen bg-bg text-fg grid grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="border-r border-border bg-surface p-3 overflow-auto">
        <div className="px-2 pt-1">
          <div className="text-sm font-semibold tracking-wide">INVENTARIO</div>
          <div className="mt-2 text-xs text-fg-muted leading-relaxed">
            <div className="font-medium text-fg">{user?.username}</div>
            <div className="mt-0.5">Roles: {(user?.roles ?? []).join(', ') || '-'}</div>
          </div>
        </div>

        <div className="mt-3 border-t border-border" />

        <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2">
          <div className="text-xs text-fg-muted">Contexto</div>
          <div className="mt-1 text-sm">
            <div>
              <span className="text-fg-muted">Sucursal:</span>{' '}
              <span className="font-medium">{ctx.branchName ?? '(sin nombre)'}</span>{' '}
              {ctx.branchId ? <span className="text-xs text-fg-muted">({ctx.branchId})</span> : null}
            </div>
            <div className="mt-1">
              <span className="text-fg-muted">Bodega:</span>{' '}
              <span className="font-medium">{ctx.warehouseName ?? '(sin nombre)'}</span>{' '}
              {ctx.warehouseId ? <span className="text-xs text-fg-muted">({ctx.warehouseId})</span> : null}
            </div>
          </div>

          {!ctx.branchName || !ctx.warehouseName ? (
            <div className="mt-2 text-xs text-amber-700">
              Si ves “(sin nombre)”, tu backend aún no envía <b>defaultBranch/defaultWarehouse.name</b> en <b>/users/me/profile</b>.
            </div>
          ) : null}
        </div>

        <div className="mt-3 border-t border-border" />

        <div className="mt-3 space-y-2">
          <NavButton
            title="Stock"
            subtitle="Consulta / conteo rápido"
            shortcut="Ctrl+1"
            active={tab === 'stock'}
            onClick={() => setTab('stock')}
          />
          <NavButton
            title="Movimientos"
            subtitle="Kardex / histórico"
            shortcut="Ctrl+2"
            active={tab === 'movements'}
            onClick={() => setTab('movements')}
          />
          <NavButton
            title="Documentos"
            subtitle="DRAFT / POSTED + editor"
            shortcut="Ctrl+3"
            active={tab === 'docs'}
            onClick={() => setTab('docs')}
          />
        </div>

        <div className="mt-3 border-t border-border" />

        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={loadProfile}
            disabled={loading}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Recargar contexto <span className="text-xs text-fg-muted">(Ctrl+R)</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => nav('/admin', { replace: true })}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
            >
              Ir a Admin
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
          >
            Logout
          </button>
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-xs text-fg-muted">
          Tips: evita el mouse cuando puedas. <b>Ctrl+1/2/3</b> cambia de panel.
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">{title}</div>
            <div className="text-xs text-fg-muted">Inventario</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadProfile}
              disabled={loading}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Recargar
            </button>
          </div>
        </header>

        <div className="min-w-0 flex-1 overflow-auto p-4">
          {err ? (
            <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm mb-3">
              {err}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-lg border border-border bg-surface p-4 animate-pulse">
              <div className="h-4 w-44 bg-muted rounded" />
              <div className="mt-3 h-24 bg-muted rounded" />
            </div>
          ) : !ctx.warehouseId ? (
            <div className="rounded-lg border border-danger/30 bg-danger/5 text-danger p-4">
              Tu usuario no tiene <b>defaultWarehouseId</b>. Asigna una bodega al usuario desde Admin para poder trabajar inventario.
            </div>
          ) : (
            <>
              {tab === 'stock' && <StockPanel warehouseId={ctx.warehouseId} />}
              {tab === 'movements' && <MovementsPanel warehouseId={ctx.warehouseId} />}
              {tab === 'docs' && <DocsPanel warehouseId={ctx.warehouseId} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}