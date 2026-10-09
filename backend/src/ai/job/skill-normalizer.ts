/**
 * Skill Normalization for Job-Specific ATS Matching
 *
 * Normalizes skill names before comparison so that "ReactJS", "React.js",
 * and "React" all resolve to the same canonical form.
 */

// cspell:ignore reactjs vuejs sveltejs nextjs nuxtjs nestjs fastapi

import { KNOWN_TECH_SKILLS } from './job-jd-parser.js';

/** Alias map: normalized (lowercase) alias -> canonical normalized form */
const SKILL_ALIASES: Record<string, string> = {
  // JavaScript
  'javascript': 'javascript',
  'js': 'javascript',
  'ecmascript': 'javascript',
  'es6': 'javascript',
  'es2015': 'javascript',
  // TypeScript
  'typescript': 'typescript',
  'ts': 'typescript',
  // React
  'react': 'react',
  'reactjs': 'react',
  'react.js': 'react',
  'react js': 'react',
  // Vue
  'vue': 'vue',
  'vuejs': 'vue',
  'vue.js': 'vue',
  'vue js': 'vue',
  // Svelte
  'svelte': 'svelte',
  'sveltejs': 'svelte',
  // Angular
  'angular': 'angular',
  'angularjs': 'angular',
  // Next.js
  'next': 'next.js',
  'nextjs': 'next.js',
  'next.js': 'next.js',
  'next js': 'next.js',
  // Nuxt
  'nuxt': 'nuxt',
  'nuxtjs': 'nuxt',
  // Node.js
  'node': 'node.js',
  'nodejs': 'node.js',
  'node.js': 'node.js',
  'node js': 'node.js',
  // Express
  'express': 'express',
  'expressjs': 'express',
  'express.js': 'express',
  'express js': 'express',
  // NestJS
  'nest': 'nestjs',
  'nestjs': 'nestjs',
  'nest.js': 'nestjs',
  // Python
  'python': 'python',
  'py': 'python',
  // FastAPI
  'fastapi': 'fastapi',
  'fast api': 'fastapi',
  // Django
  'django': 'django',
  // Flask
  'flask': 'flask',
  // Java
  'java': 'java',
  // Spring
  'spring': 'spring',
  'spring boot': 'spring boot',
  'springboot': 'spring boot',
  // Go
  'go': 'go',
  'golang': 'go',
  // Rust
  'rust': 'rust',
  // PostgreSQL
  'postgresql': 'postgresql',
  'postgres': 'postgresql',
  'pg': 'postgresql',
  // MySQL
  'mysql': 'mysql',
  // MongoDB
  'mongodb': 'mongodb',
  'mongo': 'mongodb',
  // Redis
  'redis': 'redis',
  // SQLite
  'sqlite': 'sqlite',
  // GraphQL
  'graphql': 'graphql',
  // REST
  'rest': 'rest api',
  'rest api': 'rest api',
  'restful': 'rest api',
  'rest apis': 'rest api',
  'restful api': 'rest api',
  'restful apis': 'rest api',
  // Docker
  'docker': 'docker',
  // Kubernetes
  'kubernetes': 'kubernetes',
  'k8s': 'kubernetes',
  // AWS
  'aws': 'aws',
  'amazon web services': 'aws',
  // GCP
  'gcp': 'gcp',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  // Azure
  'azure': 'azure',
  'microsoft azure': 'azure',
  // Git
  'git': 'git',
  'github': 'github',
  'gitlab': 'gitlab',
  // CI/CD
  'cicd': 'ci/cd',
  'ci/cd': 'ci/cd',
  'ci cd': 'ci/cd',
  'continuous integration': 'ci/cd',
  // Linux
  'linux': 'linux',
  'unix': 'linux',
  // Terraform
  'terraform': 'terraform',
  // HTML
  'html': 'html',
  'html5': 'html',
  // CSS
  'css': 'css',
  'css3': 'css',
  // Tailwind
  'tailwind': 'tailwind css',
  'tailwindcss': 'tailwind css',
  'tailwind css': 'tailwind css',
  // SASS/SCSS
  'sass': 'sass',
  'scss': 'sass',
  // Supabase
  'supabase': 'supabase',
  // Firebase
  'firebase': 'firebase',
  // Testing
  'jest': 'jest',
  'vitest': 'vitest',
  'cypress': 'cypress',
  'playwright': 'playwright',
  'selenium': 'selenium',
  // Agile/Soft
  'agile': 'agile',
  'scrum': 'scrum',
};

