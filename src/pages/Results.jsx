import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAnalysis, getSignedUrl, uploadReport } from '../lib/api'
import { AlertTriangle, Download, Share2, Copy, Check, ExternalLink, Shield, Phone, FileText, ArrowLeft } from 'lucide-react'
import { jsPDF } from 'jspdf'

const RISK_COLORS = {
  Low: 'var(--risk-low)',
  Moderate: 'var(--risk-moderate)',
  High: 'var(--risk-high)',
  Critical: 'var(--risk-critical)',
}

const GUIDANCE = {
  Low: {
    title: 'Low Risk — General Safety Tips',
    cards: [
      { title: 'Set Up Image Alerts', text: 'Use Google Alerts or TinEye to monitor for your images appearing online.', color: 'green' },
      { title: 'Review Privacy Settings', text: 'Ensure your social media profiles have restricted image downloading and visibility.', color: 'cyan' },
    ]
  },
  Moderate: {
    title: 'Moderate Risk — Take Precautions',
    cards: [
      { title: 'Document Everything', text: 'Screenshot the image, URLs, and timestamps. Preserve evidence before it disappears.', color: 'amber' },
      { title: 'Report to Platform', text: 'Use the platform\'s reporting tools to flag the content. Most major platforms have dedicated image abuse reporting.', color: 'cyan' },
    ]
  },
  High: {
    title: 'High Risk — Take Action Now',
    cards: [
      { title: 'File Cyber Crime Complaint', text: 'Report at cybercrime.gov.in (India) or your local cyber crime cell. Use this report as evidence.', color: 'red', link: 'https://cybercrime.gov.in' },
      { title: 'Platform Reporting Guides', text: 'Report on Instagram, Facebook, WhatsApp, Telegram, or X using their dedicated image abuse tools.', color: 'amber' },
      { title: 'Contact Legal Aid', text: 'Reach out to Internet Freedom Foundation or local legal aid for guidance on your rights.', color: 'purple' },
    ]
  },
  Critical: {
    title: 'Critical Risk — Immediate Action Required',
    cards: [
      { title: '🚨 Emergency Cyber Crime Report', text: 'File an immediate complaint at cybercrime.gov.in or call 1930 (India Cyber Crime Helpline).', color: 'red', link: 'https://cybercrime.gov.in' },
      { title: '📞 Contact Helpline', text: 'iCall: 9152987821 | iDare: 1800-102-4040. These services provide free, confidential support.', color: 'red' },
      { title: 'Preserve Evidence', text: 'Download this report. Do not delete the original image. Screenshot all instances you find online.', color: 'amber' },
      { title: 'Legal Templates', text: 'Use legal template letters for cease & desist and platform takedown requests. Available through IFF resources.', color: 'purple' },
    ]
  }
}

