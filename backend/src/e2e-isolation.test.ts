import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Authenticated end-to-end + cross-user isolation suite.
//
// Full HTTP chain (routes -> controllers -> services -> REAL repositories)
// against an in-memory fake of the Supabase admin client. Repository
// ownership filters (.eq('user_id', ...)) execute for real, so these tests
// verify actual data isolation rather than mock behavior. Only true external
// boundaries are faked: Supabase Auth/DB/storage, the HF NER model, and LLM
// providers (deterministic engine runs unmodified).
//
// What this covers (API-verified): signup-equivalent sessions via tokens,
// upload -> process -> analyze -> report, scan-history persistence,
// coach context + conversation binding, cover-letter identity, PDF exports,
// cross-user IDOR probes, score determinism.
// What remains pending: real-browser flows (Supabase signup/login UI,
// session refresh, CSS rendering) — no browser automation is available in
// this environment.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const db: Record<string, Row[]> = {};

function resetDb(): void {
  for (const key of Object.keys(db)) delete db[key];
  db.resumes = [];
  db.resume_job_analysis = [];
  db.cover_letters = [];
  db.ai_coach_conversations = [];
  db.ai_coach_messages = [];
  db.knowledge_chunks = [];
  db.knowledge_documents = [];
}

resetDb();

const now = (): string => new Date().toISOString();

function withDefaults(table: string, row: Row): Row {
  const out: Row = { ...row };
  if (out.id === undefined) out.id = randomUUID();
  if (out.created_at === undefined) out.created_at = now();
  if (out.updated_at === undefined) out.updated_at = now();
  if (table === 'resumes') {
    for (const k of ['extracted_text', 'structured_data', 'analysis_result', 'score', 'failure_reason']) {
      if (out[k] === undefined) out[k] = null;
    }
  }
  return out;
}

class FakeQuery {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Array<(r: Row) => boolean> = [];
  private orderings: Array<{ col: string; asc: boolean }> = [];
  private limitN: number | null = null;
  private insertRows: Row[] = [];
  private updatePatch: Row = {};
  private singleMode: 'single' | 'maybeSingle' | null = null;

  constructor(private readonly table: string) {}

  select(_cols?: string, _opts?: unknown): this {
    return this;
  }

