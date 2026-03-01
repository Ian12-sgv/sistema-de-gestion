
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './renderer/src/app/auth/AuthProvider'
import { AppRouter } from './renderer/src/app/router'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  )
}