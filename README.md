# ElevateCV 

> **AI-Powered Resume Intelligence & Job-Match Optimization Platform**

ElevateCV is an end-to-end career intelligence platform that bridges the gap between candidate resumes and modern Applicant Tracking Systems (ATS). By combining structured PDF parsing, Named Entity Recognition (NER), and multi-provider AI reasoning, ElevateCV analyzes resumes against target job descriptions, pinpoints critical skill and keyword gaps, and helps candidates iterate toward high-impact, tailored applications.

---

## 🚀 Key Capabilities

* **Intelligent Document Extraction:** High-fidelity PDF parsing and Named Entity Recognition (NER) to convert unstructured resumes into structured, queryable data.
* **Target Job Description Matching:** Real-time ATS readiness scoring across skills, experience alignment, responsibilities, keywords, education, and projects.
* **Professional Resume Analysis Report:** In-depth ATS readiness report with weighted scoring breakdowns, detected vs. missing skills, candidate strengths, actionable recommendations, and one-click PDF report export.
* **AI Cover Letter Generation:** First-class, grounded cover letter generation tailored to specific job descriptions with strict anti-hallucination guardrails (only referencing verified candidate facts).
* **Cover Letter Studio:** Rich in-browser cover letter editing, prompt-based regeneration, instant clipboard copy, and production-grade PDF and DOCX downloads.

---

## 🛠️ Tech Stack

* **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Radix UI, Framer Motion
* **Backend:** Node.js, Express, TypeScript, Zod, Vitest, pdfkit, docx
* **Database & Auth:** PostgreSQL (Supabase), Row-Level Security (RLS)
* **AI Runtime:** Multi-provider LLM orchestration (Groq, Anthropic, OpenAI) with strict schema validation and fallback handling

---

## 📁 Project Structure

```text
ReworkCV/
├── frontend/         # React 19 + Vite application
│   ├── src/
│   │   ├── features/ # Feature modules (resume, cover-letter, auth)
│   │   ├── components/ # Dashboard layout, UI components, landing sections
│   │   └── pages/    # Analysis, History, Cover Letters, Settings
│   └── package.json
├── backend/          # Express REST API
│   ├── src/
│   │   ├── ai/       # NER, JD parser, resume-job matcher, cover-letter generator
│   │   ├── modules/  # Resume, cover-letter, and profile modules
│   │   └── config/   # Environment and Supabase client configs
│   └── package.json
├── database/         # PostgreSQL migrations (including cover_letters & cleanup)
└── docs/             # Architecture and implementation notes
```

---

## 🚦 Getting Started

### 1. Configure Environment Variables

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Fill in your Supabase project credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and optional AI provider API keys (`GROQ_API_KEY`, etc.).

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Servers

```bash
# Run both frontend and backend concurrently
npm run dev

# Or run separately:
npm run dev:backend   # API server on http://localhost:4000
npm run dev:frontend  # Web client on http://localhost:3000
```

---

## 🧪 Quality & Verification Suite

```bash
# Run TypeScript compilation check
npm run typecheck

# Run ESLint across all workspaces
npm run lint

# Run Vitest test suites (Unit & Integration)
npm run test

# Run production build
npm run build
```
