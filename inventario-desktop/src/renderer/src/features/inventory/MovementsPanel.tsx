import { useEffect, useMemo, useRef, useState } from 'react'
import { formatNestError } from '../../api/errors'
import { http } from '../../api/http'
import { getMovements, type InventoryDoc } from './inventoryApi'

type Product = {
  id: string
  barcode: string
  reference?: string | null
  brand?: string | null
  description?: string | null
  category?: string | null
  status?: any
}

async function listProducts(): Promise<Product[]> {
  const { data } = await http.get<Product[]>('/products')
  return data ?? []
}

function docTypeLabel(t?: string | null) {
  const v = String(t ?? '').toUpperCase()
  if (v === 'INITIAL_LOAD') return 'Carga inicial'
  if (v === 'RECEIVE') return 'Recepción'
  if (v === 'DISPATCH') return 'Despacho'
  if (v === 'ADJUSTMENT') return 'Ajuste'
  if (v === 'RETURN') return 'Devolución'
  return t ?? '-'
}

function isEditableTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = (t.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (t as any).isContentEditable
}

function Th({ children, align = 'left' }: { children?: any; align?: 'left' | 'right' }) {
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

function TableShell({ children, minWidth }: { children: any; minWidth?: number }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-surface overflow-hidden">
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <table className="w-full border-collapse text-sm" style={minWidth ? { minWidth } : undefined}>
          {children}
        </table>
      </div>
    </div>
  )
}

function fmtDateTime(v?: string | null) {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString()
}