export default function Results({ user }) {
  const { analysisId } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadAnalysis()
  }, [analysisId])

  const loadAnalysis = async () => {
    try {
      const data = await getAnalysis(analysisId)
      setAnalysis(data)
    } catch (err) {
      setError('Failed to load analysis results.')
    } finally {
      setLoading(false)
    }
  }

  const copyEvidence = () => {
    const text = `Report ID: ${analysis.id}\nDate: ${new Date(analysis.created_at).toISOString()}\nMLS Score: ${analysis.mls_score}/100\nRisk Tier: ${analysis.risk_tier}\nImage Hash: ${analysis.image_path}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generatePDF = async () => {
    setGenerating(true)
    try {
      const doc = new jsPDF()
      const signals = analysis.signal_breakdown || []
      
      // Header
      doc.setFontSize(20)
      doc.setTextColor(6, 182, 212)
      doc.text('DeepFake Identity Guard', 20, 25)
      doc.setFontSize(12)
      doc.setTextColor(100, 100, 100)
      doc.text('Manipulation Risk Report', 20, 33)
      
      // Line
      doc.setDrawColor(6, 182, 212)
      doc.setLineWidth(0.5)
      doc.line(20, 38, 190, 38)
      
      // Summary
      doc.setFontSize(14)
      doc.setTextColor(40, 40, 40)
      doc.text('Summary', 20, 50)
      
      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      doc.text(`Report ID: ${analysis.id}`, 20, 58)
      doc.text(`Date: ${new Date(analysis.created_at).toLocaleString()}`, 20, 64)
      doc.text(`Manipulation Likelihood Score: ${analysis.mls_score} / 100`, 20, 70)
      doc.text(`Risk Tier: ${analysis.risk_tier}`, 20, 76)
      
      // Score indicator
      const scoreColor = analysis.mls_score >= 75 ? [220, 38, 38] : 
                          analysis.mls_score >= 55 ? [239, 68, 68] :
                          analysis.mls_score >= 35 ? [245, 158, 11] : [16, 185, 129]
      doc.setFillColor(...scoreColor)
      doc.roundedRect(150, 55, 35, 20, 3, 3, 'F')
      doc.setFontSize(18)
      doc.setTextColor(255, 255, 255)
      doc.text(`${analysis.mls_score}`, 167, 68, { align: 'center' })
      
      // Signal Breakdown
      doc.setFontSize(14)
      doc.setTextColor(40, 40, 40)
      doc.text('Detection Signal Breakdown', 20, 92)
      
      let y = 100
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text('Signal', 20, y)
      doc.text('Status', 100, y)
      doc.text('Score', 140, y)
      doc.text('Detail', 160, y)
      
      doc.setDrawColor(200, 200, 200)
      doc.line(20, y + 2, 190, y + 2)
      
      y += 8
      signals.forEach(signal => {
        doc.setTextColor(60, 60, 60)
        doc.text(signal.name || '', 20, y)
        doc.text(signal.status || '', 100, y)
        doc.text(`${signal.score || 0}`, 140, y)
        const detail = signal.detail || ''
        const lines = doc.splitTextToSize(detail, 30)
        doc.setTextColor(120, 120, 120)
        doc.text(lines[0] || '', 160, y)
        y += 7
      })
      
      // Disclaimer
      y += 10
      doc.setDrawColor(245, 158, 11)
      doc.setLineWidth(0.3)
      doc.line(20, y, 190, y)
      y += 8
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      const disclaimer = 'DISCLAIMER: This report is generated by an AI tool and provides probabilistic analysis only. Results should not be considered legal proof of manipulation. Consult a forensic expert for legally admissible evidence.'
      const disclaimerLines = doc.splitTextToSize(disclaimer, 170)
      doc.text(disclaimerLines, 20, y)
      
      // Save & upload
      const pdfBlob = doc.output('blob')
      
      doc.save(`deepfake-report-${analysisId.slice(0, 8)}.pdf`)
      
      // Also upload to Supabase
      try {
        await uploadReport(pdfBlob, user.id, analysisId)
      } catch {
        // Non-critical failure
      }
    } catch (err) {
      console.error('PDF generation error:', err)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state">
          <div className="spinner" />
          <p className="text-muted">Loading analysis results...</p>
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="container">
        <div className="empty-state">
          <AlertTriangle size={64} />
          <h3>Analysis Not Found</h3>
          <p>{error || 'This analysis may have expired or does not exist.'}</p>
          <Link to="/upload" className="btn btn-primary">Upload New Image</Link>
        </div>
      </div>
    )
  }

  const signals = analysis.signal_breakdown || []
  const riskColor = RISK_COLORS[analysis.risk_tier] || RISK_COLORS.Low
  const guidance = GUIDANCE[analysis.risk_tier] || GUIDANCE.Low
  const circumference = 2 * Math.PI * 72
  const dashOffset = circumference - (analysis.mls_score / 100) * circumference

  return (
    <div className="container">
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/upload" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> Back to Upload
        </Link>
      </div>

      <div className="results-layout">
        {/* Sidebar */}
        <div className="results-sidebar">
          {/* Score Card */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="score-gauge">
              <div className="score-gauge-circle">
                <svg viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="72" className="bg-track" />
                  <circle 
                    cx="80" cy="80" r="72" 
                    className="progress-track"
                    style={{
                      stroke: riskColor,
                      strokeDasharray: circumference,
                      strokeDashoffset: dashOffset,
                    }}
                  />
                </svg>
                <div className="score-gauge-value">
                  <div className="score" style={{ color: riskColor }}>{analysis.mls_score}</div>
                  <div className="label">MLS Score</div>
                </div>
              </div>
              <span className={`risk-badge ${analysis.risk_tier.toLowerCase()}`}>
                {analysis.risk_tier} Risk
              </span>
            </div>
          </div>

          {/* Actions Card */}
          <div className="card">
            <h4 style={{ marginBottom: '1rem' }}>Actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={generatePDF} disabled={generating} style={{ width: '100%' }}>
                <Download size={16} />
                {generating ? 'Generating...' : 'Download Report (PDF)'}
              </button>
              <button className="btn btn-secondary" onClick={copyEvidence} style={{ width: '100%' }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Evidence'}
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>Details</h4>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <p><strong>Report ID:</strong> {analysis.id.slice(0, 8)}...</p>
              <p style={{ marginTop: '0.375rem' }}><strong>Analyzed:</strong> {new Date(analysis.created_at).toLocaleString()}</p>
              <p style={{ marginTop: '0.375rem' }}><strong>Image:</strong> {analysis.image_path?.split('/').pop() || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="results-main">
          {/* Disclaimer */}
          <div className="disclaimer-banner">
            <AlertTriangle size={16} />
            <span>
              <strong>AI Analysis Disclaimer:</strong> This is a probabilistic assessment, not legal proof. 
              Results should be verified by a forensic expert for legal proceedings.
            </span>
          </div>

          {/* Signal Breakdown */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Detection Signal Breakdown</h3>
              <p className="card-description">Detailed results for each analysis signal</p>
            </div>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Finding</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{signal.name}</td>
                    <td>
                      <span className="signal-status">
                        <span className={`dot ${signal.status}`} />
                        <span style={{ textTransform: 'capitalize' }}>{signal.status}</span>
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: signal.score >= 55 ? 'var(--risk-high)' : signal.score >= 35 ? 'var(--risk-moderate)' : 'var(--risk-low)' }}>
                      {signal.score}/100
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{signal.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Guidance */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ color: riskColor }}>{guidance.title}</h3>
              <p className="card-description">Recommended actions based on your risk assessment</p>
            </div>
            <div className="guidance-grid">
              {guidance.cards.map((card, i) => (
                <div key={i} className="guidance-card">
                  <div className={`icon-wrapper ${card.color}`}>
                    {card.color === 'red' ? <Phone size={20} /> :
                     card.color === 'amber' ? <AlertTriangle size={20} /> :
                     card.color === 'purple' ? <FileText size={20} /> :
                     <Shield size={20} />}
                  </div>
                  <h4>{card.title}</h4>
                  <p>{card.text}</p>
                  {card.link && (
                    <div className="links">
                      <a href={card.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} /> Visit Resource
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resources Link */}
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="text-muted" style={{ marginBottom: '0.75rem' }}>
              Need more help? Visit our comprehensive resource hub.
            </p>
            <Link to="/resources" className="btn btn-secondary">
              <Shield size={16} /> View All Resources
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
