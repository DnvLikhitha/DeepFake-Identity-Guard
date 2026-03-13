# Product Requirements Document (PRD)
## DeepFake Identity Guard

---

**Document Version:** 1.1  
**Status:** Draft  
**Date:** March 13, 2026  
**Product Owner:** TBD  
**Target Release:** MVP – Q3 2026  
**Changelog:** v1.1 — Auth replaced with Supabase Auth; storage replaced with Supabase Storage; all infrastructure constrained to free-tier services only.

---

## 1. Executive Summary

DeepFake Identity Guard is a web-based tool designed to help individuals — particularly women vulnerable to image-based abuse — detect whether images of them have been manipulated, synthetically generated, or misused online. The platform provides AI-powered deepfake detection, reverse-image similarity scanning, a downloadable manipulation risk report, and actionable guidance for victims of identity misuse.

The MVP is built entirely on **free-tier services** to minimize operational cost, making it viable for NGO deployment or early-stage development without cloud billing risk.

---

## 2. Problem Statement

Generative AI has dramatically lowered the barrier for creating convincing fake imagery. Bad actors now use synthetic or manipulated images for:

- Non-consensual intimate imagery (NCII) and image-based sexual abuse
- Defamation and reputational harm
- Identity fraud and impersonation
- Targeted online harassment campaigns

Existing tools are either too technical for general users, siloed within law enforcement, or unavailable to individuals at the moment they need help. There is a critical gap for an accessible, privacy-respecting, consumer-facing tool that empowers potential victims to investigate and act.

---

## 3. Goals & Success Metrics

### 3.1 Goals

- Provide accessible deepfake/manipulation detection for non-technical users
- Surface reverse-image search results to identify potential misuse
- Generate a clear, human-readable risk report per image
- Equip users with concrete next steps if misuse is detected
- Operate entirely within free-tier infrastructure limits for MVP

### 3.2 Success Metrics

| Metric | Target (6 months post-launch) |
|---|---|
| Monthly active users | 10,000+ |
| Detection accuracy (vs. benchmark datasets) | ≥ 85% |
| Average time-to-report generation | < 60 seconds |
| User satisfaction (CSAT) | ≥ 4.2 / 5 |
| False positive rate | < 10% |
| Resource click-through rate (guidance section) | ≥ 30% |
| Monthly infra cost (MVP phase) | $0 (free tier) |

---

## 4. Target Users

### Primary User
**Individuals concerned about identity misuse** — particularly women, public figures, journalists, activists, and minors' guardians who suspect their image has been used without consent.

### Secondary Users
- **NGOs and digital rights organizations** supporting abuse survivors
- **Legal professionals** needing preliminary evidence of manipulation
- **Journalists and researchers** investigating synthetic media

### User Personas

**Persona 1 – Aarti, 26, Software Professional**
Aarti discovered a social media profile using photos that look like her but are subtly altered. She isn't sure if they're edited versions of her real photos or AI-generated. She wants a quick, private way to check and get evidence she can take to the platform or police.

**Persona 2 – Meena, 34, Activist**
Meena has received threats and suspects fabricated images of her are being circulated. She needs a tool that can scan an image, tell her how likely it is to be fake, and guide her on reporting channels.

---

## 5. Scope

### 5.1 In Scope (MVP)

- Image upload and preprocessing interface
- AI-based deepfake/manipulation detection engine
- Reverse-image similarity check
- Manipulation likelihood report (PDF/on-screen)
- Victim guidance and resource section
- Optional user accounts via Supabase Auth (email/password + magic link)
- Temporary image storage via Supabase Storage with auto-expiry policy

### 5.2 Out of Scope (MVP)

- Video deepfake detection
- Real-time monitoring or alerts
- Direct platform reporting integrations (e.g., auto-report to Instagram)
- Mobile native apps (iOS/Android)
- Multi-language support (Phase 2)
- Paid tier or subscription billing (Phase 2)

---

## 6. Feature Requirements

---

### Feature 1: Image Upload & Analysis Interface

**Priority:** P0 — Must Have

**Description:**  
Users upload one or more images for analysis through a clean, accessible web interface. The system preprocesses the image and queues it for analysis. Uploaded files are stored temporarily in **Supabase Storage** within a private bucket.

**Functional Requirements:**

- Support image formats: JPEG, PNG, WEBP, HEIC (max **5 MB per file** — aligned with Supabase free tier limits)
- Allow up to **3 images per session** (free tier constraint; Supabase free tier offers 1 GB total storage)
- Display a progress indicator during upload and analysis
- Allow users to optionally crop/mask the image before submission (for privacy)
- Clearly communicate that images are deleted from Supabase Storage within 24 hours