export function MovementsPanel({ warehouseId }: { warehouseId: string }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [items, setItems] = useState<InventoryDoc[]>([])

  // filtros
  const [barcode, setBarcode] = useState('')
  const [from, setFrom] = useState('') // YYYY-MM-DD
  const [to, setTo] = useState('') // YYYY-MM-DD
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // catálogo para resolver barcode -> productId
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])

  const barcodeRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setCatalogLoading(true)
      try {
        const p = await listProducts()
        if (mounted) setProducts(p ?? [])
      } catch (e: any) {
        if (mounted) setErr((prev) => prev ?? `No se pudo cargar catálogo de productos: ${formatNestError(e)}`)
      } finally {
        if (mounted) setCatalogLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Focus inicial para scanner
  useEffect(() => {
    const t = setTimeout(() => barcodeRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  const productIdByBarcode = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products) {
      if (p?.barcode && p?.id) map.set(String(p.barcode).trim(), String(p.id))
    }
    return map
  }, [products])

  const selectedProduct = useMemo(() => {
    const b = barcode.trim()
    if (!b) return null
    return products.find((p) => String(p.barcode).trim() === b) ?? null
  }, [barcode, products])

  async function load() {
    setErr(null)
    setLoading(true)
    try {
      let productId: string | undefined = undefined

      const b = barcode.trim()
      if (b) {
        const id = productIdByBarcode.get(b)
        if (!id) {
          setItems([])
          setErr(`No existe producto con barcode=${b}. (Crea el producto o verifica el código)`)
          return
        }
        productId = id
      }

      const data = await getMovements({
        warehouseId,
        productId,
        from: from || undefined,
        to: to || undefined
      })

      setItems(data)
      // UX: si cambian filtros, colapsar todo
      setExpanded({})
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

  // Hotkeys desktop:
  // Ctrl+F -> focus barcode
  // Enter en barcode -> Buscar
  // Ctrl+Enter -> Buscar
  // Esc -> limpiar barcode (si no estás escribiendo en otro input)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        barcodeRef.current?.focus()
        barcodeRef.current?.select()
        return
      }

      if (e.ctrlKey && e.key === 'Enter') {
        if (isEditableTarget(e.target) && e.target !== barcodeRef.current) return
        e.preventDefault()
        load()
        return
      }

      if (e.key === 'Escape') {
        const targetIsEditable = isEditableTarget(e.target)
        const targetIsBarcode = e.target === barcodeRef.current
        if (!targetIsEditable || targetIsBarcode) {
          if (barcode) {
            e.preventDefault()
            setBarcode('')
            barcodeRef.current?.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcode, from, to, warehouseId])

  function toggle(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }))
  }

  function lineDelta(doc: InventoryDoc, qty: number) {
    if (doc.toWarehouseId === warehouseId) return +qty
    if (doc.fromWarehouseId === warehouseId) return -qty
    return 0
  }

  const shown = items.length

  return (
    <div className="mt-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[260px] flex-1">
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  load()
                }
              }}
              placeholder={catalogLoading ? 'Cargando productos…' : 'Filtrar por barcode (opcional) — Enter para buscar'}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
              list="barcode-list-movements"
              inputMode="numeric"
            />
            <datalist id="barcode-list-movements">
              {products.slice(0, 200).map((p) => (
                <option key={p.id} value={p.barcode}>
                  {p.description ?? p.reference ?? ''}
                </option>
              ))}
            </datalist>
          </div>

          <div className="w-[180px]">
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
              aria-label="Desde"
              title="Desde (YYYY-MM-DD)"
            />
          </div>

          <div className="w-[180px]">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              type="date"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
              aria-label="Hasta"
              title="Hasta (YYYY-MM-DD)"
            />
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50"
            title="Buscar (Ctrl+Enter)"
          >
            Buscar
          </button>

          {(barcode || from || to) && (
            <button
              type="button"
              onClick={() => {
                setBarcode('')
                setFrom('')
                setTo('')
                barcodeRef.current?.focus()
              }}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
              title="Limpiar filtros (Esc limpia barcode)"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-fg-muted">
            Movimientos: <b className="text-fg">{shown}</b>
            {barcode.trim() ? (
              <span className="ml-2">
                · Barcode: <b className="text-fg">{barcode.trim()}</b>
              </span>
            ) : null}
          </div>

          <div className="text-[11px] text-fg-muted">
            Atajos: <b>Ctrl+F</b> barcode · <b>Enter</b> buscar · <b>Ctrl+Enter</b> buscar · <b>Esc</b> limpiar barcode
          </div>
        </div>
      </div>

      {/* Product preview */}
      {barcode.trim() && (
        <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2">
          {selectedProduct ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-fg-muted">Barcode:</span> <b className="text-fg">{selectedProduct.barcode}</b>
              </div>
              <div>
                <span className="text-fg-muted">Status:</span> <b className="text-fg">{String(selectedProduct.status)}</b>
              </div>
              <div className="md:col-span-2">
                <span className="text-fg-muted">Descripción:</span> <b className="text-fg">{selectedProduct.description ?? '-'}</b>
              </div>
              <div>
                <span className="text-fg-muted">Marca:</span> <b className="text-fg">{selectedProduct.brand ?? '-'}</b>
              </div>
              <div>
                <span className="text-fg-muted">Categoría:</span> <b className="text-fg">{selectedProduct.category ?? '-'}</b>
              </div>
              <div className="md:col-span-2">
                <span className="text-fg-muted">Referencia:</span> <b className="text-fg">{selectedProduct.reference ?? '-'}</b>
              </div>
            </div>
          ) : (
            <div className="text-sm text-danger">No se encontró producto con ese barcode en el catálogo.</div>
          )}
        </div>
      )}

      {/* Error */}
      {err ? (
        <div role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm">
          {err}
        </div>
      ) : null}

      {/* Loading */}
      {loading ? (
        <div className="mt-3 rounded-lg border border-border bg-surface p-4 animate-pulse">
          <div className="h-4 w-52 bg-muted rounded" />
          <div className="mt-3 h-9 bg-muted rounded" />
          <div className="mt-3 h-44 bg-muted rounded" />
        </div>
      ) : (
        <TableShell minWidth={980}>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Doc#</Th>
              <Th>Desde</Th>
              <Th>Hacia</Th>
              <Th align="right">Líneas</Th>
              <Th />
            </tr>
          </thead>

          <tbody>
            {items.map((d) => {
              const isOpen = !!expanded[d.id]
              const linesCount = d.lines?.length ?? 0

              return (
                <FragmentRow
                  key={d.id}
                  doc={d}
                  isOpen={isOpen}
                  linesCount={linesCount}
                  warehouseId={warehouseId}
                  onToggle={() => toggle(d.id)}
                  lineDelta={lineDelta}
                />
              )
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-sm text-fg-muted">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-fg">Sin movimientos</div>
                      <div className="mt-1 text-xs text-fg-muted">Ajusta rango de fechas o filtra por barcode.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBarcode('')
                        setFrom('')
                        setTo('')
                        barcodeRef.current?.focus()
                      }}
                      className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}

function FragmentRow({
  doc,
  isOpen,
  linesCount,
  warehouseId,
  onToggle,
  lineDelta
}: {
  doc: InventoryDoc
  isOpen: boolean
  linesCount: number
  warehouseId: string
  onToggle: () => void
  lineDelta: (doc: InventoryDoc, qty: number) => number
}) {
  return (
    <>
      <tr className="hover:bg-muted/60">
        <Td>{fmtDateTime(doc.postedAt)}</Td>

        {/* ✅ AQUÍ ESTÁ EL CAMBIO: traducimos el tipo */}
        <Td>{docTypeLabel(doc.docType)}</Td>

        <Td>{doc.docNumber ?? '-'}</Td>
        <Td>{(doc as any).fromWarehouse?.name ?? doc.fromWarehouseId ?? '-'}</Td>
        <Td>{(doc as any).toWarehouse?.name ?? doc.toWarehouseId ?? '-'}</Td>
        <Td align="right">{linesCount}</Td>
        <Td>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted"
          >
            {isOpen ? 'Ocultar' : 'Ver'}
          </button>
        </Td>
      </tr>

      {isOpen && (
        <tr>
          <td colSpan={7} className="border-b border-border/60 px-3 py-3 bg-muted/60">
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-xs font-semibold text-fg-muted text-left">
                        Producto
                      </th>
                      <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-xs font-semibold text-fg-muted text-left">
                        Barcode
                      </th>
                      <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-xs font-semibold text-fg-muted text-right">
                        Cantidad
                      </th>
                      <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-xs font-semibold text-fg-muted text-right">
                        (esta bodega)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(doc.lines ?? []).map((l, idx) => {
                      const p = (l as any).product ?? {}
                      const qty = Number((l as any).qty ?? 0)
                      const delta = lineDelta(doc, qty)
                      const deltaClass = delta > 0 ? 'text-primary' : delta < 0 ? 'text-danger' : 'text-fg-muted'

                      return (
                        <tr key={`${doc.id}-${(l as any).productId}-${idx}`} className="hover:bg-muted/60">
                          <td className="border-b border-border/60 px-3 py-2">
                            {p.description ?? p.reference ?? (l as any).productId}
                          </td>
                          <td className="border-b border-border/60 px-3 py-2">{p.barcode ?? '-'}</td>
                          <td className="border-b border-border/60 px-3 py-2 text-right">{qty}</td>
                          <td className={['border-b border-border/60 px-3 py-2 text-right font-medium', deltaClass].join(' ')}>
                            {delta}
                          </td>
                        </tr>
                      )
                    })}

                    {(doc.lines ?? []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-sm text-fg-muted">
                          Sin líneas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-3 py-2 text-xs text-fg-muted border-t border-border">
                <div>
                  Desde: <b className="text-fg">{(doc as any).fromWarehouse?.name ?? doc.fromWarehouseId ?? '-'}</b> · Hacia:{' '}
                  <b className="text-fg">{(doc as any).toWarehouse?.name ?? doc.toWarehouseId ?? '-'}</b>
                </div>
                <div>
                  Contexto bodega: <b className="text-fg">{warehouseId}</b>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}