  insert(rows: Row | Row[]): this {
    this.op = 'insert';
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: Row): this {
    this.op = 'update';
    this.updatePatch = patch;
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  eq(col: string, value: unknown): this {
    this.filters.push((r) => r[col] === value);
    return this;
  }

  in(col: string, values: unknown[]): this {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }

  or(_expr: string): this {
    // Only used by knowledge listing (role.eq.X,role.is.null). The E2E KB is
    // empty, but keep the chain honest: no-op filter (matches everything).
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderings.push({ col, asc: opts?.ascending !== false });
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  single(): this {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle(): this {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private filtered(): Row[] {
    const table = db[this.table];
    if (!table) throw new Error(`fake-supabase: unknown table ${this.table}`);
    let rows = table.filter((r) => this.filters.every((f) => f(r)));
    for (const { col, asc } of this.orderings) {
      rows = [...rows].sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return (av < bv ? -1 : 1) * (asc ? 1 : -1);
      });
    }
    if (this.limitN !== null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  private execute(): { data: unknown; error: { message: string; code?: string } | null } {
    if (this.op === 'insert') {
      const rows = this.insertRows.map((r) => withDefaults(this.table, r));
      db[this.table].push(...rows);
      return this.finish(rows);
    }
    if (this.op === 'update') {
      const rows = this.filtered();
      for (const r of rows) Object.assign(r, this.updatePatch, { updated_at: now() });
      return this.finish(rows);
    }
    if (this.op === 'delete') {
      const rows = this.filtered();
      db[this.table] = db[this.table].filter((r) => !rows.includes(r));
      return { data: [], error: null };
    }
    return this.finish(this.filtered());
  }

  private finish(rows: Row[]): { data: unknown; error: { message: string; code?: string } | null } {
    if (this.singleMode === 'single') {
      if (rows.length === 0) return { data: null, error: { message: 'No rows', code: 'PGRST116' } };
      if (rows.length > 1) return { data: null, error: { message: 'Multiple rows', code: 'PGRST118' } };
      return { data: rows[0], error: null };
    }
    if (this.singleMode === 'maybeSingle') {
      if (rows.length > 1) return { data: null, error: { message: 'Multiple rows', code: 'PGRST118' } };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }>(
    onFulfilled?: ((v: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
  ): Promise<TResult1> {
    return Promise.resolve().then(() => this.execute() as { data: unknown; error: unknown }).then(onFulfilled as never);
  }
}

const storageBlobs = new Map<string, Buffer>();

const fakeAdmin = {
  auth: {
    getUser: async (token: string) => {
      if (token === 'token-a') return { data: { user: { id: USER_A, email: 'alice@test.dev' } }, error: null };
      if (token === 'token-b') return { data: { user: { id: USER_B, email: 'bob@test.dev' } }, error: null };
      return { data: { user: null }, error: { message: 'invalid token' } };
    },
  },
  from: (table: string) => new FakeQuery(table),
  storage: {
    from: (_bucket: string) => ({
      upload: async (path: string, buffer: Buffer, opts?: { upsert?: boolean }) => {
        if (!opts?.upsert && storageBlobs.has(path)) {
          return { data: null, error: { message: 'duplicate' } };
        }
        storageBlobs.set(path, Buffer.from(buffer));
        return { data: { path }, error: null };
      },
      download: async (path: string) => {
        const buf = storageBlobs.get(path);
        if (!buf) return { data: null, error: { message: 'not found' } };
        return { data: new Blob([buf]), error: null };
      },
      remove: async (paths: string[]) => {
        for (const p of paths) storageBlobs.delete(p);
        return { data: [], error: null };
      },
    }),
  },
};

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

vi.mock('./config/supabase.js', () => ({
  getSupabaseAdmin: () => fakeAdmin,
  createSupabaseClient: vi.fn(),
}));

vi.mock('./ai/resume/resume-ner.js', () => ({
  extractRawEntities: vi.fn(async () => []),
}));

vi.mock('./modules/rag/ai-insights.service.js', () => ({
  aiInsightsService: { generateInsights: vi.fn(async () => null) },
}));

vi.mock('./ai/cover-letter/cover-letter-generator.js', () => ({
  generateCoverLetterText: vi.fn(async (opts: {
    candidateName?: string;
    candidateEmail?: string;
    jobTitle?: string;
    companyName?: string;
    userFeedback?: string;
  }) => {
    const name = opts.candidateName ?? 'Candidate';
    const email = opts.candidateEmail ?? '';
    if (opts.userFeedback) {
      return `Dear Hiring Manager,\n\nRewritten per request (${opts.userFeedback}) for ${name}.\n\nSincerely,\n${name}\n${email}`;
    }
    return `Dear Hiring Manager,\n\nI, ${name} (${email}), apply for ${opts.jobTitle ?? 'the role'}${opts.companyName ? ` at ${opts.companyName}` : ''}.\n\nSincerely,\n${name}\n${email}`;
  }),
}));

vi.mock('./ai/ai.service.js', () => ({
  aiService: {
    complete: vi.fn(async () => ({
      content: 'Quantify your bullets with metrics and mirror the job keywords.',
      provider: 'test',
      model: 'test',
    })),
  },
}));

import { createApp } from './app.js';

const ALICE_RESUME = [
  'Alicia Anderson',
  'alicia.anderson@example.com | +1-555-0100 | linkedin.com/in/alicia-anderson',
  '',
  'Summary',
  'Frontend engineer with 4 years building React and TypeScript applications.',
  '',
  'Skills',
  'TypeScript, React, Node.js, HTML, CSS, Git',
  '',
  'Experience',
  'Frontend Engineer at BrightApps (2021-2025): Built customer dashboards with React and TypeScript. Improved load time by 30%.',
  '',
  'Education',
  'BSc Computer Science, State University',
  '',
].join('\n');

const BOB_RESUME = [
  'Brian Baker',
  'brian.baker@example.com | +1-555-0200',
  '',
  'Summary',
  'Backend engineer with 5 years building Python APIs.',
  '',
  'Skills',
  'Python, Django, PostgreSQL, Docker',
  '',
  'Experience',
  'Backend Engineer at DataWorks (2020-2025): Built REST APIs with Python and Django.',
  '',
].join('\n');

const FRONTEND_JD = [
  'We are hiring a Frontend Engineer with 3+ years of professional experience.',
  'Requirements: strong TypeScript and React skills, experience with Node.js,',
  'HTML and CSS fundamentals, Git workflows, and a track record of improving',
  'application performance. You will build customer-facing dashboards.',
].join(' ');

const BACKEND_JD = 'We are hiring a Backend Engineer. Requirements: Python, Django, PostgreSQL, Docker, and 4+ years of API development experience.';

function authA() {
  return { Authorization: 'Bearer token-a' };
}
function authB() {
  return { Authorization: 'Bearer token-b' };
}

describe('Authenticated end-to-end workflow + cross-user isolation', () => {
  const app = createApp();
  let resumeA = '';
  let analysisA1 = '';
  let analysisA2 = '';
  let scoreA1 = -1;
  let resumeB = '';
  let analysisB = '';
  let conversationA = '';
  let coverA = '';

  beforeAll(() => {
    resetDb();
    storageBlobs.clear();
  });

  it(
    'user A completes upload -> process -> analyze -> report',
    async () => {
      const upload = await request(app)
        .post('/api/v1/resumes')
        .set(authA())
        .attach('file', Buffer.from(ALICE_RESUME, 'utf8'), {
          filename: 'alicia-resume.txt',
          contentType: 'text/plain',
        });
      expect(upload.status).toBe(201);
      resumeA = upload.body.resume.id;
      expect(resumeA).toBeTruthy();

      const process = await request(app).post(`/api/v1/resumes/${resumeA}/process`).set(authA());
      expect(process.status).toBe(200);
      expect(process.body.resume.processingStatus).toBe('PROCESSED');

      const analyze = await request(app)
        .post(`/api/v1/resumes/${resumeA}/analyze-job`)
        .set(authA())
        .send({ jobTitle: 'Frontend Engineer', jobDescription: FRONTEND_JD });
      expect(analyze.status).toBe(200);
      expect(analyze.body.success).toBe(true);
      expect(typeof analyze.body.data.matchScore).toBe('number');
      analysisA1 = analyze.body.analysisId;
      scoreA1 = analyze.body.data.matchScore;

      // Re-analysis of the same JD is deterministic: identical score.
      const reanalyze = await request(app)
        .post(`/api/v1/resumes/${resumeA}/analyze-job`)
        .set(authA())
        .send({ jobTitle: 'Frontend Engineer', jobDescription: FRONTEND_JD });
      expect(reanalyze.status).toBe(200);
      expect(reanalyze.body.data.matchScore).toBe(scoreA1);
      expect(reanalyze.body.analysisId).not.toBe(analysisA1);
      analysisA2 = reanalyze.body.analysisId;

      // Report renders the exact persisted analysis (no latest-confusion).
      const report = await request(app)
        .get(`/api/v1/resumes/${resumeA}/job-analyses/${analysisA1}`)
        .set(authA());
      expect(report.status).toBe(200);
      expect(report.body.analysis.analysisId).toBe(analysisA1);
      expect(report.body.analysis.data.matchScore).toBe(scoreA1);
      expect(report.body.analysis.jobTitle).toBe('Frontend Engineer');

      // Latest resolves to the second analysis; history lists both.
      const latest = await request(app)
        .get(`/api/v1/resumes/${resumeA}/job-analyses/latest`)
        .set(authA());
      expect(latest.status).toBe(200);
      expect(latest.body.analysis.analysisId).toBe(analysisA2);

      const history = await request(app).get(`/api/v1/resumes/${resumeA}/job-analyses`).set(authA());
      expect(history.status).toBe(200);
      expect(history.body.analyses).toHaveLength(2);

      const scanList = await request(app).get('/api/v1/resumes').set(authA());
      expect(scanList.status).toBe(200);
      expect(scanList.body.resumes.map((r: { id: string }) => r.id)).toContain(resumeA);
    },
    25_000,
  );

  it(
    'user A chats with the coach with correct, isolated context',
    async () => {
      const first = await request(app)
        .post('/api/v1/ai-coach/chat')
        .set(authA())
        .send({ resumeId: resumeA, analysisId: analysisA1, message: 'What skills am I missing for this job?' });
      expect(first.status).toBe(200);
      expect(first.body.message).toContain('Quantify your bullets');
      expect(first.body.conversationId).toBeTruthy();
      conversationA = first.body.conversationId;

      // Follow-up stays in the same conversation.
      const followUp = await request(app)
        .post('/api/v1/ai-coach/chat')
        .set(authA())
        .send({
          resumeId: resumeA,
          analysisId: analysisA1,
          message: 'How can I improve my ATS match?',
          conversationId: conversationA,
        });
      expect(followUp.status).toBe(200);
      expect(followUp.body.conversationId).toBe(conversationA);

      // A conversation is bound to its analysis: reusing it for another
      // analysis is rejected (report isolation).
      const cross = await request(app)
        .post('/api/v1/ai-coach/chat')
        .set(authA())
        .send({
          resumeId: resumeA,
          analysisId: analysisA2,
          message: 'Hello?',
          conversationId: conversationA,
        });
      expect(cross.status).toBe(404);
    },
    25_000,
  );

  it(
    'user A generates a cover letter with exact resume identity and job context',
    async () => {
      const gen = await request(app)
        .post('/api/v1/cover-letters')
        .set(authA())
        .send({
          resumeId: resumeA,
          jobAnalysisId: analysisA1,
          jobTitle: 'Frontend Engineer',
          companyName: 'BrightApps',
        });
      expect(gen.status).toBe(201);
      coverA = gen.body.coverLetter.id;
      // Exact identity from the resume: name + email, job-specific context.
      expect(gen.body.coverLetter.content).toContain('Alicia Anderson');
      expect(gen.body.coverLetter.content).toContain('alicia.anderson@example.com');
      expect(gen.body.coverLetter.content).toContain('Frontend Engineer');
      expect(gen.body.coverLetter.content).toContain('BrightApps');
      expect(gen.body.coverLetter.content).not.toContain('Brian Baker');

      const rewrite = await request(app)
        .post(`/api/v1/cover-letters/${coverA}/rewrite`)
        .set(authA())
        .send({ feedback: 'Make the opening shorter' });
      expect(rewrite.status).toBe(200);
      expect(rewrite.body.coverLetter.content).toContain('Make the opening shorter');
      expect(rewrite.body.coverLetter.content).toContain('Alicia Anderson');

      const exportRes = await request(app)
        .get(`/api/v1/cover-letters/${coverA}/export/pdf`)
        .set(authA());
      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['content-type']).toBe('application/pdf');
      expect(Number(exportRes.headers['content-length'])).toBeGreaterThan(500);

      const reportPdf = await request(app)
        .get(`/api/v1/resumes/${resumeA}/report/pdf?analysisId=${analysisA1}`)
        .set(authA());
      expect(reportPdf.status).toBe(200);
      expect(reportPdf.headers['content-type']).toBe('application/pdf');
      expect(Number(reportPdf.headers['content-length'])).toBeGreaterThan(1000);
    },
    25_000,
  );

  it(
    'user B has fully separate data and cannot access user A records',
    async () => {
      const uploadB = await request(app)
        .post('/api/v1/resumes')
        .set(authB())
        .attach('file', Buffer.from(BOB_RESUME, 'utf8'), {
          filename: 'bob-resume.txt',
          contentType: 'text/plain',
        });
      expect(uploadB.status).toBe(201);
      resumeB = uploadB.body.resume.id;

      await request(app).post(`/api/v1/resumes/${resumeB}/process`).set(authB()).expect(200);
      const analyzeB = await request(app)
        .post(`/api/v1/resumes/${resumeB}/analyze-job`)
        .set(authB())
        .send({ jobTitle: 'Backend Engineer', jobDescription: BACKEND_JD });
      expect(analyzeB.status).toBe(200);
      analysisB = analyzeB.body.analysisId;

      // Scan history is per-user: no cross-contamination either direction.
      const listA = await request(app).get('/api/v1/resumes').set(authA());
      expect(listA.body.resumes.map((r: { id: string }) => r.id)).toEqual([resumeA]);
      const listB = await request(app).get('/api/v1/resumes').set(authB());
      expect(listB.body.resumes.map((r: { id: string }) => r.id)).toEqual([resumeB]);

      // Direct object-reference probes: every one must 404 (never 200/403-leak).
      await request(app).get(`/api/v1/resumes/${resumeA}`).set(authB()).expect(404);
      await request(app)
        .get(`/api/v1/resumes/${resumeA}/job-analyses/${analysisA1}`)
        .set(authB())
        .expect(404);
      await request(app).get(`/api/v1/resumes/${resumeA}/job-analyses`).set(authB()).expect(404);
      await request(app)
        .get(`/api/v1/resumes/${resumeA}/job-analyses/latest`)
        .set(authB())
        .expect(404);
      await request(app).get(`/api/v1/cover-letters/${coverA}`).set(authB()).expect(404);
      await request(app)
        .post('/api/v1/ai-coach/chat')
        .set(authB())
        .send({ resumeId: resumeA, analysisId: analysisA1, message: 'Hi' })
        .expect(404);
      await request(app)
        .post('/api/v1/ai-coach/chat')
        .set(authB())
        .send({
          resumeId: resumeB,
          analysisId: analysisB,
          message: 'Hi',
          conversationId: conversationA,
        })
        .expect(404);
      await request(app)
        .get(`/api/v1/resumes/${resumeA}/report/pdf?analysisId=${analysisA1}`)
        .set(authB())
        .expect(404);
      await request(app).get(`/api/v1/cover-letters/${coverA}/export/pdf`).set(authB()).expect(404);

      // And symmetrically: A cannot read B's records.
      await request(app).get(`/api/v1/resumes/${resumeB}`).set(authA()).expect(404);
      await request(app)
        .get(`/api/v1/resumes/${resumeB}/job-analyses/${analysisB}`)
        .set(authA())
        .expect(404);

      // Unauthenticated requests stay 401 across resource types.
      await request(app).get(`/api/v1/resumes/${resumeA}`).expect(401);
      await request(app).get(`/api/v1/cover-letters/${coverA}`).expect(401);
      await request(app)
        .post('/api/v1/ai-coach/chat')
        .send({ resumeId: resumeA, analysisId: analysisA1, message: 'Hi' })
        .expect(401);
    },
    25_000,
  );
});
