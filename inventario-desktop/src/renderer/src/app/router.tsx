import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { LoginPage } from '../features/auth/LoginPage'
import { AdminHome } from '../features/admin/AdminHome'
import { InventoryHome } from '../features/inventory/InventoryHome'

function ProtectedRoute({ allowRoles, children }: { allowRoles: string[]; children: React.ReactNode }) {
  const { loading, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-fg grid place-items-center p-6">
        <div className="card w-full max-w-sm p-4">
          <div className="text-sm text-fg-muted">Cargando…</div>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const ok = user.roles.some((r) => allowRoles.includes(r))
  if (!ok) return <Navigate to="/login" replace />

  return <>{children}</>
}

export function AppRouter() {
  const { loading, user } = useAuth()

  const defaultRoute = () => {
    if (loading) return '/login'
    if (!user) return '/login'
    if (user.roles.includes('ADMIN')) return '/admin'
    return '/inventory'
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={defaultRoute()} replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowRoles={['ADMIN']}>
            <AdminHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute allowRoles={['ADMIN', 'SUPERVISOR', 'BODEGA', 'SUCURSAL']}>
            <InventoryHome />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}