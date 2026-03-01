import { http } from '../../api/http'

/** =========================
 * USERS + ROLES
 * ========================= */

export type SafeUser = {
  id: string
  username: string
  fullName: string
  email: string | null
  phone: string | null
  mustChangePassword: boolean
  isActive: boolean
  defaultBranchId: string | null
  defaultWarehouseId: string | null
  createdAt: string
  updatedAt: string
  roles: string[]
}

export type Role = {
  id: string
  code: string
  isActive: boolean
}

/** =========================
 * BRANCHES + WAREHOUSES
 * ========================= */

export type BranchType = 'CENTRAL' | 'BRANCH'

export type Branch = {
  id: string
  code: string
  name: string
  type: BranchType
  isActive: boolean
  createdAt: string
}

export type Warehouse = {
  id: string
  code: string
  name: string
  branchId: string | null
  isActive: boolean
  createdAt: string
  branch?: { id: string; code: string; name: string; type: BranchType } | null
}

export type CreateBranchRequest = {
  code: string
  name: string
  type: BranchType
  isActive?: boolean
}

export type UpdateBranchRequest = Partial<CreateBranchRequest>

export type CreateWarehouseRequest = {
  branchId?: string | null // ✅ ahora opcional
  code: string
  name: string
  isActive?: boolean
}

export type UpdateWarehouseRequest = Partial<CreateWarehouseRequest>

/** USERS */
export type CreateUserRequest = {
  username: string
  fullName: string
  email?: string | null
  phone?: string | null
  password: string
  mustChangePassword?: boolean
  isActive?: boolean
  defaultBranchId?: string | null
  defaultWarehouseId?: string | null
  roleCodes?: string[]
}

export type UpdateUserRequest = {
  username?: string
  fullName?: string
  email?: string | null
  phone?: string | null
  mustChangePassword?: boolean
  isActive?: boolean
  defaultBranchId?: string | null
  defaultWarehouseId?: string | null
}

export async function listUsers() {
  const { data } = await http.get<SafeUser[]>('/users')
  return data
}

export async function createUser(body: CreateUserRequest) {
  const { data } = await http.post<SafeUser>('/users', body)
  return data
}

export async function updateUser(id: string, body: UpdateUserRequest) {
  const { data } = await http.patch<SafeUser>(`/users/${id}`, body)
  return data
}

export async function changeUserPassword(id: string, newPassword: string, mustChangePassword?: boolean) {
  const { data } = await http.patch<SafeUser>(`/users/${id}/password`, { newPassword, mustChangePassword })
  return data
}

export async function setUserRoles(id: string, roleCodes: string[]) {
  const { data } = await http.put<SafeUser>(`/users/${id}/roles`, { roleCodes })
  return data
}

export async function listRoles() {
  const { data } = await http.get<Role[]>('/roles')
  return data
}

/** BRANCHES */
export async function listBranches(q?: string) {
  const qs = new URLSearchParams()
  if (q && q.trim()) qs.set('q', q.trim())
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { data } = await http.get<any[]>(`/branches${suffix}`)

  return (data ?? []).map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    type: b.type,
    isActive: Boolean(b.isActive),
    createdAt: b.createdAt
  })) as Branch[]
}

export async function createBranch(body: CreateBranchRequest) {
  const { data } = await http.post<Branch>('/branches', body)
  return data
}

export async function updateBranch(id: string, body: UpdateBranchRequest) {
  const { data } = await http.patch<Branch>(`/branches/${id}`, body)
  return data
}

/** WAREHOUSES */
export async function listWarehouses(branchId?: string | null, q?: string) {
  const qs = new URLSearchParams()
  if (branchId) qs.set('branchId', branchId)
  if (q && q.trim()) qs.set('q', q.trim())

  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { data } = await http.get<any[]>(`/warehouses${suffix}`)

  return (data ?? []).map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    branchId: w.branchId ?? null,
    isActive: Boolean(w.isActive),
    createdAt: w.createdAt,
    branch: w.branch ?? null
  })) as Warehouse[]
}

export async function createWarehouse(body: CreateWarehouseRequest) {
  const payload = {
    ...body,
    branchId: body.branchId === undefined ? undefined : body.branchId // puede ser null
  }
  const { data } = await http.post<Warehouse>('/warehouses', payload)
  return data
}

export async function updateWarehouse(id: string, body: UpdateWarehouseRequest) {
  const payload = {
    ...body,
    branchId: body.branchId === undefined ? undefined : body.branchId // puede ser null
  }
  const { data } = await http.patch<Warehouse>(`/warehouses/${id}`, payload)
  return data
}

/** =========================
 * PRODUCTS
 * ========================= */

export type ProductStatus = 'ACTIVE' | 'INACTIVE'

export type Product = {
  id: string
  barcode: string

  reference: string | null
  brand: string | null
  description: string | null
  category: string | null

  brandCode: string | null
  size: string | null
  color: string | null
  containerNumber: string | null
  billingNumber: string | null

  cost: any
  priceRetail: any
  priceWholesale: any

  status: ProductStatus
  createdAt: string
  updatedAt: string
}

export type CreateProductRequest = {
  barcode: string

  reference?: string | null
  brand?: string | null
  description?: string | null
  category?: string | null

  brandCode?: string | null
  size?: string | null
  color?: string | null
  containerNumber?: string | null
  billingNumber?: string | null

  cost: string
  priceRetail: string
  priceWholesale: string

  status: ProductStatus
}

export type UpdateProductRequest = Partial<CreateProductRequest>

export type ProductAudit = {
  id: string
  productId: string
  changedAt: string
  changedBy: string
  changedByUserId: string
  before: any
  after: any
}

export async function listProducts() {
  const { data } = await http.get<Product[]>('/products')
  return data
}

export async function createProduct(body: CreateProductRequest) {
  const { data } = await http.post<Product>('/products', body)
  return data
}

export async function updateProduct(id: string, body: UpdateProductRequest) {
  const { data } = await http.patch<Product>(`/products/${id}`, body)
  return data
}

export async function deactivateProduct(id: string) {
  const { data } = await http.delete<Product>(`/products/${id}`)
  return data
}

export async function getProductAudit(productId: string) {
  const { data } = await http.get<ProductAudit[]>(`/products/${productId}/audit`)
  return data
}