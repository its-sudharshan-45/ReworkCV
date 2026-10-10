import { describe, it, expect } from 'vitest';
import {
  normalizeSpacing,
  resumeReportExportService,
  stripMarkdown,
} from './resume-report-export.service.js';
import { buildReportData, scanForForbiddenValues } from './resume-report-data.js';
import type { JobMatchAnalysis } from '../../ai/job/job-types.js';
import type { ResumeDetailResponse } from './resume.types.js';

function makeResume(): ResumeDetailResponse {
  return {
    id: 'resume-1',
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    fileSize: 1000,
    processingStatus: 'PROCESSED',
    score: 79,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractedText: 'Sample resume text with React and Node experience.',
    structuredData: {
      sections: [
        { key: 'summary', title: 'Summary', content: 'Backend engineer with 3 years experience.' },
        { key: 'experience', title: 'Experience', content: 'Built APIs with Node.js and improved latency 20%.' },
        { key: 'education', title: 'Education', content: 'BSc Computer Science' },
        { key: 'skills', title: 'Skills', content: 'React, Node.js' },
      ],
      skills: ['React', 'Node.js'],
    },
    analysisResult: null,
    failureReason: null,
  } as unknown as ResumeDetailResponse;
}

function makeAnalysis(): JobMatchAnalysis {
  return {
    matchScore: 79,
    category: 'Good Match',
    overview: 'Your TypeScript and backend work aligns with the stack.',
    breakdown: { skills: 85, experience: 70, responsibilities: 60, keywords: 75, education: 90, projects: 50 },
    matchedSkills: ['React', 'Node.js'],
    missingRequiredSkills: ['GraphQL'],
    missingPreferredSkills: ['Docker'],
    skillDetail: {
      matchedRequired: ['React', 'Node.js'],
      missingRequired: ['GraphQL'],
      matchedPreferred: [],
      missingPreferred: ['Docker'],
      scorePercent: 85,
    },
    experienceDetail: {
      requiredYears: 3,
      detectedProfessionalYears: 2,
      detectedInternshipMonths: 0,
      detectedProjectCount: 1,
      matchLevel: 'partial',
      scorePercent: 70,
      note: 'Partial experience match.',
    },
    educationDetail: { required: ['BSc'], detected: ['BSc CS'], matchLevel: 'strong', scorePercent: 90 },
    responsibilityDetail: { matched: ['Build APIs'], unmatched: ['On-call'], scorePercent: 60 },
    keywordDetail: { found: ['React', 'Node.js'], missing: ['GraphQL'], scorePercent: 75 },
    projectDetail: {
      relevantProjects: [{ name: 'API Platform', technologies: ['Node.js'], relevantTech: ['Node.js'], relevancePercent: 80 }],
      scorePercent: 50,
    },
    strengths: ['Strong backend API experience'],
    recommendations: [{ priority: 'high', text: 'Add GraphQL only if experienced', impact: '+4 points' }],
  };
}

