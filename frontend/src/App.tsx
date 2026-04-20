import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Header } from './components/Header'
import { LoginForm } from './pages/LoginForm'
import { SignupForm } from './pages/SignupForm'
import { ProfileEditor } from './pages/ProfileEditor'
import { HomePage } from './pages/HomePage'
import { GamePage } from './pages/GamePage'
import { SearchPage } from './pages/SearchPage'
import { CollectionPage } from './pages/CollectionPage'
import { ServicePage } from './pages/ServicePage'
import { SavedArticlesPage } from './pages/SavedArticlesPage'
import { ResetPasswordForm } from './pages/ResetPasswordForm'
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
            <Route path="/" element={<HomePage />} />
            <Route path="/game/:igdbId" element={<GamePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/collection" element={<CollectionPage />} />
            <Route path="/services/:family" element={<ServicePage />} />
            <Route path="/saved-articles" element={<SavedArticlesPage />} />
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
