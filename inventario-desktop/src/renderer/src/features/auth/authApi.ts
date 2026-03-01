import { http } from '../../api/http'

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

export type LoginResponse = {
  access_token: string
  user: SafeUser
}

export type AuthMe = {
  id: string
  username: string
  fullName: string
  roles: string[]
}

export async function login(username: string, password: string) {
  const { data } = await http.post<LoginResponse>('/auth/login', { username, password })
  return data
}

export async function me() {
  const { data } = await http.get<AuthMe>('/auth/me')
  return data
}