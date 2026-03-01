import React, { useEffect, useMemo, useRef, useState } from 'react'
import { formatNestError } from '../../api/errors'
import { listProducts, postDoc, replaceDocLines, type InventoryDoc, type Product } from './inventoryApi'

type LineInput = { productId: string; qty: number; unitCost?: number }

function etiquetaTipoDocumento(t: InventoryDoc['docType']) {
  switch (t) {
    case 'INITIAL_LOAD':
      return 'Carga inicial'
    case 'RECEIVE':
      return 'Recepción'
    case 'DISPATCH':
      return 'Despacho'
    case 'ADJUSTMENT':
      return 'Ajuste'
    case 'RETURN':
      return 'Devolución'
    default:
      return String(t)
  }
}

function etiquetaEstadoDocumento(s: any) {
  const v = String(s ?? '').toUpperCase()
  if (v === 'DRAFT') return 'Borrador'
  if (v === 'POSTED') return 'Confirmado'
  return v || '-'
}

function formatearFechaHora(v?: string | null) {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString()
}

function normalizeLines(doc: InventoryDoc): LineInput[] {
  return (doc.lines ?? [])
    .map((l) => {
      const qty = Number((l as any).qty ?? 0)
      const unitCostRaw = (l as any).unitCost
      const unitCost =
        unitCostRaw === undefined || unitCostRaw === null || unitCostRaw === ''
          ? undefined
          : Number(String(unitCostRaw).replace(',', '.'))

      return {
        productId: String((l as any).productId),
        qty: Number.isFinite(qty) ? qty : 0,
        unitCost: unitCost !== undefined && Number.isFinite(unitCost) ? unitCost : undefined
      }
    })
    .filter((l) => l.productId && l.qty > 0)
}

function parseNumeroPositivo(input: string): number | null {
  const s = input.trim().replace(',', '.')
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function parseNumeroNoNegativoOUndef(input: string): number | undefined | null {
  const s = input.trim()
  if (!s) return undefined
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function esCampoEditable(el: EventTarget | null) {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = (t.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (t as any).isContentEditable
}

function ModalShell(props: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
  busy: boolean
}): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !props.busy) props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.busy, props.onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onMouseDown={() => {
        if (!props.busy) props.onClose()
      }}
    >
      <div
        className="w-full max-w-6xl bg-surface border border-border rounded-lg shadow-elev-2 p-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">{props.title}</h3>
            {props.subtitle ? <div className="mt-0.5 text-xs text-fg-muted">{props.subtitle}</div> : null}
          </div>
          <button
            ref={closeRef}
            onClick={props.onClose}
            disabled={props.busy}
            type="button"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            title="Cerrar (Esc)"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4">{props.children}</div>
      </div>
    </div>
  )
}

