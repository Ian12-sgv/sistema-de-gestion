import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/auth/AuthProvider'
import { formatNestError } from '../../api/errors'
import {
  type Role,
  type SafeUser,
  changeUserPassword,
  createUser,
  listRoles,
  listUsers,
  setUserRoles,
  updateUser,

  // branches/warehouses
  type Branch,
  type Warehouse,
  createBranch,
  createWarehouse,
  listBranches,
  listWarehouses,
  updateBranch,
  updateWarehouse,

  // products
  type Product,
  type ProductAudit,
  createProduct,
  deactivateProduct,
  getProductAudit,
  listProducts,
  updateProduct
} from './AdminApi'

type View = 'users' | 'products' | 'branches' | 'warehouses'

function isEditableTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = (t.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (t as any).isContentEditable
}

function SectionButton({
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

function ModalShell({
  title,
  children,
  onClose,
  busy,
  maxWidth = 'max-w-4xl'
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  busy?: boolean
  maxWidth?: string
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeBtnRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onMouseDown={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={['w-full', maxWidth, 'bg-surface border border-border rounded-lg shadow-elev-2 p-4'].join(' ')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">{title}</h3>
            <div className="text-xs text-fg-muted mt-0.5">ESC para cerrar</div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

function RolesChecklist({
  roles,
  selected,
  onChange
}: {
  roles: Role[]
  selected: string[]
  onChange: (codes: string[]) => void
}) {
  const set = new Set(selected)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {roles.map((r) => (
        <label
          key={r.id}
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 hover:bg-muted transition"
        >
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={set.has(r.code)}
            onChange={(e) => {
              const next = new Set(selected)
              if (e.target.checked) next.add(r.code)
              else next.delete(r.code)
              onChange(Array.from(next))
            }}
          />
          <span className="text-sm">{r.code}</span>
        </label>
      ))}
    </div>
  )
}

function TableShell({ children, minWidth }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-surface overflow-hidden">
      <div className="max-h-[calc(100vh-220px)] overflow-auto">
        <table className="w-full border-collapse text-sm" style={minWidth ? { minWidth } : undefined}>
          {children}
        </table>
      </div>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={[
        'sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-xs font-semibold text-fg-muted',
        align === 'right' ? 'text-right' : 'text-left'
      ].join(' ')}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={['border-b border-border/60 px-3 py-2 align-top', align === 'right' ? 'text-right' : 'text-left'].join(' ')}>
      {children}
    </td>
  )
}

function branchLabel(b: Branch) {
  return `${b.code} — ${b.name} (ID: ${b.id})`
}

function warehouseLabel(w: Warehouse) {
  const bn = w.branch?.name ?? 'Sin sucursal'
  return `${w.code} — ${w.name} | ${bn} (ID: ${w.id})`
}

function branchTypeLabel(type?: string | null) {
  const t = String(type ?? '').toUpperCase()
  if (t === 'CENTRAL') return 'Sede central'
  if (t === 'BRANCH') return 'Sucursal'
  return type ?? '-'
}

export function AdminHome() {
  const nav = useNavigate()
  const { user, signOut } = useAuth()

  const [view, setView] = useState<View>('users')

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Users
  const [users, setUsers] = useState<SafeUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [qUsers, setQUsers] = useState('')

  // Products
  const [products, setProducts] = useState<Product[]>([])
  const [qProducts, setQProducts] = useState('')

  // Branches
  const [branches, setBranches] = useState<Branch[]>([])
  const [qBranches, setQBranches] = useState('')

  // Warehouses
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [qWarehouses, setQWarehouses] = useState('')
  const [warehousesBranchFilter, setWarehousesBranchFilter] = useState<string>('') // '' = todas

  // Modales Usuarios
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null)

  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pwdUser, setPwdUser] = useState<SafeUser | null>(null)

  const [showRolesModal, setShowRolesModal] = useState(false)
  const [rolesUser, setRolesUser] = useState<SafeUser | null>(null)
  const [rolesSelected, setRolesSelected] = useState<string[]>([])

  // Modales Productos
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const [showAuditModal, setShowAuditModal] = useState(false)
  const [auditProduct, setAuditProduct] = useState<Product | null>(null)
  const [auditRows, setAuditRows] = useState<ProductAudit[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  // Modales Branches
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)

  // Modales Warehouses
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)

  async function reloadUsersAndRoles() {
    setErr(null)
    setLoading(true)
    try {
      const [u, r] = await Promise.all([listUsers(), listRoles()])
      setUsers(u)
      setRoles(r)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setLoading(false)
    }
  }

  async function reloadProducts() {
    setErr(null)
    setLoading(true)
    try {
      const p = await listProducts()
      setProducts(p)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setLoading(false)
    }
  }

  async function reloadBranches() {
    setErr(null)
    setLoading(true)
    try {
      const b = await listBranches(qBranches || undefined)
      setBranches(b)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setLoading(false)
    }
  }

  async function reloadWarehouses() {
    setErr(null)
    setLoading(true)
    try {
      const branchId = warehousesBranchFilter.trim() ? warehousesBranchFilter.trim() : null
      const w = await listWarehouses(branchId, qWarehouses || undefined)
      setWarehouses(w)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setLoading(false)
    }
  }

  async function reloadCurrentView() {
    if (view === 'users') return reloadUsersAndRoles()
    if (view === 'products') return reloadProducts()
    if (view === 'branches') return reloadBranches()
    return reloadWarehouses()
  }

  useEffect(() => {
    reloadUsersAndRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hotkeys
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey) return
      if (isEditableTarget(e.target)) return

      if (e.key === '1') {
        e.preventDefault()
        setView('users')
        reloadUsersAndRoles()
      } else if (e.key === '2') {
        e.preventDefault()
        setView('products')
        reloadProducts()
      } else if (e.key === '3') {
        e.preventDefault()
        setView('branches')
        reloadBranches()
      } else if (e.key === '4') {
        e.preventDefault()
        setView('warehouses')
        reloadWarehouses()
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        reloadCurrentView()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const filteredUsers = useMemo(() => {
    const s = qUsers.trim().toLowerCase()
    if (!s) return users
    return users.filter((u) => (u.username ?? '').toLowerCase().includes(s) || (u.fullName ?? '').toLowerCase().includes(s))
  }, [users, qUsers])

  const filteredProducts = useMemo(() => {
    const s = qProducts.trim().toLowerCase()
    if (!s) return products
    return products.filter((p) => {
      const hay = [
        p.barcode,
        p.reference ?? '',
        p.brand ?? '',
        p.description ?? '',
        p.category ?? '',
        p.status ?? '',
        p.brandCode ?? '',
        p.size ?? '',
        p.color ?? '',
        p.containerNumber ?? '',
        p.billingNumber ?? ''
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(s)
    })
  }, [products, qProducts])

  const filteredBranches = useMemo(() => {
    const s = qBranches.trim().toLowerCase()
    if (!s) return branches
    return branches.filter((b) => `${b.code} ${b.name}`.toLowerCase().includes(s))
  }, [branches, qBranches])

  const filteredWarehouses = useMemo(() => {
    const s = qWarehouses.trim().toLowerCase()
    if (!s) return warehouses
    return warehouses.filter((w) => `${w.code} ${w.name} ${(w.branch?.name ?? '')} ${(w.branch?.code ?? '')}`.toLowerCase().includes(s))
  }, [warehouses, qWarehouses])

  async function logout() {
    await signOut()
    nav('/login', { replace: true })
  }

  // ===== Users actions
  function openCreateUser() {
    setEditingUser(null)
    setShowUserModal(true)
  }

  function openEditUser(u: SafeUser) {
    setEditingUser(u)
    setShowUserModal(true)
  }

  function openPwd(u: SafeUser) {
    setPwdUser(u)
    setShowPwdModal(true)
  }

  function openRoles(u: SafeUser) {
    setRolesUser(u)
    setRolesSelected(u.roles ?? [])
    setShowRolesModal(true)
  }

  async function onSaveRoles() {
    if (!rolesUser) return
    setBusy(true)
    setErr(null)
    try {
      const updated = await setUserRoles(rolesUser.id, rolesSelected)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      setShowRolesModal(false)
      setRolesUser(null)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setBusy(false)
    }
  }

  // ===== Products actions
  function openCreateProduct() {
    setEditingProduct(null)
    setShowProductModal(true)
  }

  function openEditProduct(p: Product) {
    setEditingProduct(p)
    setShowProductModal(true)
  }

  async function onDeactivateProduct(p: Product) {
    const ok = confirm(`¿Desactivar producto?\nBarcode: ${p.barcode}\nEsto lo marcará como INACTIVE.`)
    if (!ok) return

    setBusy(true)
    setErr(null)
    try {
      const updated = await deactivateProduct(p.id)
      setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setBusy(false)
    }
  }

  async function openAudit(p: Product) {
    setShowAuditModal(true)
    setAuditProduct(p)
    setAuditRows([])
    setAuditLoading(true)
    setErr(null)
    try {
      const rows = await getProductAudit(p.id)
      setAuditRows(rows)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setAuditLoading(false)
    }
  }

  // ===== Branch actions
  function openCreateBranch() {
    setEditingBranch(null)
    setShowBranchModal(true)
  }

  function openEditBranch(b: Branch) {
    setEditingBranch(b)
    setShowBranchModal(true)
  }

  // ===== Warehouse actions
  function openCreateWarehouse() {
    setEditingWarehouse(null)
    setShowWarehouseModal(true)
  }

  function openEditWarehouse(w: Warehouse) {
    setEditingWarehouse(w)
    setShowWarehouseModal(true)
  }

  const pageTitle =
    view === 'users'
      ? 'Usuarios'
      : view === 'products'
      ? 'Productos'
      : view === 'branches'
      ? 'Sucursales'
      : 'Bodegas'

  const createButton =
    view === 'users'
      ? { label: '+ Crear usuario', onClick: openCreateUser }
      : view === 'products'
      ? { label: '+ Crear producto', onClick: openCreateProduct }
      : view === 'branches'
      ? { label: '+ Crear sucursal', onClick: openCreateBranch }
      : { label: '+ Crear bodega', onClick: openCreateWarehouse }

  return (
    <div className="h-screen bg-bg text-fg grid grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="border-r border-border bg-surface p-3 overflow-auto">
        <div className="px-2 pt-1">
          <div className="text-sm font-semibold tracking-wide">ADMIN</div>
          <div className="mt-2 text-xs text-fg-muted leading-relaxed">
            <div className="font-medium text-fg">{user?.username}</div>
            <div className="mt-0.5">Roles: {(user?.roles ?? []).join(', ') || '-'}</div>
          </div>
        </div>

        <div className="mt-3 border-t border-border" />

        <div className="mt-3 space-y-2">
          <SectionButton
            title="Usuarios"
            subtitle="Gestión de usuarios"
            shortcut="Ctrl+1"
            active={view === 'users'}
            disabled={busy}
            onClick={() => {
              setView('users')
              reloadUsersAndRoles()
            }}
          />

          <SectionButton
            title="Productos"
            subtitle="CRUD + auditoría"
            shortcut="Ctrl+2"
            active={view === 'products'}
            disabled={busy}
            onClick={() => {
              setView('products')
              reloadProducts()
            }}
          />

          <SectionButton
            title="Sucursales"
            subtitle="Crear/editar tiendas"
            shortcut="Ctrl+3"
            active={view === 'branches'}
            disabled={busy}
            onClick={() => {
              setView('branches')
              reloadBranches()
            }}
          />

          <SectionButton
            title="Bodegas"
            subtitle="Crear/editar bodegas (con o sin sucursal)"
            shortcut="Ctrl+4"
            active={view === 'warehouses'}
            disabled={busy}
            onClick={() => {
              setView('warehouses')
              // también carga sucursales para el filtro
              reloadBranches()
              reloadWarehouses()
            }}
          />
        </div>

        <div className="mt-3 border-t border-border" />

        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={reloadCurrentView}
            disabled={loading || busy}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Recargar <span className="text-xs text-fg-muted">(Ctrl+R)</span>
          </button>

          <button
            type="button"
            onClick={() => nav('/inventory')}
            disabled={busy}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Ir a Inventario
          </button>

          <button
            type="button"
            onClick={logout}
            disabled={busy}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Logout
          </button>
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-xs text-fg-muted">
          Atajos: <b>Ctrl+1/2/3/4</b> cambia de sección.
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">{pageTitle}</div>
            <div className="text-xs text-fg-muted">Administración</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={createButton.onClick}
              disabled={loading || busy}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50"
            >
              {createButton.label}
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
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="mt-3 h-9 bg-muted rounded" />
              <div className="mt-3 h-40 bg-muted rounded" />
            </div>
          ) : view === 'users' ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={qUsers}
                  onChange={(e) => setQUsers(e.target.value)}
                  placeholder="Buscar por username o fullName…"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                />
                <div className="text-xs text-fg-muted whitespace-nowrap">
                  {filteredUsers.length} / {users.length}
                </div>
              </div>

              <TableShell>
                <thead>
                  <tr>
                    <Th>Username</Th>
                    <Th>Full name</Th>
                    <Th>Roles</Th>
                    <Th>Active</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/60">
                      <Td>{u.username}</Td>
                      <Td>{u.fullName}</Td>
                      <Td>{(u.roles ?? []).join(', ')}</Td>
                      <Td>{String(u.isActive)}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openEditUser(u)} disabled={busy} className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                            Editar
                          </button>
                          <button type="button" onClick={() => openPwd(u)} disabled={busy} className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                            Password
                          </button>
                          <button type="button" onClick={() => openRoles(u)} disabled={busy} className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                            Roles
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-sm text-fg-muted">
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </TableShell>
            </>
          ) : view === 'products' ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={qProducts}
                  onChange={(e) => setQProducts(e.target.value)}
                  placeholder="Buscar por barcode / descripción / marca / brandCode / talla / color / contenedor / facturación / status…"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                />
                <div className="text-xs text-fg-muted whitespace-nowrap">
                  {filteredProducts.length} / {products.length}
                </div>
              </div>

              <TableShell minWidth={1200}>
                <thead>
                  <tr>
                    <Th>Barcode</Th>
                    <Th>Descripción</Th>
                    <Th>Marca</Th>
                    <Th>BrandCode</Th>
                    <Th>Talla</Th>
                    <Th>Color</Th>
                    <Th>Contenedor</Th>
                    <Th>Facturación</Th>
                    <Th>Categoría</Th>
                    <Th align="right">Costo</Th>
                    <Th align="right">Detal</Th>
                    <Th align="right">Mayor</Th>
                    <Th>Status</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/60">
                      <Td>{p.barcode}</Td>
                      <Td>{p.description ?? p.reference ?? '-'}</Td>
                      <Td>{p.brand ?? '-'}</Td>
                      <Td>{p.brandCode ?? '-'}</Td>
                      <Td>{p.size ?? '-'}</Td>
                      <Td>{p.color ?? '-'}</Td>
                      <Td>{p.containerNumber ?? '-'}</Td>
                      <Td>{p.billingNumber ?? '-'}</Td>
                      <Td>{p.category ?? '-'}</Td>
                      <Td align="right">{String(p.cost ?? '')}</Td>
                      <Td align="right">{String(p.priceRetail ?? '')}</Td>
                      <Td align="right">{String(p.priceWholesale ?? '')}</Td>
                      <Td>{p.status}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openEditProduct(p)} disabled={busy} className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                            Editar
                          </button>
                          <button type="button" onClick={() => openAudit(p)} disabled={busy} className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                            Audit
                          </button>
                          <button type="button" onClick={() => onDeactivateProduct(p)} disabled={busy || String(p.status).toUpperCase() === 'INACTIVE'} className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                            Desactivar
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-3 py-6 text-sm text-fg-muted">
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </TableShell>
            </>
          ) : view === 'branches' ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={qBranches}
                  onChange={(e) => setQBranches(e.target.value)}
                  placeholder="Buscar sucursal por code o name…"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                />
                <button
                  type="button"
                  onClick={reloadBranches}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
                >
                  Buscar
                </button>
                <div className="text-xs text-fg-muted whitespace-nowrap">
                  {filteredBranches.length} / {branches.length}
                </div>
              </div>

              <TableShell minWidth={900}>
                <thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Nombre</Th>
                    <Th>Tipo</Th>
                    <Th>Activo</Th>
                    <Th>Creada</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
<tbody>
  {filteredBranches.map((b) => (
    <tr key={b.id} className="hover:bg-muted/60">
      <Td>{b.code}</Td>
      <Td>{b.name}</Td>
      <Td>{branchTypeLabel(b.type)}</Td>
      <Td>{String(b.isActive)}</Td>
      <Td>{b.createdAt ? new Date(b.createdAt).toLocaleString() : '-'}</Td>
      <Td>
        <button
          type="button"
          onClick={() => openEditBranch(b)}
          disabled={busy}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          Editar
        </button>
      </Td>
    </tr>
  ))}
  {filteredBranches.length === 0 && (
    <tr>
      <td colSpan={6} className="px-3 py-6 text-sm text-fg-muted">
        Sin resultados
      </td>
    </tr>
  )}
</tbody>
              </TableShell>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_auto] gap-2 items-center">
                <select
                  value={warehousesBranchFilter}
                  onChange={(e) => setWarehousesBranchFilter(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="">(todas las sucursales y sin sucursal)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {branchLabel(b)}
                    </option>
                  ))}
                </select>

                <input
                  value={qWarehouses}
                  onChange={(e) => setQWarehouses(e.target.value)}
                  placeholder="Buscar bodega por code o name…"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                />

                <button
                  type="button"
                  onClick={reloadWarehouses}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
                >
                  Buscar
                </button>
              </div>

              <TableShell minWidth={900}>
                <thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Nombre</Th>
                    <Th>Sucursal</Th>
                    <Th>Activo</Th>
                    <Th>Creada</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWarehouses.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/60">
                      <Td>{w.code}</Td>
                      <Td>{w.name}</Td>
                      <Td>{w.branch ? `${w.branch.code} — ${w.branch.name}` : 'Sin sucursal'}</Td>
                      <Td>{String(w.isActive)}</Td>
                      <Td>{w.createdAt ? new Date(w.createdAt).toLocaleString() : '-'}</Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => openEditWarehouse(w)}
                          disabled={busy}
                          className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                        >
                          Editar
                        </button>
                      </Td>
                    </tr>
                  ))}
                  {filteredWarehouses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-sm text-fg-muted">
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </TableShell>

              <div className="mt-2 text-xs text-fg-muted">
                Nota: para crear bodega sin sucursal, elige <b>(sin sucursal)</b> en el modal.
              </div>
            </>
          )}
        </div>
      </main>

      {/* ================== MODALES USUARIOS ================== */}
      {showUserModal && (
        <UserModal
          roles={roles}
          editing={editingUser}
          busy={busy}
          onClose={() => {
            setShowUserModal(false)
            setEditingUser(null)
          }}
          onSave={async (payload) => {
            setBusy(true)
            setErr(null)
            try {
              if (!editingUser) {
                const created = await createUser(payload)
                setUsers((prev) => [created, ...prev])
              } else {
                const updated = await updateUser(editingUser.id, payload)
                setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
              }
              setShowUserModal(false)
              setEditingUser(null)
            } catch (e: any) {
              setErr(formatNestError(e))
            } finally {
              setBusy(false)
            }
          }}
        />
      )}

      {showPwdModal && pwdUser && (
        <PasswordModal
          user={pwdUser}
          busy={busy}
          onClose={() => {
            setShowPwdModal(false)
            setPwdUser(null)
          }}
          onSave={async (newPassword, mustChangePassword) => {
            setBusy(true)
            setErr(null)
            try {
              const updated = await changeUserPassword(pwdUser.id, newPassword, mustChangePassword)
              setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
              setShowPwdModal(false)
              setPwdUser(null)
            } catch (e: any) {
              setErr(formatNestError(e))
            } finally {
              setBusy(false)
            }
          }}
        />
      )}

      {showRolesModal && rolesUser && (
        <ModalShell
          title={`Roles de ${rolesUser.username}`}
          busy={busy}
          onClose={() => {
            setShowRolesModal(false)
            setRolesUser(null)
          }}
          maxWidth="max-w-2xl"
        >
          <RolesChecklist roles={roles} selected={rolesSelected} onChange={setRolesSelected} />

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setShowRolesModal(false)
                setRolesUser(null)
              }}
              disabled={busy}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSaveRoles}
              disabled={busy}
              className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </ModalShell>
      )}

      {/* ================== MODALES PRODUCTOS ================== */}
      {showProductModal && (
        <ProductModal
          busy={busy}
          editing={editingProduct}
          onClose={() => {
            setShowProductModal(false)
            setEditingProduct(null)
          }}
          onSave={async (payload) => {
            setBusy(true)
            setErr(null)
            try {
              if (!editingProduct) {
                const created = await createProduct(payload)
                setProducts((prev) => [created, ...prev])
              } else {
                const updated = await updateProduct(editingProduct.id, payload)
                setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
              }
              setShowProductModal(false)
              setEditingProduct(null)
            } catch (e: any) {
              setErr(formatNestError(e))
            } finally {
              setBusy(false)
            }
          }}
        />
      )}

      {showAuditModal && auditProduct && (
        <ModalShell
          title={`Audit: ${auditProduct.barcode}`}
          busy={auditLoading}
          onClose={() => {
            setShowAuditModal(false)
            setAuditProduct(null)
            setAuditRows([])
          }}
          maxWidth="max-w-6xl"
        >
          {auditLoading ? (
            <div className="rounded-md border border-border bg-surface p-3 text-sm text-fg-muted">Cargando audit…</div>
          ) : (
            <div>
              <div className="text-xs text-fg-muted mb-2">Registros: {auditRows.length}</div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="max-h-105 overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <Th>Fecha</Th>
                        <Th>Usuario</Th>
                        <Th>Before</Th>
                        <Th>After</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/60">
                          <Td>{r.changedAt ? new Date(r.changedAt).toLocaleString() : '-'}</Td>
                          <Td>{r.changedBy ?? '-'}</Td>
                          <Td><pre className="m-0 text-xs whitespace-pre-wrap">{JSON.stringify(r.before, null, 2)}</pre></Td>
                          <Td><pre className="m-0 text-xs whitespace-pre-wrap">{JSON.stringify(r.after, null, 2)}</pre></Td>
                        </tr>
                      ))}
                      {auditRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-sm text-fg-muted">Sin audit</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button type="button" onClick={() => setShowAuditModal(false)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted">
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </ModalShell>
      )}

      {/* ================== MODALES SUCURSALES ================== */}
      {showBranchModal && (
        <BranchModal
          busy={busy}
          editing={editingBranch}
          onClose={() => {
            setShowBranchModal(false)
            setEditingBranch(null)
          }}
          onSave={async (payload) => {
            setBusy(true)
            setErr(null)
            try {
              if (!editingBranch) {
                const created = await createBranch(payload)
                setBranches((prev) => [created, ...prev])
              } else {
                const updated = await updateBranch(editingBranch.id, payload)
                setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
              }
              setShowBranchModal(false)
              setEditingBranch(null)
            } catch (e: any) {
              setErr(formatNestError(e))
            } finally {
              setBusy(false)
            }
          }}
        />
      )}

      {/* ================== MODALES BODEGAS ================== */}
      {showWarehouseModal && (
        <WarehouseModal
          busy={busy}
          editing={editingWarehouse}
          branches={branches}
          onClose={() => {
            setShowWarehouseModal(false)
            setEditingWarehouse(null)
          }}
          onSave={async (payload) => {
            setBusy(true)
            setErr(null)
            try {
              if (!editingWarehouse) {
                const created = await createWarehouse(payload)
                setWarehouses((prev) => [created, ...prev])
              } else {
                const updated = await updateWarehouse(editingWarehouse.id, payload)
                setWarehouses((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
              }
              setShowWarehouseModal(false)
              setEditingWarehouse(null)
            } catch (e: any) {
              setErr(formatNestError(e))
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
    </div>
  )
}

/** =========================
 * MODALES USERS
 * (Incluye búsqueda branch/warehouse para defaults; ahora permite warehouse sin branch)
 * ========================= */

function UserModal({
  editing,
  roles,
  busy,
  onClose,
  onSave
}: {
  editing: SafeUser | null
  roles: Role[]
  busy: boolean
  onClose: () => void
  onSave: (payload: any) => void
}) {
  const isEdit = !!editing

  const [username, setUsername] = useState(editing?.username ?? '')
  const [fullName, setFullName] = useState(editing?.fullName ?? '')
  const [email, setEmail] = useState(editing?.email ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)
  const [mustChangePassword, setMustChangePassword] = useState(editing?.mustChangePassword ?? false)

  const [password, setPassword] = useState('')
  const [roleCodes, setRoleCodes] = useState<string[]>(editing?.roles ?? [])

  // defaults
  const [defaultBranchId, setDefaultBranchId] = useState<string>(editing?.defaultBranchId ?? '')
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>(editing?.defaultWarehouseId ?? '')

  // search/data
  const [branchQ, setBranchQ] = useState('')
  const [warehouseQ, setWarehouseQ] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [warehousesLoading, setWarehousesLoading] = useState(false)

  const [localErr, setLocalErr] = useState<string | null>(null)
  const usernameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  async function loadBranches(q?: string) {
    setBranchesLoading(true)
    try {
      const data = await listBranches(q)
      setBranches(data ?? [])
    } catch (e: any) {
      setLocalErr(formatNestError(e))
    } finally {
      setBranchesLoading(false)
    }
  }

  async function loadWarehouses(branchId?: string | null, q?: string) {
    setWarehousesLoading(true)
    try {
      const data = await listWarehouses(branchId ?? null, q)
      setWarehouses(data ?? [])
    } catch (e: any) {
      setLocalErr(formatNestError(e))
    } finally {
      setWarehousesLoading(false)
    }
  }

  useEffect(() => {
    loadBranches('')
    loadWarehouses(null, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(() => loadBranches(branchQ), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchQ])

  // cuando cambia sucursal por defecto, recargar bodegas filtradas por esa sucursal
  useEffect(() => {
    setDefaultWarehouseId('')
    setWarehouseQ('')
    const bid = defaultBranchId ? defaultBranchId : null
    loadWarehouses(bid, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBranchId])

  useEffect(() => {
    const t = setTimeout(() => {
      const bid = defaultBranchId ? defaultBranchId : null
      loadWarehouses(bid, warehouseQ)
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseQ])

  function submit() {
    setLocalErr(null)

    if (!username.trim() || !fullName.trim()) {
      setLocalErr('Username y Full name son obligatorios.')
      return
    }
    if (!isEdit && !password) {
      setLocalErr('Password es obligatorio al crear.')
      return
    }

    const payloadBase = {
      username: username.trim(),
      fullName: fullName.trim(),
      email: email ? email : null,
      phone: phone ? phone : null,
      isActive,
      mustChangePassword,
      defaultBranchId: defaultBranchId ? defaultBranchId : null,
      defaultWarehouseId: defaultWarehouseId ? defaultWarehouseId : null
    }

    if (isEdit) onSave(payloadBase)
    else onSave({ ...payloadBase, password, roleCodes })
  }

  return (
    <ModalShell title={isEdit ? `Editar usuario: ${editing?.username}` : 'Crear usuario'} onClose={onClose} busy={busy} maxWidth="max-w-5xl">
      {localErr ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm mb-3">
          {localErr}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            ref={usernameRef}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            value={email ?? ''}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            value={phone ?? ''}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"
            disabled={busy}
          />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={busy} />
          <span className="text-sm">Activo</span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <input type="checkbox" className="h-4 w-4" checked={mustChangePassword} onChange={(e) => setMustChangePassword(e.target.checked)} disabled={busy} />
          <span className="text-sm">Debe cambiar contraseña</span>
        </div>

        <div className="md:col-span-2 rounded-md border border-border bg-muted p-3">
          <div className="text-sm font-semibold">Contexto por defecto del usuario</div>
          <div className="text-xs text-fg-muted mt-1">
            Puedes asignar sucursal y/o bodega. La bodega puede existir <b>sin sucursal</b>.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium mb-1">Buscar sucursal (code o name)</label>
              <input
                value={branchQ}
                onChange={(e) => setBranchQ(e.target.value)}
                placeholder="Ej: BR- o Central"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                disabled={busy}
              />
              <div className="text-xs text-fg-muted mt-1">{branchesLoading ? 'Buscando…' : `${branches.length} resultados`}</div>

              <label className="block text-sm font-medium mt-3 mb-1">Sucursal por defecto</label>
              <select
                value={defaultBranchId}
                onChange={(e) => setDefaultBranchId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                disabled={busy}
              >
                <option value="">(sin sucursal)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {branchLabel(b)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Buscar bodega (code o name)</label>
              <input
                value={warehouseQ}
                onChange={(e) => setWarehouseQ(e.target.value)}
                placeholder={defaultBranchId ? 'Filtra por sucursal seleccionada' : 'Busca en todas (incluye sin sucursal)'}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                disabled={busy}
              />
              <div className="text-xs text-fg-muted mt-1">{warehousesLoading ? 'Buscando…' : `${warehouses.length} resultados`}</div>

              <label className="block text-sm font-medium mt-3 mb-1">Bodega por defecto</label>
              <select
                value={defaultWarehouseId}
                onChange={(e) => setDefaultWarehouseId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                disabled={busy}
              >
                <option value="">(sin bodega)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {warehouseLabel(w)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!isEdit && (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Password (solo crear)</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"
                disabled={busy}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Roles iniciales (roleCodes)</label>
              <RolesChecklist roles={roles} selected={roleCodes} onChange={setRoleCodes} />
            </div>
          </>
        )}

        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function PasswordModal({
  user,
  busy,
  onClose,
  onSave
}: {
  user: SafeUser
  busy: boolean
  onClose: () => void
  onSave: (newPassword: string, mustChangePassword: boolean) => void
}) {
  const [newPassword, setNewPassword] = useState('')
  const [mustChangePassword, setMustChangePassword] = useState(true)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const pwdRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    pwdRef.current?.focus()
  }, [])

  function submit() {
    setLocalErr(null)
    if (!newPassword) {
      setLocalErr('Nueva contraseña es obligatoria.')
      return
    }
    onSave(newPassword, mustChangePassword)
  }

  return (
    <ModalShell title={`Cambiar password: ${user.username}`} onClose={onClose} busy={busy} maxWidth="max-w-xl">
      {localErr ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm mb-3">
          {localErr}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
          <input
            ref={pwdRef}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"
            disabled={busy}
          />
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={mustChangePassword} onChange={(e) => setMustChangePassword(e.target.checked)} disabled={busy} />
          <span className="text-sm">Forzar cambio en próximo login</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/** =========================
 * MODAL PRODUCT (tu código actual)
 * ========================= */
function ProductModal({
  editing,
  busy,
  onClose,
  onSave
}: {
  editing: Product | null
  busy: boolean
  onClose: () => void
  onSave: (payload: any) => void
}) {
  const isEdit = !!editing

  const [barcode, setBarcode] = useState(editing?.barcode ?? '')
  const [reference, setReference] = useState(editing?.reference ?? '')
  const [brand, setBrand] = useState(editing?.brand ?? '')

  const [brandCode, setBrandCode] = useState(editing?.brandCode ?? '')
  const [size, setSize] = useState(editing?.size ?? '')
  const [color, setColor] = useState(editing?.color ?? '')
  const [containerNumber, setContainerNumber] = useState(editing?.containerNumber ?? '')
  const [billingNumber, setBillingNumber] = useState(editing?.billingNumber ?? '')

  const [description, setDescription] = useState(editing?.description ?? '')
  const [category, setCategory] = useState(editing?.category ?? '')

  const [cost, setCost] = useState(editing?.cost ? String(editing.cost) : '')
  const [priceRetail, setPriceRetail] = useState(editing?.priceRetail ? String(editing.priceRetail) : '')
  const [priceWholesale, setPriceWholesale] = useState(editing?.priceWholesale ? String(editing.priceWholesale) : '')

  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(editing?.status ?? 'ACTIVE')

  const [localErr, setLocalErr] = useState<string | null>(null)
  const barcodeRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  function submit() {
    setLocalErr(null)

    if (!barcode.trim()) {
      setLocalErr('Barcode es obligatorio.')
      return
    }
    if (!cost.trim() || !priceRetail.trim() || !priceWholesale.trim()) {
      setLocalErr('Costo, Detal y Mayor son obligatorios.')
      return
    }

    onSave({
      barcode: barcode.trim(),
      reference: reference.trim() || null,
      brand: brand.trim() || null,
      brandCode: brandCode.trim() || null,
      size: size.trim() || null,
      color: color.trim() || null,
      containerNumber: containerNumber.trim() || null,
      billingNumber: billingNumber.trim() || null,
      description: description.trim() || null,
      category: category.trim() || null,
      cost: cost.trim(),
      priceRetail: priceRetail.trim(),
      priceWholesale: priceWholesale.trim(),
      status
    })
  }

  return (
    <ModalShell title={isEdit ? `Editar producto: ${editing?.barcode}` : 'Crear producto'} onClose={onClose} busy={busy} maxWidth="max-w-5xl">
      {localErr ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm mb-3">
          {localErr}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Barcode (único)</label>
          <input ref={barcodeRef} value={barcode} onChange={(e) => setBarcode(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Referencia</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Marca</label>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Código de marca (brandCode)</label>
          <input value={brandCode} onChange={(e) => setBrandCode(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Talla (size)</label>
          <input value={size} onChange={(e) => setSize(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Color</label>
          <input value={color} onChange={(e) => setColor(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Número de contenedor</label>
          <input value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Número de facturación</label>
          <input value={billingNumber} onChange={(e) => setBillingNumber(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Categoría</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" disabled={busy}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Costo</label>
          <input value={cost} onChange={(e) => setCost(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" placeholder="ej: 1.25" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Precio detal</label>
          <input value={priceRetail} onChange={(e) => setPriceRetail(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" placeholder="ej: 2.00" disabled={busy} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Precio mayor</label>
          <input value={priceWholesale} onChange={(e) => setPriceWholesale(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" placeholder="ej: 1.70" disabled={busy} />
        </div>

        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/** =========================
 * MODAL BRANCH
 * ========================= */
function BranchModal({
  editing,
  busy,
  onClose,
  onSave
}: {
  editing: Branch | null
  busy: boolean
  onClose: () => void
  onSave: (payload: any) => void
}) {
  const isEdit = !!editing

  const [code, setCode] = useState(editing?.code ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<'CENTRAL' | 'BRANCH'>(editing?.type ?? 'BRANCH')
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const codeRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    codeRef.current?.focus()
  }, [])

  function submit() {
    setLocalErr(null)
    if (!code.trim() || !name.trim()) {
      setLocalErr('Código y nombre son obligatorios.')
      return
    }
    onSave({
      code: code.trim(),
      name: name.trim(),
      type,
      isActive
    })
  }

  return (
    <ModalShell title={isEdit ? `Editar sucursal: ${editing?.code}` : 'Crear sucursal'} onClose={onClose} busy={busy} maxWidth="max-w-3xl">
      {localErr ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm mb-3">
          {localErr}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Código</label>
          <input
            ref={codeRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            disabled={busy}
          >
            <option value="CENTRAL">Sede central</option>
<option value="BRANCH">Sucursal</option>
          </select>
        </div>

        <label className="flex items-center gap-2 mt-6">
          <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={busy} />
          <span className="text-sm">Activa</span>
        </label>

        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/** =========================
 * MODAL WAREHOUSE
 * ✅ branchId opcional -> "(sin sucursal)" => branchId: null
 * ========================= */
function WarehouseModal({
  editing,
  busy,
  branches,
  onClose,
  onSave
}: {
  editing: Warehouse | null
  busy: boolean
  branches: Branch[]
  onClose: () => void
  onSave: (payload: any) => void
}) {
  const isEdit = !!editing

  const [code, setCode] = useState(editing?.code ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)

  // ✅ la clave: branchId puede ser '' (sin sucursal)
  const [branchId, setBranchId] = useState<string>(editing?.branchId ?? '')

  const [localErr, setLocalErr] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    codeRef.current?.focus()
  }, [])

  function submit() {
    setLocalErr(null)
    if (!code.trim() || !name.trim()) {
      setLocalErr('Código y nombre son obligatorios.')
      return
    }

    onSave({
      code: code.trim(),
      name: name.trim(),
      isActive,
      branchId: branchId ? branchId : null // ✅ aquí se envía null si no hay sucursal
    })
  }

  return (
    <ModalShell title={isEdit ? `Editar bodega: ${editing?.code}` : 'Crear bodega'} onClose={onClose} busy={busy} maxWidth="max-w-3xl">
      {localErr ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm mb-3">
          {localErr}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Código</label>
          <input
            ref={codeRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            disabled={busy}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Sucursal (opcional)</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            disabled={busy}
          >
            <option value="">(sin sucursal)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {branchLabel(b)}
              </option>
            ))}
          </select>

          <div className="mt-1 text-xs text-fg-muted">
            Si eliges <b>(sin sucursal)</b>, la bodega se guarda sin tienda asociada.
          </div>
        </div>

        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={busy} />
          <span className="text-sm">Activa</span>
        </label>

        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}