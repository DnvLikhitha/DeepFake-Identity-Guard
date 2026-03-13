import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Upload from './pages/Upload'
import Results from './pages/Results'
import History from './pages/History'
import Resources from './pages/Resources'

function ProtectedRoute({ children, user }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="loading-state" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <div className="spinner" />
        <p className="text-muted">Loading...</p>
      </div>
    )
  }

  return (
    <>
      <Navbar user={user} />
      <main className="page">
        <Routes>
          <Route path="/" element={<Landing user={user} />} />
          <Route path="/login" element={user ? <Navigate to="/upload" /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to="/upload" /> : <SignUp />} />
          <Route path="/upload" element={
            <ProtectedRoute user={user}>
              <Upload user={user} />
            </ProtectedRoute>
          } />
          <Route path="/results/:analysisId" element={
            <ProtectedRoute user={user}>
              <Results user={user} />
            </ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute user={user}>
              <History user={user} />
            </ProtectedRoute>
          } />
          <Route path="/resources" element={<Resources />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
