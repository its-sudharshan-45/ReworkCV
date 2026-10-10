/**
 * Job Description Parser
 *
 * Extracts structured JobRequirements from a raw job description string
 * using regex heuristics. No LLM call — fast, free, offline.
 */

import type { JobRequirements } from './job-types.js';
import { extractSoftSkillsFromText } from './soft-skills.js';

// cspell:ignore kubeflow mlops

// ---------------------------------------------------------------------------
// Canonical tech skill keywords used for extraction
// ---------------------------------------------------------------------------
export const KNOWN_TECH_SKILLS: string[] = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Golang', 'Rust', 'C++', 'C#',
  'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Dart', 'R', 'MATLAB',
  // Frontend
  'React', 'ReactJS', 'Vue', 'VueJS', 'Angular', 'AngularJS', 'Svelte', 'Next.js',
  'Nuxt', 'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'SASS', 'SCSS', 'Webpack', 'Vite',
  // Backend
  'Node.js', 'NodeJS', 'Express', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot',
  'Rails', 'Laravel', 'ASP.NET', '.NET', 'GraphQL', 'REST API', 'gRPC',
  // Databases
  'PostgreSQL', 'Postgres', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DynamoDB',
  'Cassandra', 'Elasticsearch', 'Supabase', 'Firebase', 'Prisma', 'TypeORM', 'Sequelize',
  // DevOps / Cloud
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform', 'Ansible', 'Jenkins',
  'GitHub Actions', 'CI/CD', 'Linux', 'Nginx', 'Apache', 'Vercel', 'Render', 'Heroku',
  // AI / ML
  'TensorFlow', 'PyTorch', 'scikit-learn', 'OpenCV', 'LangChain', 'LLM',
  'Machine Learning', 'Deep Learning', 'NLP', 'RAG', 'Hugging Face',
  // Tools
  'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence', 'Figma',
  'Postman', 'Swagger', 'OpenAPI', 'WebSockets', 'RabbitMQ', 'Kafka', 'Celery',
];

// ATS stopwords — words in JD that are NOT skills
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'each', 'more', 'most',
  'other', 'some', 'such', 'no', 'not', 'only', 'same', 'than', 'too',
  'very', 'just', 'because', 'as', 'until', 'while', 'although', 'this',
  'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'you', 'we', 'our', 'your', 'their', 'its', 'it', 'he', 'she', 'they',
  'who', 'which', 'what', 'how', 'when', 'where', 'why', 'all', 'any',
  'both', 'few', 'if', 'then', 'so', 'yet', 'also', 'well',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split JD into logical lines, stripping bullets, markdown, colons, and extra whitespace */
function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-*●▪▶→#]+/, '').replace(/[:\-#*]+$/, '').trim())
    .filter((l) => l.length > 0);
}

/** Find the index of the first line matching a heading pattern */
function findSectionStart(lines: string[], patterns: RegExp[]): number {
  return lines.findIndex((l) => patterns.some((p) => p.test(l)));
}

/** Extract lines belonging to a section (until next heading) */
function extractSection(lines: string[], startIdx: number): string[] {
  if (startIdx < 0) return [];
  const result: string[] = [];
  // Skip the heading line itself
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at a new heading (short ALL-CAPS or Title Case 2-5 word line)
    if (/^[A-Z][A-Z\s&/]{3,40}$/.test(line) || /^#+\s/.test(line)) break;
    if (line.length > 0) result.push(line);
  }
  return result;
}

/** Extract years from experience requirement strings */
function parseYearsFromLine(line: string): number | null {
  const m = line.match(/(?:(\d+)\s*[-to]+\s*\d+|(\d+))\s*\+?\s*(?:years?|yrs?\.?)/i);
  return m ? parseInt(m[1] || m[2], 10) : null;
}

/** Extract skills mentioned in a block of text from KNOWN_TECH_SKILLS */
function extractSkillsFromText(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  for (const skill of KNOWN_TECH_SKILLS) {
    const pattern = new RegExp(
      `(?<![a-z])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`,
      'i',
    );
    if (pattern.test(lower)) {
      found.add(skill);
    }
  }

  return Array.from(found);
}

/** Extract ATS keywords from a block of text (noun-like tokens not in stopwords) */
function extractKeywords(text: string, knownSkills: string[]): string[] {
  // Start with known tech skills found in text
  const keywords = new Set<string>(knownSkills);

  // Also add noun-like capitalized phrases (2-3 words) from the JD
  const phrasePattern = /\b([A-Z][a-zA-Z]{2,}(?:\s[A-Z][a-zA-Z]{2,}){0,2})\b/g;
  let match: RegExpExecArray | null;

  while ((match = phrasePattern.exec(text)) !== null) {
    const phrase = match[1].trim();
    const words = phrase.toLowerCase().split(/\s+/);
    if (words.every((w) => !STOPWORDS.has(w)) && phrase.length >= 3) {
      keywords.add(phrase);
    }
  }

  return Array.from(keywords).slice(0, 40); // cap at 40 keywords
}

