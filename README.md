#  TriageAI — Smart Clinic Triage Assistant

**HSIL 2026 Hackathon Prototype** | Harvard Health Systems Innovation Lab

> A multimodal AI triage interface designed for South African primary healthcare clinics. This prototype demonstrates how AI-assisted pre-screening can reduce waiting times, identify care gaps, and support nurses in high-volume clinic settings.

![Cape Triage Score](https://img.shields.io/badge/Triage_System-Cape_Triage_Score-blue)
![Status](https://img.shields.io/badge/Status-Prototype-orange)
![License](https://img.shields.io/badge/License-MIT-green)

---

##  The Problem

South African primary healthcare (PHC) clinics face critical bottlenecks that compromise patient care:

| Challenge | Impact |
|-----------|--------|
| **83%** of patients face long waiting times | Patients leave without being seen (LAMA) |
| Nurses lose **23 working days/year** to paperwork | Less time for clinical care |
| **80%** of clinicians lose time to incomplete patient data | Delayed diagnosis, repeated assessments |
| Single nurse performs triage for entire clinic | Critical cases not identified fast enough |

In facilities like Khayelitsha Site B CHC or Mitchells Plain CDC, a single professional nurse may triage 60+ patients per day. The current paper-based process is slow, inconsistent, and misses opportunities for proactive care.

##  The Solution

**TriageAI** is a tablet/phone-based triage assistant that runs at clinic intake. It:

1. **Collects symptoms** via voice or text in the patient's language
2. **Asks smart follow-up questions** based on detected symptom patterns
3. **Flags care gaps** proactively (e.g., "You mentioned a cough lasting 3 weeks — have you been tested for TB?")
4. **Generates a clinical summary** with Cape Triage Score classification for the nurse

The key innovation is the **agentic care gap detection** — the system doesn't just triage, it identifies missed care opportunities during the conversation, turning a routine intake into a screening event.

## 🔬 How It Works

### User Flow

```
Welcome Screen → Symptom Input → Follow-up Questions → Clinical Summary
(Language)       (Voice/Text)    (Contextual Q&A)      (Nurse View)
```

### Cape Triage Score Classification

The prototype implements the [South African Triage Scale (SATS)](https://emssa.org.za/sats/), the standard triage system used across SA public healthcare:

| Color | Level | Target Time | Example Triggers |
|-------|-------|-------------|-----------------|
|  Red | Emergency | Immediate | Chest pain + breathing difficulty, altered consciousness |
|  Orange | Very Urgent | 10 minutes | Severe pain, high fever with confusion |
|  Yellow | Urgent | 60 minutes | TB risk symptoms, persistent cough >2 weeks |
|  Green | Routine | 240 minutes | Mild symptoms, follow-up visits |

### Care Gap Detection

The system screens for:

- **TB Risk**: Cough ≥2 weeks + weight loss/night sweats/fever → GeneXpert referral
- **HIV Testing**: Symptom patterns suggesting undiagnosed HIV → HCT offer
- **Medication Adherence**: Chronic conditions detected → adherence check
- **Follow-up Gaps**: Missed clinic visits → scheduling prompt

## 🛠️ Technical Implementation

### Architecture

```
index.html              # Single-page app with 4 screen sections
├── css/styles.css      # Mobile-first, high-contrast design
└── js/
    ├── triage-engine.js  # Keyword-based symptom analysis + CTS scoring
    ├── care-gaps.js      # Rule-based care gap detection
    ├── conversation.js   # Chat flow + Web Speech API integration
    ├── summary.js        # Nurse-facing summary generation
    └── app.js            # Screen navigation + UI orchestration
```

### Key Technical Decisions

- **Zero dependencies**: Vanilla HTML/CSS/JS for instant loading on constrained networks
- **Mobile-first CSS**: 375px base, large touch targets (48px+), high contrast
- **Web Speech API**: Optional voice input with South African English locale (`en-ZA`)
- **Keyword matching**: Simple but effective symptom detection (production would use LLM)
- **State machine**: Conversation flow managed through phases (initial → followup → gaps → complete)

### What's Implemented 

- [x] Language selection (English, isiXhosa, isiZulu, Afrikaans)
- [x] Simulated voice input with microphone UI and recording animation
- [x] Keyword-based symptom extraction (20+ symptom patterns)
- [x] Duration and severity detection from natural language
- [x] Cape Triage Score calculation (Red/Orange/Yellow/Green)
- [x] Care gap detection (TB, HIV, chronic meds, follow-up visits)
- [x] Contextual follow-up questions with smart screening
- [x] Nurse-facing clinical summary with actionable recommendations
- [x] Mobile-responsive design optimised for clinic tablet use
- [x] Privacy notice and clinical disclaimer

### Future Vision 

For the full hackathon build, this prototype would expand to:

- [ ] **LLM-powered conversation**: Replace keyword matching with GPT-4/Claude for natural clinical dialogue
- [ ] **Multilingual ASR**: Whisper fine-tuned on SA languages (isiXhosa, isiZulu, Afrikaans, Sesotho)
- [ ] **FHIR integration**: Connect to clinic EMR systems for patient history lookup
- [ ] **TIER.Net/ETR.Net**: Pull TB and HIV treatment data for informed gap detection
- [ ] **Offline-first PWA**: Service worker for areas with intermittent connectivity
- [ ] **Clinical validation**: Partner with SA emergency medicine specialists for CTS accuracy
- [ ] **NDoH alignment**: Map to National Department of Health Ideal Clinic standards
- [ ] **Analytics dashboard**: Clinic-level triage patterns, wait time reduction metrics

##  Running Locally

```bash
# Clone the repository
git clone https://github.com/ZHarvett/Harvard-HSIL-2026-Global-Hackathon-triage-ai-prototype-.git

# Open in browser (no build step needed)
cd triage-ai-prototype
open index.html

# Or use any static server
npx serve .
# or
python3 -m http.server 8000
```

**Demo tip**: Double-tap the TriageAI logo on the welcome screen to auto-fill a TB screening scenario.

##  South African Context

This prototype is designed with deep awareness of the SA PHC landscape:

- **Cape Triage Score**: The actual triage standard used in SA public facilities
- **TB burden**: SA has ~300,000 new TB cases annually; early PHC detection is critical
- **HIV prevalence**: ~13% national prevalence; routine testing in high-burden areas
- **Language diversity**: 11 official languages; multilingual support is essential
- **Infrastructure reality**: Designed for older devices, slow networks, bright clinic lighting
- **Nurse-led care**: SA PHC is primarily nurse-driven; the tool augments, not replaces

##  HSIL 2026 Relevance

This prototype directly addresses HSIL 2026's focus areas:

| HSIL Theme | How TriageAI Addresses It |
|------------|--------------------------|
| AI-native solutions | Agentic care gap detection during triage conversation |
| Health systems in low-resource settings | Designed for SA PHC clinics with infrastructure constraints |
| Intelligent Support Chatbots | Multimodal symptom assessment with contextual follow-ups |
| Shortage of Healthcare Workers | Reduces nurse triage burden; pre-screens before consultation |
| Diagnosis & Monitoring | TB/HIV screening integration; chronic disease adherence checks |

## Ethical Considerations

- **No real patient data** is collected or stored in this prototype
- **Clinical disclaimer** is prominently displayed — this is a screening aid, not a diagnostic tool
- **Final triage** must always be confirmed by a qualified healthcare worker
- **Privacy by design** — production version would comply with POPIA (SA data protection law)
- **Equity focus** — multilingual support and low-bandwidth design ensure accessibility

##  License

MIT License — Built for the HSIL 2026 Hackathon application.

---

<p align="center">
  <strong>Built with 🇿🇦 for South African communities</strong><br>
  <em>HSIL 2026 — Harvard Health Systems Innovation Lab</em>
</p>