export function DocEditorModal(props: {
  doc: InventoryDoc
  onClose: () => void
  onUpdated: (doc: InventoryDoc) => void
}): React.JSX.Element {
  const { doc, onClose, onUpdated } = props

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [lines, setLines] = useState<LineInput[]>([])

  // Catálogo (para resolver código de barras → producto)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])

  // Entrada rápida (escáner/teclado)
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const barcodeRef = useRef<HTMLInputElement | null>(null)

  // Modo manual (sin catálogo / casos extremos)
  const [manualMode, setManualMode] = useState(false)
  const [productIdManual, setProductIdManual] = useState('')

  // Inicializa por doc.id
  useEffect(() => {
    setLines(normalizeLines(doc))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])

  const isConfirmed = String(doc.status).toUpperCase() === 'POSTED'
  const canEdit = !isConfirmed && !busy

  const titulo = `Documento · ${etiquetaTipoDocumento((doc as any).docType)}`
  const subtitulo = isConfirmed
    ? 'Este documento está confirmado: no se puede editar.'
    : 'Escanea o escribe el código de barras, ajusta la cantidad y presiona Enter para agregar.'

  // Cargar catálogo
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setCatalogLoading(true)
      try {
        const p = await listProducts()
        if (mounted) setProducts(p ?? [])
      } catch (e: any) {
        if (mounted) {
          // no bloqueamos: permitimos modo manual
          setErr((prev) => prev ?? `No se pudo cargar el catálogo de productos: ${formatNestError(e)}`)
        }
      } finally {
        if (mounted) setCatalogLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Mapa por código / por id
  const productByBarcode = useMemo(() => {
    const map = new Map<string, Product>()
    for (const p of products) {
      if ((p as any)?.barcode) map.set(String((p as any).barcode).trim(), p)
    }
    return map
  }, [products])

  const productById = useMemo(() => {
    const map = new Map<string, Product>()
    for (const p of products) {
      if ((p as any)?.id) map.set(String((p as any).id), p)
    }
    return map
  }, [products])

  const selectedProduct = useMemo(() => {
    const b = barcode.trim()
    if (!b) return null
    return productByBarcode.get(b) ?? null
  }, [barcode, productByBarcode])

  // Foco inicial para escaneo continuo
  useEffect(() => {
    const t = setTimeout(() => {
      if (!manualMode) barcodeRef.current?.focus()
    }, 60)
    return () => clearTimeout(t)
  }, [manualMode])

  // Atajos desktop dentro del modal:
  // - Ctrl+Enter: guardar líneas
  // - Ctrl+Mayús+Enter: confirmar documento
  // - Esc: si el foco está en el código, limpia; si no, cierra (ya lo maneja ModalShell)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!canEdit) return

      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
        if (esCampoEditable(e.target) && e.target !== barcodeRef.current) return
        e.preventDefault()
        saveLines()
        return
      }

      if (e.ctrlKey && e.key === 'Enter' && e.shiftKey) {
        if (esCampoEditable(e.target) && e.target !== barcodeRef.current) return
        e.preventDefault()
        doConfirm()
        return
      }

      if (e.key === 'Escape') {
        const targetIsEditable = esCampoEditable(e.target)
        const targetIsBarcode = e.target === barcodeRef.current
        if (targetIsEditable && targetIsBarcode && barcode.trim()) {
          e.preventDefault()
          setBarcode('')
          barcodeRef.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, barcode, lines])

  function addQty(delta: number) {
    const current = parseNumeroPositivo(qty) ?? 0
    const next = Math.max(1, current + delta)
    setQty(String(next))
  }

  function addOrUpdateLine(): void {
    setErr(null)

    const qn = parseNumeroPositivo(qty)
    const uc = parseNumeroNoNegativoOUndef(unitCost)

    if (qn === null) return setErr('La cantidad debe ser un número mayor a 0.')
    if (uc === null) return setErr('El costo unitario debe ser un número mayor o igual a 0 (o dejarse vacío).')

    // Modo normal: código de barras
    if (!manualMode) {
      const b = barcode.trim()
      if (!b) return setErr('El código de barras es obligatorio.')

      const p = productByBarcode.get(b)
      if (!p) {
        return setErr(
          `No se encontró un producto con el código de barras “${b}”. Verifica el código o usa el modo manual (ID del producto).`
        )
      }

      const pid = String((p as any).id)
      setLines((prev) => {
        const idx = prev.findIndex((x) => x.productId === pid)
        if (idx >= 0) {
          // UX: si ya existe, suma cantidad
          const copy = [...prev]
          copy[idx] = {
            productId: pid,
            qty: Number(copy[idx].qty) + qn,
            unitCost: uc === undefined ? copy[idx].unitCost : uc
          }
          return copy
        }
        return [...prev, { productId: pid, qty: qn, unitCost: uc === undefined ? undefined : uc }]
      })

      setBarcode('')
      setQty('1')
      setUnitCost('')
      setTimeout(() => barcodeRef.current?.focus(), 0)
      return
    }

    // Modo manual: ID del producto
    const pid = productIdManual.trim()
    if (!pid) return setErr('El ID del producto es obligatorio en modo manual.')

    setLines((prev) => {
      const idx = prev.findIndex((x) => x.productId === pid)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = {
          productId: pid,
          qty: Number(copy[idx].qty) + qn,
          unitCost: uc === undefined ? copy[idx].unitCost : uc
        }
        return copy
      }
      return [...prev, { productId: pid, qty: qn, unitCost: uc === undefined ? undefined : uc }]
    })

    setProductIdManual('')
    setQty('1')
    setUnitCost('')
  }

  function removeLine(pid: string): void {
    setLines((prev) => prev.filter((x) => x.productId !== pid))
  }

  async function saveLines(): Promise<void> {
    setErr(null)
    setBusy(true)
    try {
      const payload: LineInput[] = lines
        .map((l) => ({
          productId: l.productId.trim(),
          qty: Number(l.qty),
          unitCost: l.unitCost === undefined ? undefined : Number(l.unitCost)
        }))
        .filter((l) => l.productId && Number.isFinite(l.qty) && l.qty > 0)

      if (payload.length === 0) {
        setErr('Agrega al menos una línea válida antes de guardar.')
        return
      }

      const updated = await replaceDocLines(doc.id, payload)
      onUpdated(updated)
      setLines(normalizeLines(updated))
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setBusy(false)
    }
  }

  async function doConfirm(): Promise<void> {
    setErr(null)

    if (lines.length === 0) {
      setErr('No puedes confirmar un documento sin líneas.')
      return
    }

    const ok = confirm('¿Confirmar este documento?\n\nDespués de confirmar, no podrás editarlo.')
    if (!ok) return

    setBusy(true)
    try {
      const posted = await postDoc(doc.id)
      onUpdated(posted)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setBusy(false)
    }
  }

  const resumen = useMemo(() => {
    const totalLineas = lines.length
    const totalUnidades = lines.reduce((acc, l) => acc + Number(l.qty || 0), 0)
    return { totalLineas, totalUnidades }
  }, [lines])

  const headerInfo = useMemo(() => {
    const fromName = (doc as any).fromWarehouse?.name
    const toName = (doc as any).toWarehouse?.name
    return {
      estado: etiquetaEstadoDocumento(doc.status),
      numero: doc.docNumber ?? '-',
      creado: formatearFechaHora((doc as any).createdAt),
      origen: fromName ?? doc.fromWarehouseId ?? '-',
      destino: toName ?? doc.toWarehouseId ?? '-',
      notas: (doc as any).notes ?? '-'
    }
  }, [doc])

  return (
    <ModalShell title={titulo} subtitle={subtitulo} onClose={onClose} busy={busy}>
      {/* Resumen documento */}
      <div className="rounded-lg border border-border bg-muted px-3 py-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-fg-muted">Estado:</span> <b className="text-fg">{headerInfo.estado}</b>
          </div>
          <div>
            <span className="text-fg-muted">Número:</span> <b className="text-fg">{headerInfo.numero}</b>
          </div>
          <div>
            <span className="text-fg-muted">Creado:</span> <b className="text-fg">{headerInfo.creado}</b>
          </div>

          <div className="md:col-span-2">
            <span className="text-fg-muted">Bodega origen:</span> <b className="text-fg">{headerInfo.origen}</b>
          </div>
          <div>
            <span className="text-fg-muted">Bodega destino:</span> <b className="text-fg">{headerInfo.destino}</b>
          </div>

          <div className="md:col-span-3">
            <span className="text-fg-muted">Notas:</span> <b className="text-fg">{headerInfo.notas}</b>
          </div>

          <div className="md:col-span-3 text-xs text-fg-muted">
            Líneas: <b className="text-fg">{resumen.totalLineas}</b> · Unidades totales:{' '}
            <b className="text-fg">{resumen.totalUnidades}</b> · ID: <span className="text-fg">{doc.id}</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {err ? (
        <div role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm whitespace-pre-wrap">
          {err}
        </div>
      ) : null}

      {/* Encabezado líneas */}
      <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold">Líneas del documento</div>
          <div className="mt-0.5 text-xs text-fg-muted">
            {catalogLoading ? 'Cargando catálogo de productos…' : `Productos en catálogo: ${products.length}`}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={manualMode}
            onChange={(e) => setManualMode(e.target.checked)}
            disabled={!canEdit}
          />
          <span>Modo manual (usar ID del producto)</span>
        </label>
      </div>

      {/* Barra de captura */}
      <div className="mt-3 rounded-lg border border-border bg-surface p-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
          {/* Código / ID */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {manualMode ? 'ID del producto' : 'Código de barras'}
            </label>

            {!manualMode ? (
              <>
                <input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Escanea o escribe el código de barras"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                  disabled={!canEdit}
                  list="lista-codigos-barras"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addOrUpdateLine()
                    }
                  }}
                />
                <datalist id="lista-codigos-barras">
                  {products.slice(0, 200).map((p) => (
                    <option key={(p as any).id} value={(p as any).barcode}>
                      {(p as any).description ?? (p as any).reference ?? ''}
                    </option>
                  ))}
                </datalist>
              </>
            ) : (
              <input
                value={productIdManual}
                onChange={(e) => setProductIdManual(e.target.value)}
                placeholder="Pega o escribe el ID del producto"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                disabled={!canEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addOrUpdateLine()
                  }
                }}
              />
            )}

            <div className="mt-1 text-[11px] text-fg-muted">
              Atajos: <b>Enter</b> agrega · <b>Ctrl+Enter</b> guarda · <b>Ctrl+Mayús+Enter</b> confirma · <b>Esc</b>{' '}
              {manualMode ? 'cierra' : 'limpia el código (si está en el campo)'}
            </div>
          </div>

          {/* Cantidad */}
          <div className="lg:w-[160px]">
            <label className="block text-sm font-medium mb-1">Cantidad</label>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Ej: 1"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
              disabled={!canEdit}
              inputMode="decimal"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addOrUpdateLine()
                }
              }}
            />
            <div className="mt-1 flex gap-1">
              <button type="button" onClick={() => addQty(1)} disabled={!canEdit} className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                +1
              </button>
              <button type="button" onClick={() => addQty(5)} disabled={!canEdit} className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                +5
              </button>
              <button type="button" onClick={() => addQty(10)} disabled={!canEdit} className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                +10
              </button>
            </div>
          </div>

          {/* Costo unitario */}
          <div className="lg:w-[220px]">
            <label className="block text-sm font-medium mb-1">Costo unitario (opcional)</label>
            <input
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="Ej: 12,50"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
              disabled={!canEdit}
              inputMode="decimal"
            />
            <div className="mt-1 text-[11px] text-fg-muted">Déjalo vacío si no aplica.</div>
          </div>

          {/* Acciones */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={addOrUpdateLine}
              disabled={!canEdit}
              className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50"
              title="Agregar (Enter)"
            >
              Agregar
            </button>

            <button
              type="button"
              onClick={saveLines}
              disabled={!canEdit}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              title="Guardar líneas (Ctrl+Enter)"
            >
              Guardar
            </button>

            <button
              type="button"
              onClick={doConfirm}
              disabled={isConfirmed || busy || lines.length === 0}
              className="rounded-md bg-danger text-danger-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50"
              title="Confirmar documento (Ctrl+Mayús+Enter)"
            >
              Confirmar
            </button>
          </div>
        </div>

        {/* Vista rápida del producto (modo código de barras) */}
        {!manualMode && barcode.trim() ? (
          <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2">
            {selectedProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-fg-muted">Código:</span> <b className="text-fg">{(selectedProduct as any).barcode}</b>
                </div>
                <div>
                  <span className="text-fg-muted">Estado:</span> <b className="text-fg">{String((selectedProduct as any).status ?? '-')}</b>
                </div>
                <div className="md:col-span-2">
                  <span className="text-fg-muted">Producto:</span>{' '}
                  <b className="text-fg">{(selectedProduct as any).description ?? (selectedProduct as any).reference ?? '-'}</b>
                </div>
                <div>
                  <span className="text-fg-muted">Marca:</span> <b className="text-fg">{(selectedProduct as any).brand ?? '-'}</b>
                </div>
                <div>
                  <span className="text-fg-muted">Categoría:</span> <b className="text-fg">{(selectedProduct as any).category ?? '-'}</b>
                </div>
              </div>
            ) : (
              <div className="text-sm text-danger">No se encontró un producto con ese código de barras.</div>
            )}
          </div>
        ) : null}
      </div>

      {/* Tabla líneas */}
      <div className="mt-3 rounded-lg border border-border bg-surface overflow-hidden">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-left text-xs font-semibold text-fg-muted">
                  Código de barras
                </th>
                <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-left text-xs font-semibold text-fg-muted">
                  Producto
                </th>
                <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-right text-xs font-semibold text-fg-muted">
                  Cantidad
                </th>
                <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-right text-xs font-semibold text-fg-muted">
                  Costo unitario
                </th>
                <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-right text-xs font-semibold text-fg-muted" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const p = productById.get(l.productId)
                const codigo = (p as any)?.barcode
                const nombre = (p as any)?.description ?? (p as any)?.reference

                return (
                  <tr key={l.productId} className="hover:bg-muted/60">
                    <td className="border-b border-border/60 px-3 py-2">
                      {codigo ?? (
                        <span className="text-fg-muted">
                          (sin catálogo) ID: <span className="text-fg">{l.productId}</span>
                        </span>
                      )}
                    </td>
                    <td className="border-b border-border/60 px-3 py-2">
                      {nombre ?? <span className="text-fg-muted">—</span>}
                    </td>
                    <td className="border-b border-border/60 px-3 py-2 text-right">{l.qty}</td>
                    <td className="border-b border-border/60 px-3 py-2 text-right">{l.unitCost ?? '—'}</td>
                    <td className="border-b border-border/60 px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(l.productId)}
                        disabled={!canEdit}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                )
              })}

              {lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-sm text-fg-muted">
                    <div className="font-medium text-fg">Aún no hay líneas</div>
                    <div className="mt-1 text-xs text-fg-muted">
                      Escanea un producto, verifica la cantidad y presiona <b>Enter</b> para agregar.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-fg-muted border-t border-border">
          <div>
            Líneas: <b className="text-fg">{resumen.totalLineas}</b> · Unidades: <b className="text-fg">{resumen.totalUnidades}</b>
          </div>
          <div>
            {isConfirmed ? (
              <span className="text-fg">Documento confirmado</span>
            ) : (
              <span>
                Sugerencia: <b className="text-fg">Guardar</b> antes de confirmar.
              </span>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  )
}