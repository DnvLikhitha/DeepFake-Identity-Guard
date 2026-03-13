import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getUserAnalyses } from '../lib/api'
import { Clock, FileSearch, ArrowRight, Upload } from 'lucide-react'

const RISK_COLORS = {
  Low: 'var(--risk-low)',
  Moderate: 'var(--risk-moderate)',
  High: 'var(--risk-high)',
  Critical: 'var(--risk-critical)',
}

export default function History({ user }) {
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const data = await getUserAnalyses(user.id)
      setAnalyses(data || [])
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="loading-state">
          <div className="spinner" />
          <p className="text-muted">Loading analysis history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>
            Analysis <span className="text-gradient">History</span>
          </h1>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>
            View your past analysis results (metadata only — images are deleted after 24h)
          </p>
        </div>
        <Link to="/upload" className="btn btn-primary">
          <Upload size={16} /> New Analysis
        </Link>
      </div>

      {analyses.length === 0 ? (
        <div className="empty-state">
          <FileSearch size={64} />
          <h3>No Analyses Yet</h3>
          <p>Upload an image to get your first deepfake detection report.</p>
          <Link to="/upload" className="btn btn-primary">
            <Upload size={16} /> Upload Image
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {analyses.map((item) => (
            <Link key={item.id} to={`/results/${item.id}`} className="history-item">
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSearch size={20} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div className="info">
                <div style={{ fontWeight: 600 }}>
                  {item.image_path?.split('/').pop() || 'Analysis'}
                </div>
                <div className="date">
                  <Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
              {item.mls_score !== null && (
                <>
                  <span className={`risk-badge ${(item.risk_tier || 'low').toLowerCase()}`}>
                    {item.risk_tier}
                  </span>
                  <div className="score-mini" style={{ color: RISK_COLORS[item.risk_tier] || RISK_COLORS.Low }}>
                    {item.mls_score}
                  </div>
                </>
              )}
              <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