**Non-Functional Requirements:**

- Image upload must complete within 5 seconds on a standard broadband connection
- All uploads transmitted over TLS (Supabase enforces HTTPS by default)
- Images stored in a **private Supabase Storage bucket**; access via signed URLs only (expiry: 1 hour)
- Supabase Storage auto-delete: implement via a **Supabase Edge Function** (cron job) that deletes objects older than 24 hours — free tier supports up to 500,000 Edge Function invocations/month

---

### Feature 2: Deepfake & Manipulation Detection Engine

**Priority:** P0 — Must Have

**Description:**  
The core AI pipeline analyzes uploaded images for indicators of synthetic generation or manipulation.

**Detection Signals:**

| Signal | Method |
|---|---|
| GAN/diffusion model artifacts | CNN-based classifier trained on deepfake datasets (FaceForensics++, DFDC) |
| Facial inconsistencies | Landmark geometry checks (eye spacing, skin texture, hair boundary) |
| EXIF metadata anomalies | Parse and flag missing or altered EXIF data |
| Compression artifact patterns | Splicing detection via noise analysis (ELA – Error Level Analysis) |
| Lighting & shadow inconsistencies | Gradient analysis across facial regions |
| Blending boundary detection | Segmentation-based edge analysis |

**Functional Requirements:**

- Output a composite Manipulation Likelihood Score (MLS) from 0–100
- Classify result into one of four tiers: Low Risk / Moderate / High / Critical
- Highlight specific regions of concern on the image with an overlay heatmap
- Provide per-signal breakdown (e.g., "EXIF metadata missing — moderate concern")
- Analysis results written to **Supabase Postgres** (free tier: 500 MB database)

**Model Requirements:**

- Base model: Fine-tuned EfficientNet-B4 or equivalent, hosted on **Hugging Face Inference API (free tier)** — free tier allows ~30,000 characters/month input; suitable for low-volume MVP
- Fallback: Rule-based heuristic checks (ELA + EXIF) if Hugging Face rate limit is hit
- Model inference time: < 15 seconds per image

**Free-Tier ML Hosting Options (in priority order):**

| Option | Free Tier | Constraint |
|---|---|---|
| Hugging Face Inference API | Yes — Spaces + free serverless | Rate limited; cold starts |
| Google Colab (backend tunnel) | Yes | Not production-grade; dev/demo only |
| Replicate.com | $0 credit on signup | Usage-based after credit exhausted |
| Render.com (free web service) | 750 hrs/month free | Spins down after 15 min inactivity |

**Recommended for MVP:** Deploy FastAPI inference server on **Render.com free tier** (spun up on request); model weights loaded from Hugging Face Hub on cold start.

---

### Feature 3: Reverse-Image Similarity Check

**Priority:** P1 — Should Have

**Description:**  
The system checks whether the uploaded image (or visually similar images) appears elsewhere on the internet, helping users identify if their likeness has been distributed.

**Functional Requirements:**

- Integrate with **SerpAPI free tier** (100 searches/month free) or **Google Programmable Search Engine** (100 queries/day free via Custom Search JSON API)
- Return a list of matched URLs with thumbnail previews and similarity scores
- Flag results appearing on known adult content platforms, paste sites, or harassment forums
- Allow users to click through to matched pages (with a safety warning overlay)
- If no matches found, clearly communicate this as a partial result (not a guarantee of safety)

**Free-Tier API Options:**

| API | Free Quota | Notes |
|---|---|---|
| Google Custom Search JSON API | 100 queries/day | Reverse image search via image URL; requires public image URL (use Supabase signed URL) |
| SerpAPI | 100 searches/month | Supports Google Lens reverse image; most accurate |
| Bing Visual Search API | 1,000 transactions/month (free tier) | Good fallback option |

**Recommended for MVP:** Google Custom Search JSON API (100 queries/day) as primary; Bing Visual Search as fallback. Rate limits enforced per user session via Supabase Postgres counter.

**Privacy Requirements:**

- Image must be accessible via a temporary Supabase signed URL (1-hour expiry) for reverse-image API submission; raw pixel data not transmitted
- Users must explicitly opt in to the reverse-image check with a clear disclosure

---

### Feature 4: Manipulation Risk Report

**Priority:** P0 — Must Have

**Description:**  
A structured, human-readable report summarizing the analysis results, suitable for personal records, legal use, or submission to platforms.

**Report Contents:**

