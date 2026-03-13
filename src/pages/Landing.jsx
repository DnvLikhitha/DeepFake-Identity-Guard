import { Link } from 'react-router-dom'
import { Shield, ScanSearch, FileText, HeartHandshake, Lock, Zap } from 'lucide-react'

const features = [
  {
    icon: ScanSearch,
    title: 'AI Deepfake Detection',
    description: 'Advanced analysis using Error Level Analysis, EXIF metadata inspection, and facial landmark checks to detect manipulated or AI-generated images.'
  },
  {
    icon: Shield,
    title: 'Reverse Image Search',
    description: 'Check if your image appears elsewhere online. Surface potential misuse across platforms with similarity scoring.'
  },
  {
    icon: FileText,
    title: 'Risk Report Generation',
    description: 'Get a detailed, downloadable PDF report with manipulation scores, signal breakdowns, and annotated findings.'
  },
  {
    icon: HeartHandshake,
    title: 'Victim Guidance Hub',
    description: 'Risk-specific action steps, helpline contacts, legal templates, and platform reporting guides—all in one place.'
  },
  {
    icon: Lock,
    title: 'Privacy-First Design',
    description: 'Images auto-deleted within 24 hours. End-to-end encryption. No training on your data. Ever.'
  },
  {
    icon: Zap,
    title: 'Instant Analysis',
    description: 'Results in under 60 seconds. No technical knowledge required. Upload, analyze, act.'
  }
]

const trustBadges = [
  { icon: Lock, label: 'Images deleted in 24h' },
  { icon: Shield, label: 'SOC 2 compliant infrastructure' },
  { icon: HeartHandshake, label: 'Trauma-informed UX' },
]

export default function Landing({ user }) {
  return (
    <div className="container">
      {/* Hero */}
      <section className="hero">
        <h1>
          Protect Your <span className="text-gradient">Digital Identity</span> From Deepfakes
        </h1>
        <p className="subtitle">
          AI-powered image analysis that helps you detect manipulated photos, 
          find unauthorized use of your likeness, and take action — all in one 
          private, free platform.
        </p>
        <div className="cta-group">
          <Link to={user ? '/upload' : '/signup'} className="btn btn-primary btn-lg">
            <ScanSearch size={20} />
            {user ? 'Analyze an Image' : 'Get Started Free'}
          </Link>
          <Link to="/resources" className="btn btn-secondary btn-lg">
            <BookOpen size={20} />
            Learn More
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="features-grid">
        {features.map((feature, i) => (
          <div key={i} className="feature-card animate-in" style={{ opacity: 0 }}>
            <div className="icon-box">
              <feature.icon size={24} />
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </section>

      {/* Trust Section */}
      <section className="trust-section">
        <h2>Built With <span className="text-gradient">Trust & Privacy</span></h2>
        <p className="text-muted" style={{ maxWidth: 600, margin: '0.75rem auto 0' }}>
          Your safety is our priority. DeepFake Identity Guard operates on zero-retention 
          principles with enterprise-grade encryption.
        </p>
        <div className="trust-badges">
          {trustBadges.map((badge, i) => (
            <div key={i} className="trust-badge">
              <badge.icon size={20} />
              <span>{badge.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function BookOpen(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
