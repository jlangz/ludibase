import { useState } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { Header } from './components/Header'
import { LoginForm } from './components/LoginForm'
import { SignupForm } from './components/SignupForm'
import { ProfileEditor } from './components/ProfileEditor'
import { GameSearch } from './components/GameSearch'
import { ResetPasswordForm } from './components/ResetPasswordForm'
import { useAuth } from './hooks/useAuth'

type Page = 'home' | 'login' | 'signup' | 'profile'

function AppContent() {
  const [page, setPage] = useState<Page>('home')
  const { needsPasswordReset } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header onNavigate={(p) => setPage(p as Page)} />
      <main className="mx-auto max-w-5xl px-6 py-12">
        {needsPasswordReset ? (
          <ResetPasswordForm />
        ) : (
          <>
            {page === 'login' && <LoginForm onNavigate={(p) => setPage(p as Page)} />}
            {page === 'signup' && <SignupForm onNavigate={(p) => setPage(p as Page)} />}
            {page === 'profile' && <ProfileEditor onNavigate={(p) => setPage(p as Page)} />}
            {page === 'home' && <GameSearch />}
          </>
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