/** Strip common suffixes and lowercase */
function stripAndLower(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\.js$/i, '')      // strip trailing .js
    .replace(/\.py$/i, '')      // strip .py
    .replace(/\.ts$/i, '')      // strip .ts
    .replace(/[^\w\s./+#-]/g, '') // remove special chars except common ones
    .trim();
}

/**
 * Normalize a skill string to its canonical lowercase form.
 * Falls back to the stripped lowercase value if no alias is found.
 */
export function normalizeSkill(skill: string): string {
  const stripped = stripAndLower(skill);
  return SKILL_ALIASES[stripped] ?? stripped;
}

/**
 * Compare two skills after normalization.
 */
export function skillsMatch(a: string, b: string): boolean {
  const na = normalizeSkill(a);
  const nb = normalizeSkill(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Given a list of resume skills and a list of JD skills,
 * return the matched and missing sets (using canonical display names from JD).
 */
export function findMatchingSkills(
  resumeSkills: string[],
  jdSkills: string[],
): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const jdSkill of jdSkills) {
    const found = resumeSkills.some((rs) => skillsMatch(rs, jdSkill));
    if (found) {
      matched.push(jdSkill);
    } else {
      missing.push(jdSkill);
    }
  }

  return { matched, missing };
}

export { SKILL_ALIASES };

// ---------------------------------------------------------------------------
// Full-text skill evidence
// ---------------------------------------------------------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tokens too short and ambiguous for full-text search. A 1-2 letter,
 * letters-only token (e.g. "Go", "R") matches ordinary English words, so it
 * is only trusted when it appears in an explicit skills list — never as
 * free-text evidence. Symbol-bearing tokens (C++, C#) stay searchable.
 */
function isAmbiguousShortSkill(skill: string): boolean {
  return /^[a-z]{1,2}$/i.test(skill.trim());
}

/**
 * Find known tech skills mentioned anywhere in free text (resume body,
 * experience descriptions, project text). Matching is boundary-aware so
 * "Java" does not match "JavaScript" and "Go" does not match "going".
 * Returns display names with duplicates (by normalized form) removed.
 */
export function findSkillsInText(text: string, candidates?: string[]): string[] {
  if (!text || !text.trim()) return [];

  // Default vocabulary: first KNOWN_TECH_SKILLS entry per normalized form,
  // so "Node.js"/"NodeJS" and "React"/"ReactJS" are not reported twice.
  // Lazy import avoids a hard module cycle with the JD parser.
  const vocabulary: string[] = candidates ?? defaultScanVocabulary();
  const found: string[] = [];
  const seen = new Set<string>();

  for (const skill of vocabulary) {
    if (!skill || isAmbiguousShortSkill(skill)) continue;
    const key = normalizeSkill(skill);
    if (seen.has(key)) continue;
    let pattern: RegExp;
    try {
      pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(skill)}(?![a-z0-9])`, 'i');
    } catch {
      continue;
    }
    if (pattern.test(text)) {
      seen.add(key);
      found.push(skill);
    }
  }

  return found;
}

let cachedScanVocabulary: string[] | null = null;

function defaultScanVocabulary(): string[] {
  if (!cachedScanVocabulary) {
    // First KNOWN_TECH_SKILLS entry per normalized form, so "Node.js" and
    // "NodeJS" (or "React" and "ReactJS") are not reported twice.
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const skill of KNOWN_TECH_SKILLS) {
      const key = normalizeSkill(skill);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(skill);
      }
    }
    cachedScanVocabulary = unique;
  }
  return cachedScanVocabulary;
}

// ---------------------------------------------------------------------------
// Skills-section line segmentation
// ---------------------------------------------------------------------------

/** Every known single- and multi-word skill spelling, lowercased. */
const SKILL_PHRASES: Set<string> = new Set([
  ...Object.keys(SKILL_ALIASES),
  ...Object.values(SKILL_ALIASES),
  ...KNOWN_TECH_SKILLS.map((s) => s.toLowerCase()),
]);

/** Filler words between skills ("HTML and CSS") that are never skills. */
const SKILL_LINE_CONNECTORS = new Set([
  'and', 'or', '&', '+', 'with', 'using', 'plus', 'along',
  'including', 'incl', 'like', 'such', 'as', '-', '|', '/',
]);

/** Strips wrapping punctuation (parentheses, quotes, trailing dots) for lookup. */
function cleanSegmentWord(word: string): string {
  return word.replace(/^[([{“"'']+/, '').replace(/[)\]}“"'.,:;]+$/, '');
}

/**
 * Splits a skills-section fragment on whitespace using the known-skill
 * vocabulary (longest match), so "HTML CSS Node.js" becomes three skills
 * while "Spring Boot" and "Tailwind CSS" stay single skills. Unknown tokens
 * are preserved verbatim (up to 4 words) so genuine tools are never lost;
 * longer leftovers are sentences, not skills, and are dropped.
 */
export function splitSkillPhrases(part: string): string[] {
  if (!part || !/[\s]/.test(part)) return [part];
  const words = part.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [part];

  const out: string[] = [];
  let leftover: string[] = [];
  const flushLeftover = (): void => {
    if (leftover.length > 0 && leftover.length <= 4) {
      out.push(leftover.join(' '));
    }
    leftover = [];
  };

  let i = 0;
  while (i < words.length) {
    const cleaned: string[] = [];
    for (let k = i; k < Math.min(i + 4, words.length); k++) {
      cleaned.push(cleanSegmentWord(words[k]));
    }
    let matchedLength = 0;
    for (let k = Math.min(4, words.length - i); k >= 1; k--) {
      const candidate = cleaned.slice(0, k).join(' ').toLowerCase();
      if (candidate && SKILL_PHRASES.has(candidate)) {
        matchedLength = k;
        break;
      }
    }
    if (matchedLength > 0) {
      flushLeftover();
      out.push(cleaned.slice(0, matchedLength).join(' '));
      i += matchedLength;
    } else {
      const word = cleanSegmentWord(words[i]);
      if (word && !SKILL_LINE_CONNECTORS.has(word.toLowerCase())) {
        leftover.push(word);
      }
      i++;
    }
  }
  flushLeftover();

  return out.length > 0 ? out : [part];
}
