import { useEffect, useMemo, useRef, useState } from 'react'
import { formatNestError } from '../../api/errors'
import { createDraftDoc, searchWarehouses, type InventoryDoc, type WarehouseLookup } from './inventoryApi'
import { DocEditorModal } from './DocEditorModal'

function fmtFechaHora(v?: string | null) {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString()
}

function nombreTipoDoc(t: InventoryDoc['docType']) {
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

function nombreEstadoDoc(s: InventoryDoc['status'] | undefined) {
  if (!s) return '-'
  const v = String(s).toUpperCase()
  if (v === 'DRAFT') return 'Borrador'
  if (v === 'POSTED') return 'Confirmado'
  return String(s)
}

function warehouseLabel(w: WarehouseLookup) {
  const bname = w.branch?.name ?? 'Sin sucursal'
  return `${w.code} — ${w.name} | ${bname} (ID: ${w.id})`
}

export function DocsPanel({ warehouseId }: { warehouseId: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [docType, setDocType] = useState<InventoryDoc['docType']>('RECEIVE')
  const [notes, setNotes] = useState('')
  const [adjustSign, setAdjustSign] = useState<'+' | '-'>('+')

  // ✅ DESTINO DESPACHO: buscar por nombre/código y seleccionar por label (sin adivinar IDs)
  const [dispatchToWarehouseId, setDispatchToWarehouseId] = useState('')
  const [dispatchQ, setDispatchQ] = useState('')
  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [dispatchOptions, setDispatchOptions] = useState<WarehouseLookup[]>([])

  const [drafts, setDrafts] = useState<InventoryDoc[]>([])
  const [activeDoc, setActiveDoc] = useState<InventoryDoc | null>(null)

  const typeRef = useRef<HTMLSelectElement | null>(null)

  // UX: limpiar campos cuando cambia tipo
  useEffect(() => {
    setErr(null)
    if (docType !== 'DISPATCH') {
      setDispatchToWarehouseId('')
      setDispatchQ('')
      setDispatchOptions([])
    }
  }, [docType])

  // ✅ Buscar bodegas para destino (solo cuando el usuario escribe)
  useEffect(() => {
    if (docType !== 'DISPATCH') return

    const q = dispatchQ.trim()
    if (q.length < 2) {
      setDispatchOptions([])
      return
    }

    const t = setTimeout(async () => {
      setDispatchLoading(true)
      setErr(null)
      try {
        const rows = await searchWarehouses({ q })
        // Evitar que seleccione la misma bodega origen como destino
        const filtered = (rows ?? []).filter((w) => w.id !== warehouseId)
        setDispatchOptions(filtered)
      } catch (e: any) {
        setErr(formatNestError(e))
      } finally {
        setDispatchLoading(false)
      }
    }, 250)

    return () => clearTimeout(t)
  }, [docType, dispatchQ, warehouseId])

  const createPayload = useMemo(() => {
    const base: any = { docType, notes: notes.trim() || undefined }

    if (docType === 'INITIAL_LOAD' || docType === 'RECEIVE' || docType === 'RETURN') {
      base.toWarehouseId = warehouseId
    } else if (docType === 'DISPATCH') {
      base.fromWarehouseId = warehouseId
      if (dispatchToWarehouseId.trim()) base.toWarehouseId = dispatchToWarehouseId.trim()
    } else if (docType === 'ADJUSTMENT') {
      if (adjustSign === '+') base.toWarehouseId = warehouseId
      else base.fromWarehouseId = warehouseId
    }

    return base
  }, [docType, notes, warehouseId, dispatchToWarehouseId, adjustSign])

  async function createDoc() {
    setErr(null)

    // ✅ Validación UX: para DESPACHO exigimos seleccionar destino por nombre
    if (docType === 'DISPATCH') {
      const toId = dispatchToWarehouseId.trim()
      if (!toId) {
        setErr('Selecciona la bodega destino (busca por nombre/código y elige una opción).')
        return
      }
      if (toId === warehouseId) {
        setErr('La bodega destino no puede ser la misma que la bodega origen.')
        return
      }
    }

    setBusy(true)
    try {
      const created = await createDraftDoc(createPayload)
      setDrafts((prev) => [created, ...prev])
      setActiveDoc(created)
    } catch (e: any) {
      setErr(formatNestError(e))
    } finally {
      setBusy(false)
    }
  }

  function onUpdated(doc: InventoryDoc) {
    setActiveDoc(doc)
    setDrafts((prev) => prev.map((d) => (d.id === doc.id ? doc : d)))
  }

  useEffect(() => {
    const t = setTimeout(() => typeRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  const selectedDispatchWh = useMemo(() => {
    return dispatchOptions.find((w) => w.id === dispatchToWarehouseId) ?? null
  }, [dispatchOptions, dispatchToWarehouseId])

  return (
    <div className="mt-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="m-0 text-base font-semibold">Documentos</h3>
          <div className="mt-0.5 text-xs text-fg-muted">
            Crea documentos en <b className="text-fg">borrador</b> y luego edita sus líneas.
          </div>
        </div>

        <div className="text-xs text-fg-muted">
          Borradores en sesión: <b className="text-fg">{drafts.length}</b>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-sm font-semibold">Crear documento (borrador)</div>
          <div className="mt-0.5 text-xs text-fg-muted">
            Consejo: crea el borrador y abre el editor para agregar líneas.
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de documento</label>
              <select
                ref={typeRef}
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                disabled={busy}
              >
                <option value="INITIAL_LOAD">Carga inicial</option>
                <option value="RECEIVE">Recepción</option>
                <option value="DISPATCH">Despacho</option>
                <option value="ADJUSTMENT">Ajuste</option>
                <option value="RETURN">Devolución</option>
              </select>
            </div>

            {docType === 'DISPATCH' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Buscar bodega destino (code o name)</label>
                  <input
                    value={dispatchQ}
                    onChange={(e) => setDispatchQ(e.target.value)}
                    placeholder="Ej: WH-CENTRAL o Central (mín. 2 letras)"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                    disabled={busy}
                  />
                  <div className="mt-1 text-xs text-fg-muted">
                    {dispatchQ.trim().length < 2
                      ? 'Escribe al menos 2 caracteres para buscar.'
                      : dispatchLoading
                      ? 'Buscando bodegas…'
                      : `${dispatchOptions.length} resultado(s)`}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Bodega destino</label>
                  <select
                    value={dispatchToWarehouseId}
                    onChange={(e) => setDispatchToWarehouseId(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                    disabled={busy || dispatchLoading || dispatchOptions.length === 0}
                  >
                    <option value="">(selecciona una bodega)</option>
                    {dispatchOptions.map((w) => (
                      <option key={w.id} value={w.id}>
                        {warehouseLabel(w)}
                      </option>
                    ))}
                  </select>

                  {selectedDispatchWh ? (
                    <div className="mt-1 text-xs text-fg-muted">
                      Seleccionada: <span className="text-fg">{selectedDispatchWh.code}</span> — {selectedDispatchWh.name}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-fg-muted">
                      Recomendado: siempre define destino para trazabilidad.
                    </div>
                  )}
                </div>
              </div>
            )}

            {docType === 'ADJUSTMENT' && (
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de ajuste</label>
                <select
                  value={adjustSign}
                  onChange={(e) => setAdjustSign(e.target.value as any)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                  disabled={busy}
                >
                  <option value="+">Entrada (+)</option>
                  <option value="-">Salida (-)</option>
                </select>
                <div className="mt-1 text-xs text-fg-muted">
                  Entrada aumenta existencias. Salida disminuye existencias.
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Ajuste por conteo físico"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
                disabled={busy}
              />
            </div>

            {err ? (
              <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 text-danger px-3 py-2 text-sm">
                {err}
              </div>
            ) : null}

            <button
              type="button"
              onClick={createDoc}
              disabled={busy}
              className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50"
            >
              {busy ? 'Creando…' : 'Crear documento'}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Borradores (sesión actual)</div>
            <div className="text-xs text-fg-muted">{drafts.length} item(s)</div>
          </div>

          <div className="mt-3 rounded-lg border border-border overflow-hidden">
            <div className="max-h-[calc(100vh-320px)] overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-left text-xs font-semibold text-fg-muted">
                      Tipo
                    </th>
                    <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-left text-xs font-semibold text-fg-muted">
                      Estado
                    </th>
                    <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-left text-xs font-semibold text-fg-muted">
                      Número
                    </th>
                    <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-left text-xs font-semibold text-fg-muted">
                      Creado
                    </th>
                    <th className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-3 py-2 text-right text-xs font-semibold text-fg-muted" />
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/60">
                      <td className="border-b border-border/60 px-3 py-2">{nombreTipoDoc(d.docType)}</td>
                      <td className="border-b border-border/60 px-3 py-2">{nombreEstadoDoc(d.status)}</td>
                      <td className="border-b border-border/60 px-3 py-2">{d.docNumber ?? '-'}</td>
                      <td className="border-b border-border/60 px-3 py-2">{fmtFechaHora(d.createdAt)}</td>
                      <td className="border-b border-border/60 px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveDoc(d)}
                          className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-muted"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}

                  {drafts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-sm text-fg-muted">
                        <div className="font-medium text-fg">Aún no has creado documentos en esta sesión.</div>
                        <div className="mt-1 text-xs text-fg-muted">
                          Crea un documento a la izquierda y se mostrará aquí para abrirlo.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 text-xs text-fg-muted">
            Nota: Para listar o reabrir borradores antiguos se necesitan endpoints en el backend (por ejemplo, listar documentos y buscar por estado).
          </div>
        </div>
      </div>

      {activeDoc && (
        <DocEditorModal doc={activeDoc} onClose={() => setActiveDoc(null)} onUpdated={onUpdated} />
      )}
    </div>
  )
}