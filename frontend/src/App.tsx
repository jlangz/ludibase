import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Header } from './components/Header'
import { LoginForm } from './components/LoginForm'
import { SignupForm } from './components/SignupForm'
import { ProfileEditor } from './components/ProfileEditor'
import { GameSearch } from './components/GameSearch'
import { ResetPasswordForm } from './components/ResetPasswordForm'
import { useAuth } from './hooks/useAuth'

function AppContent() {
  const { needsPasswordReset } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-12">
        {needsPasswordReset ? (
          <ResetPasswordForm />
        ) : (
          <Routes>
            <Route path="/" element={<GameSearch />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/signup" element={<SignupForm />} />
            <Route path="/profile" element={<ProfileEditor />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
