import { useEffect, useMemo, useRef, useState } from 'react'
import { formatNestError } from '../../api/errors'
import { getStock, type StockRow } from './inventoryApi'

function isEditableTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = (t.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (t as any).isContentEditable
}

function Th({ children, align = 'left' }: { children: any; align?: 'left' | 'right' }) {
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

function Td({ children, align = 'left' }: { children: any; align?: 'left' | 'right' }) {
  return (
    <td
      className={[
        'border-b border-border/60 px-3 py-2 align-top',
        align === 'right' ? 'text-right' : 'text-left'
      ].join(' ')}
    >
      {children}
    </td>
  )
}

export function StockPanel({ warehouseId }: { warehouseId: string }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [items, setItems] = useState<StockRow[]>([])
  const [q, setQ] = useState('')

  const searchRef = useRef<HTMLInputElement | null>(null)

  async function load() {
    setErr(null)
    setLoading(true)
    try {
      const data = await getStock(warehouseId)
      setItems(data)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId])

  // Focus inicial para escáner / teclado (al abrir el tab)
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  // Hotkeys dentro del panel:
  // Ctrl+F -> focus búsqueda
  // Esc -> limpiar búsqueda (si no estás escribiendo en otro input)
  // Ctrl+Enter -> recargar stock
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+F (focus)
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }

      // Ctrl+Enter (reload)
      if (e.ctrlKey && e.key === 'Enter') {
        if (isEditableTarget(e.target) && e.target !== searchRef.current) return
        e.preventDefault()
        load()
        return
      }

      // Esc (clear search) - solo si el foco está en el input de búsqueda o no está en un editable
      if (e.key === 'Escape') {
        const targetIsEditable = isEditableTarget(e.target)
        const targetIsSearch = e.target === searchRef.current
        if (!targetIsEditable || targetIsSearch) {
          if (q) {
            e.preventDefault()
            setQ('')
            searchRef.current?.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, warehouseId])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items
    return items.filter((r) => {
      const p = r.product ?? ({} as any)
      const hay = [p.barcode, p.reference, p.brand, p.description, p.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(s)
    })
  }, [items, q])

  const total = items.length
  const shown = filtered.length

  return (
    <div className="mt-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por barcode / descripción / marca / categoría… (Ctrl+F)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
          />

          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ('')
                searchRef.current?.focus()
              }}
              className="shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
              title="Limpiar (Esc)"
            >
              Limpiar
            </button>
          ) : null}

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            title="Recargar (Ctrl+Enter)"
          >
            Recargar
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-fg-muted">
            Mostrando <b className="text-fg">{shown}</b> de <b className="text-fg">{total}</b>
          </div>
          <div className="text-[11px] text-fg-muted">
            Atajos: <b>Ctrl+F</b> buscar · <b>Esc</b> limpiar · <b>Ctrl+Enter</b> recargar
          </div>
        </div>
      </div>

      {/* Error */}
      {err ? (
        <div role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm">
          {err}
        </div>
      ) : null}

      {/* Loading */}
      {loading ? (
        <div className="mt-3 rounded-lg border border-border bg-surface p-4 animate-pulse">
          <div className="h-4 w-44 bg-muted rounded" />
          <div className="mt-3 h-9 bg-muted rounded" />
          <div className="mt-3 h-40 bg-muted rounded" />
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-border bg-surface overflow-hidden">
          <div className="max-h-[calc(100vh-260px)] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <Th>Barcode</Th>
                  <Th>Descripción</Th>
                  <Th>Marca</Th>
                  <Th>Categoría</Th>
                  <Th align="right">Cantidad</Th>
                  <Th>Actualizado</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const p = r.product ?? ({} as any)
                  return (
                    <tr key={`${r.warehouseId}-${r.productId}`} className="hover:bg-muted/60">
                      <Td>{p.barcode ?? '-'}</Td>
                      <Td>{p.description ?? p.reference ?? r.productId}</Td>
                      <Td>{p.brand ?? '-'}</Td>
                      <Td>{p.category ?? '-'}</Td>
                      <Td align="right">{String(r.qtyOnHand ?? '0')}</Td>
                      <Td>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}</Td>
                    </tr>
                  )
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-sm text-fg-muted">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-fg">Sin resultados</div>
                          <div className="mt-1 text-xs text-fg-muted">
                            Prueba con barcode exacto (scanner) o una palabra de la descripción.
                          </div>
                        </div>
                        {q ? (
                          <button
                            type="button"
                            onClick={() => {
                              setQ('')
                              searchRef.current?.focus()
                            }}
                            className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
                          >
                            Limpiar búsqueda
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}