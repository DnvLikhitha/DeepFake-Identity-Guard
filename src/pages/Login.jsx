import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, Mail, Lock, Loader } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('password') // 'password' | 'magic'

  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/upload')
    }
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({ email })
    
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }
  }

  if (magicLinkSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="logo">
            <Shield size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>DeepFake <span className="text-gradient">Guard</span></span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Mail size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
            <h2>Check Your Email</h2>
            <p className="subtitle" style={{ marginTop: '0.75rem' }}>
              We sent a magic link to <strong>{email}</strong>. 
              Click the link in the email to sign in.
            </p>
            <button 
              className="btn btn-secondary" 
              onClick={() => setMagicLinkSent(false)}
              style={{ marginTop: '1rem' }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo">
          <Shield size={28} style={{ color: 'var(--accent-primary)' }} />
          <span>DeepFake <span className="text-gradient">Guard</span></span>
        </div>
        
        <h2>Welcome Back</h2>
        <p className="subtitle">Sign in to analyze and protect your images</p>

        {error && (
          <div className="disclaimer-banner" style={{ marginBottom: '1rem', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}>
            <Lock size={16} style={{ color: '#ef4444' }} />
            <span>{error}</span>
          </div>
        )}

        {mode === 'password' ? (
          <form onSubmit={handlePasswordLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? <Loader size={18} className="spinner" style={{ width: 18, height: 18 }} /> : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? <Loader size={18} /> : 'Send Magic Link'}
            </button>
          </form>
        )}

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button 
          className="btn btn-secondary" 
          style={{ width: '100%' }}
          onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}
        >
          {mode === 'password' ? (
            <>
              <Mail size={16} />
              Sign in with Magic Link
            </>
          ) : (
            <>
              <Lock size={16} />
              Sign in with Password
            </>
          )}
        </button>

        <div className="auth-footer">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </div>
      </div>
    </div>
  )
}