// ---------------------------------------------------------------------------
// Heading patterns for section detection
// ---------------------------------------------------------------------------
const REQUIRED_HEADINGS = [
  /^required\s+(skills?|qualifications?|experience)/i,
  /^must\s+have/i,
  /^essential\s+(skills?|requirements?)/i,
  /^minimum\s+(qualifications?|requirements?)/i,
  /^technical\s+(skills?|requirements?)/i,
  /^skills?\s+(required|needed)/i,
  /^what\s+you('ll)?\s+(need|bring)/i,
  /^core\s+(skills?|competencies)/i,
  /^key\s+(skills?|requirements?|qualifications?)/i,
];

const PREFERRED_HEADINGS = [
  /^preferred\s+(skills?|qualifications?)/i,
  /^nice\s+to\s+have/i,
  /^bonus\s+(skills?|points?|qualifications?)/i,
  /^optional\s+(skills?|qualifications?)/i,
  /^good\s+to\s+have/i,
  /^additional\s+(skills?|qualifications?)/i,
  /^plus\s+(skills?|points?)/i,
];

const EXPERIENCE_HEADINGS = [
  /^(work\s+)?experience$/i,
  /^required\s+experience/i,
  /^years?\s+of\s+experience/i,
];

const EDUCATION_HEADINGS = [
  /^education(al)?\s*(requirements?|qualifications?|background)?$/i,
  /^degree\s+(requirements?)?/i,
  /^academic\s+(requirements?|background)?/i,
];

const RESPONSIBILITY_HEADINGS = [
  /^(key\s+)?responsibilities?$/i,
  /^(key\s+)?duties$/i,
  /^what\s+you('ll)?\s+(do|be\s+doing)/i,
  /^role\s+(overview|summary|description)?$/i,
  /^the\s+role$/i,
  /^job\s+description$/i,
  /^about\s+the\s+role$/i,
  /^you\s+will$/i,
];

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw job description string into structured JobRequirements.
 *
 * Uses regex heuristics — no LLM required. Works well with standard
 * corporate JD formats. Short or poorly structured JDs will still extract
 * skills from the full text as a fallback.
 */
export function parseJobDescription(jdText: string, title?: string): JobRequirements {
  const lines = splitLines(jdText);

  // 1. Required skills — from a "required" section, or from full text
  const reqIdx = findSectionStart(lines, REQUIRED_HEADINGS);
  const reqSection = reqIdx >= 0 ? extractSection(lines, reqIdx) : lines;
  let requiredSkills = extractSkillsFromText(reqSection.join('\n'));

  // 2. Preferred skills — from a "preferred" section
  const prefIdx = findSectionStart(lines, PREFERRED_HEADINGS);
  let preferredSkills: string[] = [];
  if (prefIdx >= 0) {
    const prefSection = extractSection(lines, prefIdx);
    preferredSkills = extractSkillsFromText(prefSection.join('\n'));
    // Remove from required to avoid duplicates
    const prefSet = new Set(preferredSkills.map((s) => s.toLowerCase()));
    requiredSkills = requiredSkills.filter((s) => !prefSet.has(s.toLowerCase()));
  }

  // Fallback: if sections not found, extract skills from whole text and treat all as required
  if (requiredSkills.length === 0) {
    requiredSkills = extractSkillsFromText(jdText);
  }

  // 3. Experience requirements
  const expIdx = findSectionStart(lines, EXPERIENCE_HEADINGS);
  const expLines = expIdx >= 0 ? extractSection(lines, expIdx) : [];
  // Also scan full text for year patterns
  const yearPattern = /\b(?:(\d+)\s*[-to]+\s*\d+|(\d+))\s*\+?\s*(?:years?|yrs?\.?)\s+(?:of\s+)?(?:professional\s+|relevant\s+|work\s+)?experience\b/gi;
  const expFromText = Array.from(jdText.matchAll(yearPattern)).map((m) => m[0].trim());
  const experienceRequirements = Array.from(
    new Set([...expLines.filter((l) => parseYearsFromLine(l) !== null), ...expFromText]),
  ).slice(0, 5);

  // 4. Education requirements
  const eduIdx = findSectionStart(lines, EDUCATION_HEADINGS);
  const eduLines = eduIdx >= 0 ? extractSection(lines, eduIdx) : [];
  const degreePattern = /\b(bachelor'?s?|master'?s?|phd|b\.?tech|m\.?tech|b\.?e|m\.?e|b\.?sc|m\.?sc|associate'?s?|doctorate)\b[^\n]*/gi;
  const eduFromText = Array.from(jdText.matchAll(degreePattern)).map((m) => m[0].trim());
  const educationRequirements = Array.from(
    new Set([...eduLines, ...eduFromText].filter((l) => l.length > 5)),
  ).slice(0, 5);

  // 5. Responsibilities
  const respIdx = findSectionStart(lines, RESPONSIBILITY_HEADINGS);
  const responsibilities = respIdx >= 0
    ? extractSection(lines, respIdx).filter((l) => l.length > 10).slice(0, 15)
    : [];

  // 6. ATS keywords
  const allFoundSkills = Array.from(new Set([...requiredSkills, ...preferredSkills]));
  const keywords = extractKeywords(jdText, allFoundSkills);

  // 7. Soft skills — curated vocabulary scan over the whole JD. Independent
  // of the hard-skill sections above; never affects scoring.
  const softSkills = extractSoftSkillsFromText(jdText);

  return {
    title: title?.trim() || undefined,
    requiredSkills: Array.from(new Set(requiredSkills)),
    preferredSkills: Array.from(new Set(preferredSkills)),
    softSkills,
    experienceRequirements,
    educationRequirements,
    responsibilities,
    keywords,
  };
}