1. **Summary Header** — Date, image filename, overall risk tier
2. **Manipulation Likelihood Score** — Score (0–100) with plain-language interpretation
3. **Detection Signal Breakdown** — Table of signals checked and individual findings
4. **Annotated Image** — Original image with heatmap overlay (if manipulation detected)
5. **Reverse Image Matches** — Count and top URLs (if opt-in selected)
6. **Analysis Disclaimer** — Statement that this is an AI tool and results are probabilistic
7. **Next Steps Section** — Linked to Feature 5

**Functional Requirements:**

- Report generated as **PDF client-side using jsPDF** (no server cost) or server-side via **WeasyPrint on Render.com**
- Report metadata (Report ID, MLS score, timestamps) stored in **Supabase Postgres**
- Shareable via unique link: report PDF stored as a **Supabase Storage object** in a private bucket; shared via signed URL expiring in **7 days**
- Supabase free tier storage limit: 1 GB total — enforce max 50 reports stored per day; older reports purged via Edge Function cron

---

### Feature 5: Guidance & Resource Hub

**Priority:** P1 — Should Have

**Description:**  
A contextual guidance section that surfaces relevant action steps based on the risk level of the detected image.

**Content by Risk Tier:**

| Risk Tier | Guidance Surfaced |
|---|---|
| Low | General digital safety tips; how to set up image alerts |
| Moderate | How to report to social platforms; document preservation checklist |
| High | Step-by-step reporting guide (platform + cyber crime); links to legal aid |
| Critical | Immediate escalation: helpline contacts, emergency cyber crime reporting, legal templates |

**Resources to Include (India-focused MVP):**

- National Cyber Crime Reporting Portal (cybercrime.gov.in)
- iCall / iDare helplines
- Internet Freedom Foundation resources
- SHEROES / SEWA digital safety guides
- Platform-specific reporting guides (Instagram, Facebook, WhatsApp, Telegram, X)

**Functional Requirements:**