describe('resume report PDF export', () => {
  it('generates a readable PDF buffer', async () => {
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), makeAnalysis(), 'Backend Engineer');
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('produces text-selectable content with exact scores', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    const analysis = makeAnalysis();
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), analysis);
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string; numpages: number }>)(buffer)) as {
      text: string;
      numpages: number;
    };
    expect(parsed.numpages).toBeGreaterThanOrEqual(1);
    expect(parsed.text).toContain('79/100');
    // Score rows render as aligned columns (label, score, weight, bar), so
    // each segment is asserted separately rather than as one string.
    expect(parsed.text).toContain('Skills');
    expect(parsed.text).toContain('85/100');
    expect(parsed.text).toContain('40% weight');
    expect(parsed.text).toContain('Experience');
    expect(parsed.text).toContain('70/100');
    expect(parsed.text).toContain('20% weight');
    expect(parsed.text).toContain('Backend Engineer'.slice(0, 7));
  });

  it('renders soft-skill sections without mislabeling technical skills', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    const analysis = makeAnalysis();
    analysis.skillDetail.matchedPreferred = ['Docker', 'AWS'];
    analysis.skillDetail.missingPreferred = ['TypeScript'];
    analysis.skillDetail.matchedSoft = ['Communication'];
    analysis.skillDetail.missingSoft = ['Leadership'];
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), analysis);
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer)) as { text: string };
    expect(parsed.text).toContain('Matched soft skills');
    expect(parsed.text).toContain('Missing soft skills');
    expect(parsed.text).toContain('Communication');
    expect(parsed.text).toContain('Leadership');
  });

  it('contains no forbidden values', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), makeAnalysis());
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer)) as { text: string };
    for (const token of ['undefined', '[object Object]', 'NaN', '&amp;']) {
      expect(parsed.text).not.toContain(token);
    }
    const report = buildReportData({ resume: makeResume(), analysis: makeAnalysis() });
    expect(scanForForbiddenValues(report)).toEqual([]);
  });

  it('renders without analysis (deterministic resume score only)', async () => {
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), null);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    const { default: pdfParse } = await import('pdf-parse');
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer)) as { text: string };
    expect(parsed.text).toContain('79/100');
  });

  it('numbers every page and keeps long reports readable across pages', async () => {
    const longText = Array.from({ length: 60 }, (_, i) => `Achievement ${i + 1} delivered measurable impact with React and Node.`).join(' ');
    const resume = makeResume();
    (resume as unknown as { extractedText: string }).extractedText = longText;
    const analysis = makeAnalysis();
    analysis.overview = `${longText} ${longText}`;
    analysis.recommendations = Array.from({ length: 12 }, (_, i) => ({
      priority: i < 4 ? 'high' : 'medium',
      text: `Recommendation ${i + 1}: strengthen section ${i + 1} with concrete evidence and outcomes.`,
      impact: `+${i + 1} points`,
    }));
    const buffer = await resumeReportExportService.generateReportPdf(resume, analysis, 'Backend Engineer');
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    const { default: pdfParse } = await import('pdf-parse');
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string; numpages: number }>)(buffer)) as {
      text: string;
      numpages: number;
    };
    expect(parsed.numpages).toBeGreaterThan(1);
    expect(parsed.text).toContain('Page 1 of');
    expect(parsed.text).toContain('79/100');
    expect(parsed.text).toContain('85/100');
    const sectionOrder = [
      'Overview',
      'Score Breakdown (deterministic)',
      'Content Analysis',
      'Skills Analysis',
      'Format Analysis',
      'Sections Analysis',
      'Style Analysis',
      'Action Plan',
    ];
    let lastIndex = -1;
    for (const heading of sectionOrder) {
      const index = parsed.text.indexOf(heading);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('renders arrow markers with plain-text glyphs', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), makeAnalysis());
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer)) as { text: string };
    expect(parsed.text).not.toMatch(/→/);
  });

  it('repairs spacing lost during resume text extraction', () => {
    expect(normalizeSpacing('with a Supabasebackend secured via row-level security.')).toContain(
      'Supabase backend secured',
    );
    expect(normalizeSpacing('OneDot CommunicationsDec 2025 - Jan 2026 Full Stack')).toContain(
      'Communications Dec 2025 - Jan 2026',
    );
    expect(normalizeSpacing('KPR Institute of Engineering, Coimbatore2024 - 2028')).toContain(
      'Coimbatore 2024 - 2028',
    );
    expect(normalizeSpacing('from 30 min to 8 min.•Implemented a pipeline')).toContain(
      '8 min. • Implemented a pipeline',
    );
    expect(normalizeSpacing('automating CI/CD pipelines andoptimizing front-end rendering')).toContain(
      'pipelines and optimizing front-end',
    );
    expect(normalizeSpacing('15 required skills aligned: javascript, react.... Add REST API')).toContain(
      'react... Add REST API',
    );
  });

  it('leaves real words and tech terms intact while repairing spacing', () => {
    expect(normalizeSpacing('Skilled in JavaScript, TypeScript, PostgreSQL and GitHub.')).toBe(
      'Skilled in JavaScript, TypeScript, PostgreSQL and GitHub.',
    );
    expect(normalizeSpacing('rebuilding the API was interesting work in the 2020s.')).toBe(
      'rebuilding the API was interesting work in the 2020s.',
    );
    expect(normalizeSpacing('Market share grew after the January intake.')).toBe(
      'Market share grew after the January intake.',
    );
    expect(normalizeSpacing('Worked with MongoDB, MySQL, NoSQL and GraphQL stores.')).toBe(
      'Worked with MongoDB, MySQL, NoSQL and GraphQL stores.',
    );
  });

  it('splits glued lowercase words between known vocabulary', () => {
    expect(normalizeSpacing('building end-to-end full-stack solutionsusing Java and Python')).toContain(
      'solutions using Java',
    );
    expect(normalizeSpacing('search, ensuringreliable AI-powered product discovery')).toContain(
      'ensuring reliable AI-powered',
    );
    expect(normalizeSpacing('Fetch API), enablingseamless real-time communication')).toContain(
      'enabling seamless real-time',
    );
    expect(normalizeSpacing('solutiondesign with userdatabase and datapipeline')).toContain(
      'solution design with user database and data pipeline',
    );
  });

  it('never splits real compounds, inflections, or everyday words', () => {
    const intact = [
      'notebook', 'background', 'understand', 'understanding', 'without', 'within', 'workaround',
      'framework', 'network', 'database', 'backend', 'frontend', 'codebase', 'website', 'online',
      'setup', 'startup', 'breakdown', 'input', 'output', 'throughput', 'overtime', 'runtime',
      'uptime', 'downtime', 'datetime', 'lifetime', 'sometime', 'sometimes', 'meantime', 'morning',
      'evening', 'yesterday', 'birthday', 'holiday', 'someday', 'doomsday', 'workday', 'sunday',
      'interesting', 'testing', 'building', 'rebuilding', 'monitoring', 'engineering', 'standard',
      'standards', 'standardize', 'random', 'demand', 'command', 'thousand', 'island', 'confusing',
      'amusing', 'reusing', 'accusing', 'protesting', 'contesting', 'retesting', 'attesting',
      'overused', 'underused', 'overusing', 'underusing', 'springtime', 'summertime', 'wintertime',
      'dinnertime', 'suppertime', 'evermore', 'nevermore', 'innermost', 'outermost', 'uppermost',
      'foremost', 'undermost', 'cumbersome', 'burdensome', 'tiresome', 'wholesome', 'handsome',
      'awesome', 'javascript', 'typescript', 'postgresql', 'mongodb', 'mysql', 'nosql', 'graphql',
      'fastapi', 'openai', 'github', 'linkedin', 'devops', 'containers', 'microservice', 'observer', 'metadata', 'bigdata', 'soundcloud', 'automobile', 'superuser', 'unittest',
      'vitest', 'webapp', 'unicode', 'deliver', 'recover', 'discover', 'bravery', 'slavery',
      'everyday', 'everyone', 'networking', 'marketing', 'something', 'nothing', 'anything',
      'everything', 'cannot', 'checkout', 'chicken', 'choice', 'choose', 'citizen', 'claim',
      'clean', 'clear', 'client', 'climate', 'clinic', 'clipboard', 'clock', 'closed', 'cloud',
      'cluster', 'coach', 'coast', 'coding', 'coffee', 'colleague', 'collect', 'college', 'color',
      'column', 'comfort', 'coming', 'comment', 'commerce', 'common', 'company', 'compare',
      'complete', 'complex', 'compound', 'compress', 'compute', 'concept', 'concern', 'concert',
      'conclude', 'concrete', 'condition', 'conduct', 'confirm', 'conflict', 'conform', 'connect',
      'conquer', 'conscious', 'consensus', 'consent', 'consequence', 'conserve', 'consider',
      'console', 'constant', 'construct', 'consult', 'consume', 'contact', 'contain', 'contend',
      'content', 'contest', 'context', 'continent', 'continue', 'contract', 'contrary',
      'contrast', 'contribute', 'control', 'convene', 'convenient', 'converge', 'converse',
      'convert', 'convey', 'convince', 'cooking', 'cooling', 'cooperate', 'coordinate', 'copper',
      'corner', 'corporate', 'correct', 'corrupt', 'costing', 'cottage', 'cotton', 'couch',
      'cough', 'council', 'counsel', 'count', 'counter', 'country', 'county', 'couple', 'coupon',
      'courage', 'course', 'court', 'cousin', 'covering', 'crackdown', 'cradle', 'creating',
      'cricket', 'crisis', 'crossing', 'custom', 'customer', 'cutting', 'dancing', 'daring',
      'dashboard', 'daughter', 'daydream', 'deadline', 'dealing', 'decoding', 'deficient',
      'degree', 'delicious', 'delivering', 'delivery', 'demand', 'dense', 'departing',
      'depending', 'deploying', 'depositing', 'derailing', 'deriving', 'descending',
      'describing', 'deserting', 'deserving', 'designing', 'desiring', 'destination',
      'detailing', 'detecting', 'detesting', 'deviating', 'diagnosing', 'dialing',
      'differing', 'digital', 'dining', 'directing', 'disabling', 'disappearing',
      'discerning', 'disclaimer', 'disclosing', 'discounting', 'discovering', 'discussing',
      'disgusting', 'disliking', 'dismantling', 'dismissing', 'disordering', 'dispatching',
      'dispensing', 'displaying', 'disposing', 'disputing', 'disrupting', 'dissenting',
      'dissolving', 'distancing', 'distilling', 'distinct', 'distorting', 'distracting',
      'distressing', 'distributing', 'disturbing', 'diverging', 'diverting', 'dividing',
      'divorcing', 'doctoring', 'documenting', 'doing', 'domain', 'donating', 'doubling',
      'doubting', 'downloading', 'drafting', 'dragging', 'draining', 'drawing', 'dreading',
      'dreaming', 'dressing', 'drifting', 'drilling', 'drinking', 'driving', 'dropping',
      'drowning', 'drying', 'ducking', 'during', 'dusting', 'duty', 'dwelling', 'dwindling',
      'dynamic', 'eager', 'earning', 'easing', 'eating', 'echoing', 'editing', 'educating',
      'effecting', 'efficient', 'eight', 'either', 'elaborating', 'elastic', 'elder',
      'electing', 'element', 'elevating', 'eligible', 'eliminating', 'emailing', 'emerging',
      'emitting', 'employing', 'empowering', 'emptying', 'emulating', 'enabling',
      'enacting', 'encasing', 'enchanting', 'enclosing', 'encoding', 'encountering',
      'encouraging', 'encrypting', 'ending', 'endorsing', 'enduring', 'energizing',
      'enforcing', 'engaging', 'engineering', 'engraving', 'enhancing', 'enjoying',
      'enlarging', 'enlightening', 'enlisting', 'enriching', 'enrolling', 'ensuring',
      'entering', 'entertaining', 'entire', 'entry', 'enumerating', 'enveloping',
      'envious', 'episode', 'equating', 'equipping', 'erasing', 'erecting', 'eroding',
      'erring', 'escalating', 'escaping', 'escorting', 'essential', 'establishing',
      'estate', 'esteem', 'estimating', 'etching', 'eternal', 'ethical', 'evening',
      'everyday', 'evicting', 'evoking', 'evolving', 'exacting', 'exaggerating',
      'examining', 'exceeding', 'excelling', 'exchanging', 'exciting', 'excluding',
      'excusing', 'executing', 'exercising', 'exerting', 'exhausting', 'exhibiting',
      'exiling', 'existing', 'exiting', 'expanding', 'expecting', 'expelling',
      'expending', 'experiencing', 'expert', 'expiring', 'explaining', 'exploding',
      'exploiting', 'exploring', 'exporting', 'exposing', 'expressing', 'extending',
      'external', 'extracting', 'extreme', 'eyeing', 'fabricating', 'facing',
      'factoring', 'fading', 'failing', 'fainting', 'falling', 'faltering',
      'familiar', 'fanning', 'farming', 'fascinating', 'fashioning', 'fastening',
      'fathering', 'faulting', 'favoring', 'fearing', 'feasting', 'featuring',
      'feeding', 'feeling', 'fencing', 'fending', 'fermenting', 'fetching',
      'feuding', 'fibbing', 'fielding', 'fighting', 'figuring', 'filing',
      'filling', 'filming', 'filtering', 'finalizing', 'financing', 'finding',
      'finishing', 'firing', 'firming', 'fishing', 'fitting', 'fixing',
      'flagging', 'flaking', 'flaming', 'flanking', 'flapping', 'flaring',
      'flashing', 'flattening', 'flattering', 'flaunting', 'flavoring', 'fleeing',
      'fleshing', 'flexing', 'flickering', 'flinching', 'flipping', 'flirting',
      'floating', 'flocking', 'flooding', 'flooring', 'flopping', 'floundering',
      'flourishing', 'flowing', 'flowering', 'fluent', 'fluid', 'flushing',
      'fluttering', 'flying', 'foaming', 'focusing', 'fogging', 'folding',
      'following', 'fooling', 'footing', 'foraging', 'forbidding', 'forcing',
      'forecasting', 'foreign', 'foreman', 'foremost', 'foreseeing', 'foresting',
      'forever', 'forging', 'forgetting', 'forgiving', 'forgoing', 'forking',
      'forming', 'formulating', 'forsaking', 'fortifying', 'forwarding',
      'fostering', 'fouling', 'founding', 'foxing', 'fracturing', 'framing',
      'freeing', 'freelancing', 'freezing', 'freighting', 'frequenting',
      'fretting', 'frightening', 'fronting', 'frosting', 'frowning', 'fruiting',
      'frustrating', 'frying', 'fueling', 'fulfilling', 'fumbling', 'fuming',
      'functioning', 'funding', 'funny', 'furious', 'furnishing', 'furthering',
      'fusing', 'gaining', 'galloping', 'gambling', 'gaming', 'gaping',
      'gardening', 'garnering', 'gasping', 'gathering', 'gauging', 'gazing',
      'gearing', 'generalizing', 'generating', 'getting', 'ghosting', 'gifting',
      'giggling', 'gilding', 'giving', 'glancing', 'glaring', 'gleaming',
      'gleaning', 'gliding', 'glimpsing', 'glittering', 'gloating', 'glowing',
      'gluing', 'gnawing', 'going', 'goofing', 'gossiping', 'governing',
      'grabbing', 'gracing', 'grading', 'graduating', 'granting', 'graphing',
      'grasping', 'grating', 'grazing', 'greeting', 'grieving', 'grilling',
      'grinding', 'grinning', 'gripping', 'groaning', 'grooming', 'groping',
      'grounding', 'grouping', 'growing', 'growling', 'grudging', 'grumbling',
      'grunting', 'guaranteeing', 'guarding', 'guessing', 'guiding', 'gulping',
      'gunning', 'gushing', 'gutting', 'habituating', 'hacking', 'haggling',
      'hailing', 'halting', 'halving', 'hammering', 'hampering', 'handing',
      'handling', 'hanging', 'happening', 'harassing', 'harboring', 'hardening',
      'harming', 'harmonizing', 'harnessing', 'harvesting', 'hashing',
      'hastening', 'hatching', 'hating', 'hauling', 'haunting', 'having',
      'hawking', 'heading', 'healing', 'heaping', 'hearing', 'heating',
      'heaving', 'heckling', 'hedging', 'heeding', 'helping', 'heralding',
      'herding', 'hesitating', 'hiding', 'highlighting', 'hiking', 'hindering',
      'hinging', 'hinting', 'hiring', 'hissing', 'hitching', 'hoarding',
      'holding', 'hollering', 'homing', 'honing', 'honoring', 'hooking',
      'hoping', 'hopping', 'hosing', 'hosting', 'hounding', 'housing',
      'hovering', 'howling', 'huddling', 'hugging', 'humanizing', 'humming',
      'hunting', 'hurdling', 'hurling', 'hurrying', 'hurting', 'hustling',
      'hydrating', 'hyping', 'idealizing', 'identifying', 'idling', 'igniting',
      'ignoring', 'illuminating', 'illustrating', 'imagining', 'imitating',
      'impacting', 'impairing', 'imparting', 'impeding', 'implanting',
      'implementing', 'implying', 'importing', 'imposing', 'impressing',
      'imprisoning', 'improving', 'improvising', 'incoming', 'incorporating',
      'increasing', 'indexing', 'indicating', 'inducing', 'indulging',
      'infecting', 'inferring', 'inquiring', 'inserting', 'insider',
      'insisting', 'inspecting', 'inspiring', 'installing', 'instant',
      'instigating', 'instilling', 'instructing', 'insulating', 'insulting',
      'insuring', 'integrating', 'intelligent', 'intending', 'intensifying',
      'interacting', 'intercepting', 'interesting', 'interfacing',
      'interfering', 'interlocking', 'interning', 'interpreting',
      'interrogating', 'interrupting', 'intersecting', 'interviewing',
      'intimidating', 'intoxicating', 'intriguing', 'introducing', 'intruding',
      'invading', 'inventing', 'inverting', 'investing', 'investigating',
      'inviting', 'invoking', 'involving', 'ironing', 'irrigating',
      'irritating', 'isolating', 'issuing', 'itemizing', 'iterating',
      'jailing', 'jamming', 'jarring', 'jeering', 'jeopardizing', 'jetting',
    ];
    for (const word of intact) {
      expect(normalizeSpacing(word), `must not split "${word}"`).toBe(word);
    }
  });

  it('splits all-caps acronyms glued to words without touching tech terms', () => {
    expect(normalizeSpacing('B. Tech - Artificial Intelligence and Data ScienceCGPA: 8.02')).toContain(
      'Science CGPA: 8.02',
    );
    expect(normalizeSpacing('Engineer who knowsAWS and CI/CD pipelines.')).toContain('knows AWS and');
    // eBay/iPhone style single-capitals and APIs plurals are never split.
    expect(normalizeSpacing('Sold on eBay; fixed the iPhone APIs quickly.')).toBe(
      'Sold on eBay; fixed the iPhone APIs quickly.',
    );
  });

  it('strips markdown markers from report text', () => {
    expect(stripMarkdown('We are looking for a motivated **Full Stack Developer** to build apps.')).toBe(
      'We are looking for a motivated Full Stack Developer to build apps.',
    );
    expect(stripMarkdown('using **Node.js**, Express.js, and/or FastAPI')).toBe(
      'using Node.js, Express.js, and/or FastAPI',
    );
    expect(stripMarkdown('See [React docs](https://react.dev) and `npm run build`.')).toBe(
      'See React docs and npm run build.',
    );
  });

  it('prints clean premium labels without raw markers or placeholders', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    const analysis = makeAnalysis();
    analysis.responsibilityDetail.matched = ['Build apps with **React** and Node.js'];
    analysis.projectDetail.relevantProjects = [
      { name: 'Unnamed Project', technologies: [], relevantTech: ['React'], relevancePercent: 33 },
    ];
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), analysis);
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer)) as { text: string };

    expect(parsed.text).not.toContain('**');
    expect(parsed.text).not.toContain('Unnamed Project');
    expect(parsed.text).toContain('Project 1');
    // One recommendation -> singular; never the "(s)" placeholder style.
    expect(parsed.text).toContain('1 improvement identified');
    expect(parsed.text).not.toContain('improvement(s)');
  });

  it('pluralizes the improvement count for multiple recommendations', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    const analysis = makeAnalysis();
    analysis.recommendations = [
      ...analysis.recommendations,
      { priority: 'medium', text: 'Add measurable outcomes to each role', impact: '+2 points' },
    ];
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), analysis);
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer)) as { text: string };

    expect(parsed.text).toContain('2 improvements identified');
  });

  it('renders a dense realistic report across pages with all data intact', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    const resume = makeResume();
    resume.structuredData = {
      sections: [
        {
          key: 'summary',
          title: 'Summary',
          content:
            'Results-driven AI & Data Science undergraduate with hands-on experience building end-to-end full-stack solutions using Java, Python, React, Node.js, and FastAPI.',
        },
        {
          key: 'experience',
          title: 'Experience',
          content:
            'Codec Technologies Pvt. Ltd. Nov 2025 - Dec 2025 Full Stack Developer Intern • Designed and contributed to a college marketplace platform using React, TypeScript, and FastAPI, with a Supabasebackend secured via row-level security. ' +
            'OneDot CommunicationsDec 2025 - Jan 2026 Full Stack Developer Intern - MERN • Engineered secure JWT/OAuth 2.0 authentication. ' +
            'B. Tech - Artificial Intelligence and Data ScienceCGPA: 8.02, KPR Institute of Engineering and Technology, Coimbatore2024 - 2028. ' +
            Array.from({ length: 8 }, (_, i) => `Achievement ${i + 1} shipped a production service with **React** and Node.js, cutting latency by 120ms.`).join(' '),
        },
        { key: 'education', title: 'Education', content: 'BSc Computer Science' },
        { key: 'skills', title: 'Skills', content: 'React, Node.js' },
      ],
      skills: ['React', 'Node.js'],
    } as unknown as ResumeDetailResponse['structuredData'];

    const analysis = makeAnalysis();
    const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix} Skill ${i + 1}`);
    analysis.skillDetail.matchedRequired = many('Matched', 18);
    analysis.skillDetail.missingRequired = ['REST API'];
    analysis.skillDetail.matchedPreferred = ['LangChain', 'LLM', 'RAG'];
    analysis.skillDetail.missingPreferred = ['AWS', 'CI/CD'];
    analysis.keywordDetail.found = many('Keyword', 30);
    analysis.keywordDetail.missing = ['REST API', 'AWS', 'Location', 'Chennai', 'Bengaluru'];
    analysis.responsibilityDetail.matched = [
      'Build apps with **React** and Node.js for cloud platforms.',
      ...Array.from({ length: 5 }, (_, i) => `Own lifecycle stage ${i + 1} from design through deployment and monitoring.`),
    ];
    analysis.responsibilityDetail.unmatched = Array.from({ length: 4 }, (_, i) => `Evidence gap ${i + 1}: on-call rotations and incident reviews.`);
    analysis.projectDetail.relevantProjects = [
      { name: 'Unnamed Project', technologies: [], relevantTech: ['TypeScript', 'React'], relevancePercent: 33 },
      { name: 'Unnamed Project', technologies: [], relevantTech: ['React'], relevancePercent: 24 },
      { name: 'TrustTrace', technologies: [], relevantTech: ['Next.js', 'TypeScript'], relevancePercent: 19 },
      { name: 'Unnamed Project', technologies: [], relevantTech: ['Node.js'], relevancePercent: 19 },
      { name: 'Unnamed Project', technologies: [], relevantTech: ['langchain'], relevancePercent: 5 },
    ];
    analysis.recommendations = Array.from({ length: 9 }, (_, i) => ({
      priority: i < 2 ? 'high' : 'medium',
      text: `Recommendation ${i + 1}: strengthen section ${i + 1} with concrete evidence and outcomes.`,
      impact: `+${i + 1} points`,
    }));

    const buffer = await resumeReportExportService.generateReportPdf(resume, analysis, 'Full Stack Developer');
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string; numpages: number }>)(buffer)) as {
      text: string;
      numpages: number;
    };

    // Multi-page with numbered footers on every page.
    expect(parsed.numpages).toBeGreaterThan(1);
    expect(parsed.text).toContain('Page 1 of');
    expect(parsed.text).toContain(`Page ${parsed.numpages} of ${parsed.numpages}`);

    // All eight sections render in order with exact deterministic scores.
    const sectionOrder = [
      'Overview',
      'Score Breakdown (deterministic)',
      'Content Analysis',
      'Skills Analysis',
      'Format Analysis',
      'Sections Analysis',
      'Style Analysis',
      'Action Plan',
    ];
    let lastIndex = -1;
    for (const heading of sectionOrder) {
      const index = parsed.text.indexOf(heading);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
    for (const token of ['79/100', '85/100', '70/100', '60/100', '75/100', '90/100', '50/100']) {
      expect(parsed.text).toContain(token);
    }

    // Extraction repairs + markdown stripping hold on dense real-world text.
    expect(parsed.text).toContain('Supabase backend secured');
    expect(parsed.text).toContain('Science CGPA: 8.02');
    expect(parsed.text).toContain('Coimbatore 2024 - 2028');
    expect(parsed.text).not.toContain('**');
    expect(parsed.text).not.toContain('Unnamed Project');
    for (const token of ['undefined', '[object Object]', 'NaN']) {
      expect(parsed.text).not.toContain(token);
    }
  });
});
