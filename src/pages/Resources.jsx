import { ExternalLink, Shield, Phone, FileText, Globe, HeartHandshake, AlertTriangle, BookOpen } from 'lucide-react'

const resources = [
  {
    category: 'Emergency Contacts',
    color: 'red',
    icon: Phone,
    items: [
      { title: 'India Cyber Crime Helpline', description: 'Call 1930 for immediate assistance with cyber crime complaints.', link: 'tel:1930' },
      { title: 'National Cyber Crime Portal', description: 'File an online complaint for cyber crimes including image-based abuse.', link: 'https://cybercrime.gov.in' },
      { title: 'iCall Helpline', description: 'Free, confidential psychosocial support. Call 9152987821.', link: 'tel:9152987821' },
      { title: 'iDare Helpline', description: 'Free support for survivors of digital abuse. Call 1800-102-4040.', link: 'tel:18001024040' },
    ]
  },
  {
    category: 'Platform Reporting Guides',
    color: 'cyan',
    icon: Globe,
    items: [
      { title: 'Instagram', description: 'Report impersonation, non-consensual images, or fake accounts.', link: 'https://help.instagram.com/446663175382270' },
      { title: 'Facebook', description: 'Report non-consensual intimate images or impersonation.', link: 'https://www.facebook.com/help/1306725409382822' },
      { title: 'X (Twitter)', description: 'Report non-consensual nudity or manipulated media.', link: 'https://help.twitter.com/en/safety-and-security/non-consensual-nudity' },
      { title: 'WhatsApp', description: 'Report and block suspicious accounts sharing manipulated images.', link: 'https://faq.whatsapp.com/1142481766359498' },
      { title: 'Telegram', description: 'Report channels or users distributing fake/manipulated content.', link: 'https://telegram.org/faq#q-how-do-i-report-abuse' },
    ]
  },
  {
    category: 'Legal Resources',
    color: 'purple',
    icon: FileText,
    items: [
      { title: 'IT Act Sections 66E, 67, 67A', description: 'Relevant Indian law sections for image-based abuse and privacy violations.' },
      { title: 'DPDP Act 2023', description: 'India Digital Personal Data Protection Act — your rights regarding personal data.' },
      { title: 'Internet Freedom Foundation', description: 'Free legal support and resources for digital rights in India.', link: 'https://internetfreedom.in' },
    ]
  },
  {
    category: 'Support Organizations',
    color: 'green',
    icon: HeartHandshake,
    items: [
      { title: 'SHEROES', description: 'Digital safety guides and community support for women.', link: 'https://sheroes.com' },
      { title: 'Cyber Peace Foundation', description: 'Awareness programs and victim support for cyber crimes.', link: 'https://cyberpeace.org' },
      { title: 'Point of View', description: 'Research and advocacy on women\'s digital safety.', link: 'https://pointofview.org' },
    ]
  },
  {
    category: 'Digital Safety Tips',
    color: 'amber',
    icon: Shield,
    items: [
      { title: 'Set Up Image Alerts', description: 'Use Google Alerts with your name and TinEye to monitor for unauthorized use of your images.' },
      { title: 'Review Privacy Settings', description: 'Restrict photo downloads, limit profile visibility, and enable two-factor authentication on all platforms.' },
      { title: 'Document Evidence', description: 'If you find suspicious content: screenshot the page, note the URL, save timestamps. Do not delete anything.' },
      { title: 'Watermark Your Content', description: 'Add subtle watermarks to photos you share publicly. This helps prove ownership in disputes.' },
    ]
  },
]

export default function Resources() {
  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2rem' }}>
          <span className="text-gradient">Guidance</span> & Resources
        </h1>
        <p className="text-muted" style={{ marginTop: '0.5rem', maxWidth: 600, margin: '0.5rem auto 0' }}>
          Whether you need emergency help or want to improve your digital safety, 
          find actionable resources and contacts here.
        </p>
      </div>

      <div className="disclaimer-banner" style={{ marginBottom: '2rem' }}>
        <AlertTriangle size={16} />
        <span>
          <strong>India-focused resources.</strong> If you are in immediate danger, 
          call your local emergency services. For cyber crime, call <strong>1930</strong>.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {resources.map((section, i) => (
          <div key={i} className="card animate-in" style={{ opacity: 0 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div className={`icon-wrapper ${section.color}`} style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <section.icon size={20} />
              </div>
              <h3 className="card-title">{section.category}</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {section.items.map((item, j) => (
                <div key={j} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9375rem', marginBottom: '0.375rem' }}>{item.title}</h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.description}</p>
                  {item.link && (
                    <a 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', marginTop: '0.5rem' }}
                    >
                      <ExternalLink size={12} /> Visit
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
