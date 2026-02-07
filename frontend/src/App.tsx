import { useState } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { Header } from './components/Header'
import { LoginForm } from './components/LoginForm'
import { SignupForm } from './components/SignupForm'
import { ProfileEditor } from './components/ProfileEditor'

type Page = 'home' | 'login' | 'signup' | 'profile'

function App() {
  const [page, setPage] = useState<Page>('home')

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Header onNavigate={(p) => setPage(p as Page)} />
        <main className="mx-auto max-w-5xl px-6 py-12">
          {page === 'login' && <LoginForm onNavigate={(p) => setPage(p as Page)} />}
          {page === 'signup' && <SignupForm onNavigate={(p) => setPage(p as Page)} />}
          {page === 'profile' && <ProfileEditor onNavigate={(p) => setPage(p as Page)} />}
          {page === 'home' && (
            <p className="text-gray-400">
              Track and compare game subscription services.
            </p>
          )}
        </main>
      </div>
    </AuthProvider>
  )
}

export default App
