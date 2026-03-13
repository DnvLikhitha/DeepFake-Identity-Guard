import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, Upload, History, BookOpen, LogOut, LogIn } from 'lucide-react'

export default function Navbar({ user }) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const isActive = (path) => location.pathname === path ? 'active' : ''

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="navbar-brand">
          <Shield size={28} />
          <span>DeepFake <span className="text-gradient">Guard</span></span>
        </Link>

        <div className="navbar-links">
          {user ? (
            <>
              <Link to="/upload" className={isActive('/upload')}>
                <Upload size={18} />
                <span>Analyze</span>
              </Link>
              <Link to="/history" className={isActive('/history')}>
                <History size={18} />
                <span>History</span>
              </Link>
              <Link to="/resources" className={isActive('/resources')}>
                <BookOpen size={18} />
                <span>Resources</span>
              </Link>
              <button onClick={handleLogout}>
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/resources" className={isActive('/resources')}>
                <BookOpen size={18} />
                <span>Resources</span>
              </Link>
              <Link to="/login" className={`btn btn-primary btn-sm`}>
                <LogIn size={16} />
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
