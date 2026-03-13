import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, Lock, Loader } from 'lucide-react'

export default function SignUp() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')

    if (!consent) {
      setError('Please acknowledge the privacy terms to continue.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
    } else if (data.user && !data.session) {
      setSuccess(true)
    } else {
      navigate('/upload')
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="logo">
            <Shield size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>DeepFake <span className="text-gradient">Guard</span></span>
          </div>
          <h2>Check Your Email</h2>
          <p className="subtitle" style={{ marginTop: '0.75rem' }}>
            We sent a confirmation link to <strong>{email}</strong>. 
            Click the link to activate your account.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
            Go to Login
          </Link>
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
        
        <h2>Create Account</h2>
        <p className="subtitle">Join to start protecting your digital identity</p>

        {error && (
          <div className="disclaimer-banner" style={{ marginBottom: '1rem', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}>
            <Lock size={16} style={{ color: '#ef4444' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignUp}>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
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
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="checkbox-group">
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <label htmlFor="consent">
              I understand that my uploaded images will be analyzed by AI and 
              <strong> automatically deleted within 24 hours</strong>. I agree to the 
              privacy terms and acknowledge that results are probabilistic, not legal proof.
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading || !consent}>
            {loading ? <Loader size={18} /> : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  )
}