- Guidance cards rendered contextually on the results page
- "Copy Evidence" button — pre-formats report ID, image hash, and timestamp for use in complaints
- Option to email the guidance + report link to themselves via **Supabase Auth email** (magic link / SMTP uses Supabase's built-in free email, capped at 3 emails/hour on free tier; sufficient for MVP)

---

## 7. User Flow

```
[Landing Page]
      |
      v
[Sign Up / Log In — Supabase Auth]
(Email + Password OR Magic Link — free tier)
      |
      v
[Upload Image(s)] --> [Optional: Crop / Mask for Privacy]
      |
      v
[Consent & Privacy Acknowledgment]
      |
      v
[Image saved to Supabase Storage — private bucket, signed URL]
      |
      v
[Analysis in Progress — Progress Bar]
      |
      +---> [FastAPI on Render.com — Deepfake Detection Engine]
      +---> [Reverse Image Check via Google CSE / Bing (if opted in)]
      |
      v
[Results written to Supabase Postgres]
      |
      v
[Results Dashboard]
      |
      +---> [Manipulation Likelihood Score + Heatmap]
      +---> [Signal Breakdown Table]
      +---> [Reverse Image Matches]
      +---> [Risk-Based Guidance Cards]
      |
      v
[Download Report (PDF) / Share via Supabase Signed URL — 7-day expiry]
      |
      v
[Supabase Edge Function: purge images & expired reports after 24h / 7d]
```

---

## 8. Technical Architecture

### 8.1 High-Level Stack — Free Tier Only

| Layer | Technology | Free Tier Plan | Key Limits |
|---|---|---|---|
| **Frontend** | React.js + TailwindCSS | Vercel (Hobby) | 100 GB bandwidth/month |
| **Backend API** | Python (FastAPI) | Render.com (Free Web Service) | 750 hrs/month; sleeps after 15 min inactivity |
| **Auth** | **Supabase Auth** | Supabase Free | 50,000 MAUs; email/password, magic link, OAuth |
| **Database** | **Supabase Postgres** | Supabase Free | 500 MB; unlimited API requests |
| **File Storage** | **Supabase Storage** | Supabase Free | 1 GB storage; 2 GB egress/month |
| **Serverless Jobs** | **Supabase Edge Functions** | Supabase Free | 500,000 invocations/month; used for cron cleanup |
| **ML Inference** | Hugging Face Spaces / Render.com | HF Free / Render Free | Cold start ~30s; rate limited |
| **Reverse Image** | Google Custom Search JSON API | Google Free Tier | 100 queries/day |
| **Reverse Image Fallback** | Bing Visual Search API | Microsoft Azure Free | 1,000 transactions/month |
| **Report PDF** | jsPDF (client-side) | N/A (JS library) | No server cost |
| **Email (transactional)** | Supabase Auth built-in SMTP | Supabase Free | 3 emails/hour |

### 8.2 Supabase Architecture Detail

#### Auth
- **Providers enabled:** Email/Password, Magic Link
- **OAuth (Phase 2):** Google, GitHub
- **Row Level Security (RLS):** Enabled on all tables — users can only read/write their own records
- **Session management:** JWT tokens managed by Supabase client SDK; 1-hour access token expiry, 7-day refresh token

#### Database Schema (Supabase Postgres)

```sql
-- Users table (managed by Supabase Auth; extended via profiles)
create table profiles (
  id uuid references auth.users primary key,
  created_at timestamptz default now(),
  display_name text,
  consent_given boolean default false
);

-- Analysis jobs
create table analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  created_at timestamptz default now(),
  image_path text,           -- Supabase Storage object path
  mls_score integer,         -- 0-100 Manipulation Likelihood Score
  risk_tier text,            -- Low / Moderate / High / Critical
  signal_breakdown jsonb,    -- per-signal results
  reverse_image_results jsonb,
  report_path text,          -- Supabase Storage path to PDF
  report_expires_at timestamptz,
  purged boolean default false
);

-- Rate limiting tracker
create table session_quotas (
  user_id uuid references profiles(id) primary key,
  analyses_today integer default 0,
  reverse_searches_today integer default 0,
  last_reset date default current_date
);
```

#### Storage Buckets

| Bucket Name | Access | Contents | Auto-Delete Policy |
|---|---|---|---|
| `uploaded-images` | Private | Raw uploaded images | 24 hours (via Edge Function cron) |
| `analysis-reports` | Private | Generated PDF reports | 7 days (via Edge Function cron) |

**Signed URL policy:** All files accessed via `supabase.storage.from('bucket').createSignedUrl(path, expiresIn)` — never publicly accessible.

#### Edge Functions (Cron Jobs)

| Function | Schedule | Purpose |
|---|---|---|
| `purge-images` | Every hour | Delete `uploaded-images` objects older than 24h |
| `purge-reports` | Every 6 hours | Delete `analysis-reports` objects past expiry |
| `reset-quotas` | Daily at midnight | Reset `session_quotas` counters |

### 8.3 Free Tier Constraints & Mitigations

| Constraint | Limit | Mitigation |
|---|---|---|
| Supabase Storage | 1 GB total | Max file size 5 MB; 3 uploads/session; aggressive 24h purge |
| Supabase DB | 500 MB | Store only metadata (not raw image bytes) in Postgres; use JSONB compression |
| Render.com cold starts | ~30 sec sleep | Show "warming up" spinner; keep-alive ping from frontend every 10 min |
| Google CSE | 100 queries/day | Rate limit to 1 reverse-image search per user per day; Bing as fallback |
| Supabase email | 3 emails/hour | Queue email sends; use client-side PDF download as primary delivery |
| Supabase MAU | 50,000/month | Sufficient for MVP phase; upgrade plan when approaching limit |

### 8.4 Data Flow & Privacy

- Images are encrypted in transit (HTTPS enforced by Supabase and Vercel) and at rest (AES-256 via Supabase Storage)
- No image is retained beyond 24 hours — enforced by Edge Function cron and auditable via Supabase dashboard
- Registered users may view their analysis history for up to 30 days (metadata only; image files purged at 24h)
- No image data is used for model training without explicit user consent
- GDPR and India DPDP Act 2023 compliance required at launch; Supabase is SOC 2 Type II certified

---

## 9. Privacy & Ethical Requirements

These are non-negotiable and must be validated before launch.

- **No silent data retention.** Free-tier images purged after 24 hours via auditable Supabase Edge Function. Deletion logs stored in Supabase Postgres.
- **No training on user data** without explicit opt-in. A separate consent toggle required.
- **Transparency in limitations.** Every result page and report must include a plain-language disclaimer that this is probabilistic AI analysis, not legal proof.
- **Accessibility.** WCAG 2.1 AA compliance. Screen reader support for all result states.
- **Avoiding re-traumatization.** UX copy must be trauma-informed. Avoid clinical or accusatory language. All guidance copy reviewed by a digital safety NGO partner before launch.
- **Misuse prevention.** Supabase RLS ensures users cannot access other users' data. Rate limiting via `session_quotas` table. Anonymous uploads not permitted — account required to prevent bulk abuse.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| High false positive rate causes unnecessary distress | Medium | High | Conservative MLS thresholds; strong disclaimer UX; user feedback loop |
| Users uploading third-party images without consent | High | High | ToS enforcement; hash-based NCII flagging (PhotoDNA integration — Phase 2) |
| Render.com cold start delays degrading UX | High | Medium | Show "warming up" state; keep-alive pings; document expected latency |
| Supabase free tier storage exhaustion | Medium | High | Aggressive purge Edge Functions; hard cap on uploads per day |
| Google CSE quota exhaustion (100/day) | High | Medium | Bing Visual Search fallback; per-user daily quota enforced in DB |
| Adversarial evasion of detection model | Medium | Medium | Ensemble approach; quarterly model updates; do not expose model confidence internals |
| Legal liability for report misuse | Low | High | Clear disclaimer on every report; legal review of report language |
| Supabase MAU limit (50,000) hit at scale | Low (MVP) | Medium | Monitor in Supabase dashboard; upgrade plan trigger at 40,000 MAU |

---

## 11. Milestones & Timeline

| Milestone | Target Date |
|---|---|
| PRD sign-off (v1.1) | Week 1 |
| Supabase project setup (Auth, DB schema, Storage buckets, RLS policies) | Week 2 |
| Design mockups (UI/UX) | Week 3 |
| ML model selection & benchmarking (Hugging Face / Render.com) | Week 4 |
| Backend API + image pipeline on Render.com (alpha) | Week 7 |
| Supabase Edge Functions: purge crons + quota reset | Week 8 |
| Frontend integration on Vercel with Supabase Auth (alpha) | Week 9 |
| Reverse image check integration (Google CSE + Bing fallback) | Week 10 |
| Report generation module (jsPDF client-side) | Week 11 |
| Internal QA + bias/fairness audit | Week 12–13 |
| NGO partner review (UX + guidance copy) | Week 14 |
| Closed beta (50 users) | Week 15 |
| Free-tier stress test & quota monitoring | Week 16 |
| MVP public launch | Week 18 |

---

## 12. Open Questions

1. Should we partner with an existing deepfake detection research lab (e.g., MIT Media Lab, AI4Trust) for model licensing or validation?
2. What is the legal framework for storing even temporary image data under India's DPDP Act 2023? Does a 24-hour Supabase retention qualify as "transient processing"?
3. Should the reverse-image search feature be opt-in per session or default-on with opt-out?
4. Is there budget for a dedicated trust & safety moderator role at launch?
5. Should anonymous usage be allowed (no Supabase account), or account required for all uploads?
6. At what MAU threshold should we upgrade from Supabase Free to Supabase Pro ($25/month)?
7. Can we integrate Supabase Realtime to push live analysis progress updates to the frontend instead of polling?

---

## 13. Appendix

### A. Supabase Free Tier Limits — Quick Reference

| Feature | Free Tier Limit |
|---|---|
| Database size | 500 MB |
| Storage | 1 GB |
| Storage egress | 2 GB / month |
| Auth — Monthly Active Users | 50,000 |
| Auth — Email sends | 3 / hour |
| Edge Functions — Invocations | 500,000 / month |
| Edge Functions — Execution time | 50ms CPU / invocation |
| Realtime — Concurrent connections | 200 |
| Projects | 2 active projects |
| Postgres backups | Daily (7-day retention) |

### B. Benchmark Datasets for Model Evaluation
- FaceForensics++ (FF++)
- Deepfake Detection Challenge (DFDC) dataset
- CelebDF-v2
- NIST MFC (Media Forensics Challenge) dataset

### C. Relevant Regulations
- India IT Act 2000 (Section 66E, 67, 67A)
- India Digital Personal Data Protection (DPDP) Act 2023
- EU AI Act (High-Risk AI System classification)
- GDPR (if EU users are served)
- Supabase Data Processing Agreement (DPA) — available for GDPR compliance

### D. Competitive Landscape

| Tool | Focus | Limitation |
|---|---|---|
| Microsoft Video Authenticator | Video/image | Enterprise, not consumer-facing |
| Deepware Scanner | Video | No image support, no guidance |
| Sensity AI | Enterprise fraud | Not accessible to individuals |
| FotoForensics | Manual ELA analysis | Requires technical knowledge |
| **DeepFake Identity Guard** | **Consumer, victim-focused, free-tier infra** | **MVP scope & free-tier quota limits** |

### E. Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-side only

# Reverse Image APIs
GOOGLE_CSE_API_KEY=<key>
GOOGLE_CSE_CX=<search-engine-id>
BING_VISUAL_SEARCH_API_KEY=<key>

# ML Inference
HUGGINGFACE_API_TOKEN=<token>
RENDER_INFERENCE_URL=https://<app>.onrender.com
```

---

*This document is a living artifact. All sections subject to revision following stakeholder review.*  
*v1.1 — Supabase Auth & Storage adopted; all infrastructure constrained to free-tier services.*
