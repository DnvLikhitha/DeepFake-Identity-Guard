import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload as UploadIcon, X, AlertTriangle, Shield, Loader, Image } from 'lucide-react'
import { uploadImage, createAnalysis, analyzeImage, getSignedUrl, updateAnalysis, incrementQuota } from '../lib/api'

const MAX_FILES = 3
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

export default function Upload({ user }) {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [showConsent, setShowConsent] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [error, setError] = useState('')

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      const reasons = rejectedFiles.map(r => {
        if (r.errors[0]?.code === 'file-too-large') return `${r.file.name} exceeds 5MB`
        if (r.errors[0]?.code === 'file-invalid-type') return `${r.file.name} is not a supported format`
        return r.errors[0]?.message
      })
      setError(reasons.join('. '))
      return
    }

    const remaining = MAX_FILES - files.length
    const newFiles = acceptedFiles.slice(0, remaining)
    
    if (acceptedFiles.length > remaining) {
      setError(`Maximum ${MAX_FILES} images per session. Added ${newFiles.length} of ${acceptedFiles.length}.`)
    } else {
      setError('')
    }

    const newPreviews = newFiles.map(f => ({
      file: f,
      url: URL.createObjectURL(f),
      name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB'
    }))

    setFiles(prev => [...prev, ...newFiles])
    setPreviews(prev => [...prev, ...newPreviews])
  }, [files])

  const removeFile = (index) => {
    URL.revokeObjectURL(previews[index].url)
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
    setError('')
  }

  const handleAnalyze = () => {
    setShowConsent(true)
  }

  const startAnalysis = async () => {
    setShowConsent(false)
    setAnalyzing(true)
    setProgress(0)
    setError('')

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // Step 1: Upload to Supabase Storage
        setProgressLabel(`Uploading image ${i + 1} of ${files.length}...`)
        setProgress(Math.round(((i * 3) / (files.length * 3)) * 100))
        
        const imagePath = await uploadImage(file, user.id)

        // Step 2: Create analysis record
        setProgressLabel(`Creating analysis record...`)
        setProgress(Math.round(((i * 3 + 1) / (files.length * 3)) * 100))
        
        const analysis = await createAnalysis(user.id, imagePath)

        // Step 3: Run analysis
        setProgressLabel(`Analyzing image ${i + 1} for manipulation signals...`)
        setProgress(Math.round(((i * 3 + 2) / (files.length * 3)) * 100))

        let imageUrl
        try {
          imageUrl = await getSignedUrl('uploaded-images', imagePath)
        } catch {
          imageUrl = null
        }

        const results = await analyzeImage(imageUrl, file)

        // Step 4: Save results
        await updateAnalysis(analysis.id, results)
        await incrementQuota(user.id, 'analyses_today')

        setProgress(100)
        setProgressLabel('Analysis complete!')

        // Navigate to results
        setTimeout(() => {
          navigate(`/results/${analysis.id}`)
        }, 800)
        return
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setError(`Analysis failed: ${err.message}. Please try again.`)
      setAnalyzing(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    maxFiles: MAX_FILES - files.length,
    disabled: analyzing || files.length >= MAX_FILES
  })

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem' }}>
          <span className="text-gradient">Analyze</span> Your Image
        </h1>
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>
          Upload up to {MAX_FILES} images (max 5MB each) for deepfake detection analysis
        </p>
      </div>

      {error && (
        <div className="disclaimer-banner" style={{ marginBottom: '1.5rem', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}>
          <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          <span>{error}</span>
        </div>
      )}

      {!analyzing ? (
        <>
          {files.length < MAX_FILES && (
            <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              <UploadIcon className="upload-icon" />
              <h3>
                {isDragActive ? 'Drop images here' : 'Drag & drop images here'}
              </h3>
              <p>or click to browse your files</p>
              <p className="formats">
                Supported: JPEG, PNG, WEBP — Max 5MB per file — Up to {MAX_FILES} images
              </p>
            </div>
          )}

          {previews.length > 0 && (
            <>
              <div className="image-preview-grid">
                {previews.map((preview, i) => (
                  <div key={i} className="image-preview-item">
                    <img src={preview.url} alt={preview.name} />
                    <button className="remove-btn" onClick={() => removeFile(i)}>
                      <X size={14} />
                    </button>
                    <div className="file-info">
                      {preview.name.length > 20 ? preview.name.slice(0, 17) + '...' : preview.name} • {preview.size}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={handleAnalyze}>
                  <Shield size={20} />
                  Analyze {files.length} Image{files.length > 1 ? 's' : ''}
                </button>
                <button className="btn btn-secondary btn-lg" onClick={() => {
                  previews.forEach(p => URL.revokeObjectURL(p.url))
                  setFiles([])
                  setPreviews([])
                }}>
                  Clear All
                </button>
              </div>
            </>
          )}

          <div className="disclaimer-banner" style={{ marginTop: '2rem' }}>
            <AlertTriangle size={16} />
            <span>
              Your images are encrypted in transit and stored in a private bucket. 
              They will be <strong>automatically deleted within 24 hours</strong>. 
              No image data is used for AI model training.
            </span>
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 1.5rem', animation: 'spin 1.5s linear infinite' }} />
          <h3 style={{ marginBottom: '1.5rem' }}>Analysis in Progress</h3>
          
          <div className="progress-container">
            <div className="progress-bar-wrapper">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-label">
              <span>{progressLabel}</span>
              <span>{progress}%</span>
            </div>
          </div>

          <p className="text-muted" style={{ marginTop: '1.5rem', fontSize: '0.875rem' }}>
            Running EXIF analysis, Error Level Analysis, and manipulation detection...
          </p>
        </div>
      )}

      {/* Consent Modal */}
      {showConsent && (
        <div className="modal-overlay" onClick={() => setShowConsent(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Privacy & Consent</h3>
            <p>
              Before we analyze your image, please acknowledge the following:
            </p>
            <div className="checkbox-group" style={{ marginTop: '1rem' }}>
              <input
                type="checkbox"
                id="analysis-consent"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <label htmlFor="analysis-consent">
                I consent to having my image analyzed by AI. I understand that:
                <br />• Results are <strong>probabilistic</strong>, not legal proof
                <br />• My image will be <strong>deleted within 24 hours</strong>
                <br />• The image is <strong>not used for model training</strong>
              </label>
            </div>
            <div className="actions">
              <button className="btn btn-secondary" onClick={() => setShowConsent(false)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={startAnalysis}
                disabled={!consentChecked}
                style={{ flex: 1 }}
              >
                <Shield size={16} />
                Start Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
