import { http } from '../../api/http'

export type MeProfile = {
  id: string
  username: string
  fullName: string
  roles: string[]
  defaultBranchId?: string | null
  defaultWarehouseId?: string | null
  defaultBranch?: { id: string; code?: string; name: string } | null
  defaultWarehouse?: { id: string; code?: string; name: string } | null
}

export type WarehouseLookup = {
  id: string
  code: string
  name: string
  branchId: string | null
  isActive?: boolean
  createdAt?: string
  branch?: { id: string; code: string; name: string; type: string } | null
}

/** ✅ Para MovementsPanel: lista de productos (para NO adivinar UUIDs) */
export type Product = {
  id: string
  barcode: string

  reference: string | null
  brand: string | null
  category: string | null
  description: string | null

  // nuevos campos (si tu backend ya los devuelve)
  brandCode?: string | null
  size?: string | null
  color?: string | null
  containerNumber?: string | null
  billingNumber?: string | null

  cost?: any
  priceRetail?: any
  priceWholesale?: any

  status?: any
  createdAt?: string
  updatedAt?: string
}

export type StockRow = {
  warehouseId: string
  productId: string
  qtyOnHand: any
  updatedAt: string
  product: any
  warehouse: any
}

export type InventoryDocLine = {
  id?: string
  docId?: string
  productId: string
  qty: number
  unitCost?: number
  product?: any
}

export type InventoryDoc = {
  id: string
  docType: 'INITIAL_LOAD' | 'DISPATCH' | 'RECEIVE' | 'ADJUSTMENT' | 'RETURN'
  status: 'DRAFT' | 'POSTED'
  docNumber: string | null
  fromWarehouseId: string | null
  toWarehouseId: string | null
  notes: string | null
  createdBy: string
  createdByUserId: string
  createdAt: string
  postedAt: string | null
  postedBy: string | null
  postedByUserId: string | null
  lines: InventoryDocLine[]
  fromWarehouse?: any | null
  toWarehouse?: any | null
}

export async function getMeProfile() {
  const { data } = await http.get<MeProfile>('/users/me/profile')
  return data
}

export async function searchWarehouses(params: { q: string; branchId?: string | null }) {
  const qs = new URLSearchParams()
  qs.set('q', params.q)
  if (params.branchId) qs.set('branchId', params.branchId)
  const { data } = await http.get<WarehouseLookup[]>(`/warehouses?${qs.toString()}`)
  return data
}

/** ✅ GET /products (para selects/búsqueda por barcode/descripcion y tomar el id real) */
export async function listProducts() {
  const { data } = await http.get<Product[]>('/products')
  return data
}

export async function getStock(warehouseId: string, productId?: string) {
  const qs = new URLSearchParams()
  qs.set('warehouseId', warehouseId)
  if (productId) qs.set('productId', productId)
  const { data } = await http.get<StockRow[]>(`/stock?${qs.toString()}`)
  return data
}

export async function getMovements(params: { warehouseId: string; productId?: string; from?: string; to?: string }) {
  const qs = new URLSearchParams()
  qs.set('warehouseId', params.warehouseId)
  if (params.productId) qs.set('productId', params.productId)
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)

  const { data } = await http.get<InventoryDoc[]>(`/inventory/movements?${qs.toString()}`)
  return data
}

export async function createDraftDoc(body: {
  docType: InventoryDoc['docType']
  fromWarehouseId?: string
  toWarehouseId?: string
  notes?: string
}) {
  const { data } = await http.post<InventoryDoc>('/inventory/docs', body)
  return data
}

export async function replaceDocLines(docId: string, lines: Array<{ productId: string; qty: number; unitCost?: number }>) {
  const { data } = await http.post<InventoryDoc>(`/inventory/docs/${docId}/lines`, { lines })
  return data
}

export async function postDoc(docId: string) {
  const { data } = await http.post<InventoryDoc>(`/inventory/docs/${docId}/post`)
  return data
}