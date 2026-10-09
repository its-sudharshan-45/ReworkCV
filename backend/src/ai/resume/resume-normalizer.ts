// cspell:ignore subwords Subword reactjs expressjs
import type {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  NormalizedEntities,
  ProjectItem,
  RawNEREntity,
  StructuredResume,
} from './resume-types.js';
import { parseResumeSections } from '../../modules/resume/resume.section-parser.js';
import { findSkillsInText } from '../job/skill-normalizer.js';

/**
 * Normalizes raw NER entities label into canonical tag category.
 */
export function normalizeEntityLabel(label: string): string {
  const clean = label.replace(/^[BI]-/, '').toUpperCase().trim();

  switch (clean) {
    case 'NAME':
    case 'PERSON':
      return 'NAME';
    case 'EMAIL':
    case 'MAIL':
      return 'EMAIL';
    case 'PHONE':
    case 'TELEPHONE':
    case 'MOBILE':
      return 'PHONE';
    case 'LOCATION':
    case 'LOC':
    case 'CITY':
    case 'ADDRESS':
      return 'LOCATION';
    case 'COMPANY':
    case 'ORGANIZATION':
    case 'ORG':
    case 'EMPLOYER':
      return 'COMPANY';
    case 'TITLE':
    case 'DESIGNATION':
    case 'ROLE':
    case 'POSITION':
      return 'TITLE';
    case 'DATE':
    case 'YEAR':
    case 'DURATION':
      return 'DATE';
    case 'DEGREE':
    case 'DIPLOMA':
      return 'DEGREE';
    case 'FIELD':
    case 'MAJOR':
    case 'BRANCH':
      return 'FIELD';
    case 'INSTITUTION':
    case 'COLLEGE':
    case 'UNIVERSITY':
    case 'SCHOOL':
      return 'INSTITUTION';
    case 'SKILL':
    case 'TOOL':
    case 'TECH':
    case 'TECHNOLOGY':
      return 'SKILL';
    case 'CERT':
    case 'CERTIFICATION':
    case 'LICENSE':
      return 'CERT';
    case 'LANGUAGE':
    case 'LANG':
      return 'LANGUAGE';
    default:
      return clean;
  }
}

/**
 * Merges B-/I- tagged entities, subwords (##), and collects entity strings by label category.
 */
export function mergeRawEntities(rawEntities: RawNEREntity[]): NormalizedEntities {
  const buckets: Record<string, string[]> = {
    NAME: [],
    EMAIL: [],
    PHONE: [],
    LOCATION: [],
    COMPANY: [],
    TITLE: [],
    DATE: [],
    DEGREE: [],
    FIELD: [],
    INSTITUTION: [],
    SKILL: [],
    CERT: [],
    LANGUAGE: [],
  };

  let currentCategory: string | null = null;
  let currentWords: string[] = [];

  const flush = () => {
    if (currentCategory && currentWords.length > 0) {
      let combined = '';
      if (currentCategory === 'EMAIL') {
        // Email tokens must never gain spaces: NER splits addresses into
        // pieces ("its", ".", "name", "@", ...) and space-joining corrupts
        // them (". name . in @ gmail ."). Concatenate cleaned pieces instead.
        combined = currentWords
          .map((word) => word.replace(/^##/, '').replace(/\s+/g, ''))
          .join('');
      } else {
        for (const word of currentWords) {
          if (word.startsWith('##')) {
            combined += word.slice(2);
          } else if (word.startsWith(' ')) {
            combined += ' ' + word.slice(1);
          } else if (combined && !/^[.,;:!?\-/]$/.test(word) && !combined.endsWith(' ')) {
            combined += ' ' + word;
          } else {
            combined += word;
          }
        }
      }

      const trimmed = combined.trim().replace(/\s+/g, ' ');
      if (trimmed && buckets[currentCategory]) {
        buckets[currentCategory].push(trimmed);
      }
    }

    currentCategory = null;
    currentWords = [];
  };

  for (const item of rawEntities) {
    const rawLabel = item.entity;
    const category = normalizeEntityLabel(rawLabel);
    const isSubword = item.word.startsWith('##');
    const isContinuation = rawLabel.startsWith('I-') || isSubword;

    if (isContinuation && currentCategory === category) {
      currentWords.push(item.word);
    } else {
      flush();
      if (buckets[category]) {
        currentCategory = category;
        currentWords = [item.word];
      }
    }
  }

  flush();

  return {
    names: deduplicateStrings(buckets.NAME),
    emails: deduplicateStrings(buckets.EMAIL),
    phones: deduplicateStrings(buckets.PHONE),
    locations: deduplicateStrings(buckets.LOCATION),
    companies: deduplicateStrings(buckets.COMPANY),
    titles: deduplicateStrings(buckets.TITLE),
    dates: deduplicateStrings(buckets.DATE),
    degrees: deduplicateStrings(buckets.DEGREE),
    fields: deduplicateStrings(buckets.FIELD),
    institutions: deduplicateStrings(buckets.INSTITUTION),
    skills: normalizeSkills(buckets.SKILL),
    certs: deduplicateStrings(buckets.CERT),
    languages: normalizeSkills(buckets.LANGUAGE),
  };
}

/**
 * Deduplicates strings case-insensitively while preserving original capitalizations.
 */
export function deduplicateStrings(items: string[]): string[] {
  const map = new Map<string, string>();
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!map.has(key)) {
      map.set(key, trimmed);
    }
  }
  return Array.from(map.values());
}

/**
 * Normalizes skill names (e.g. React, react, React.js -> React.js or React).
 */
export function normalizeSkills(skills: string[]): string[] {
  const map = new Map<string, string>();

  for (const raw of skills) {
    // A single entry may bundle several skills ("HTML/CSS"); split it while
    // keeping "CI/CD" intact.
    for (const piece of splitCombinedSkillToken(raw)) {
      const cleaned = piece.trim().replace(/^[\s•\-*:]+/, '').replace(/[\s•\-*:]+$/, '');
      if (!cleaned || cleaned.length < 2 || cleaned.length > 50) continue;

      const lower = cleaned.toLowerCase();

      // Alias map for common skills
      let canonical = cleaned;
      if (lower === 'react' || lower === 'reactjs' || lower === 'react.js' || lower === 'react js') canonical = 'React.js';
      else if (lower === 'node' || lower === 'nodejs' || lower === 'node.js' || lower === 'node js') canonical = 'Node.js';
      else if (lower === 'js' || lower === 'javascript') canonical = 'JavaScript';
      else if (lower === 'ts' || lower === 'typescript') canonical = 'TypeScript';
      else if (lower === 'py' || lower === 'python') canonical = 'Python';
      else if (lower === 'html' || lower === 'html5') canonical = 'HTML';
      else if (lower === 'css' || lower === 'css3') canonical = 'CSS';
      else if (lower === 'aws' || lower === 'amazon web services') canonical = 'AWS';
      else if (lower === 'postgres' || lower === 'postgresql') canonical = 'PostgreSQL';
      else if (lower === 'mongo' || lower === 'mongodb') canonical = 'MongoDB';
      else if (lower === 'express' || lower === 'expressjs' || lower === 'express.js' || lower === 'express js') canonical = 'Express.js';
      else if (lower === 'vue' || lower === 'vuejs' || lower === 'vue.js' || lower === 'vue js') canonical = 'Vue.js';
      else if (lower === 'next' || lower === 'nextjs' || lower === 'next.js' || lower === 'next js') canonical = 'Next.js';
      else if (lower === 'c++' || lower === 'cpp') canonical = 'C++';
      else if (lower === 'c#' || lower === 'csharp') canonical = 'C#';
      else if (lower === 'go' || lower === 'golang') canonical = 'Go';
      else if (lower === 'k8s' || lower === 'kubernetes') canonical = 'Kubernetes';
      else if (lower === 'ci/cd' || lower === 'cicd' || lower === 'ci cd' || lower === 'ci-cd') canonical = 'CI/CD';

      const key = canonical.toLowerCase();
      if (!map.has(key) || canonical.includes('.')) {
        map.set(key, canonical);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Splits a bundled skill token ("HTML/CSS", "React, Node") into pieces while
 * keeping "CI/CD" intact. Tokens without "/" are returned unchanged.
 */
function splitCombinedSkillToken(raw: string): string[] {
  const protectedToken = raw.replace(/ci\s*\/\s*cd/gi, '__CICD_PROTECTED__');
  if (!protectedToken.includes('/')) return [raw];
  return protectedToken
    .split('/')
    .map((part) => part.split('__CICD_PROTECTED__').join('CI/CD').trim())
    .filter(Boolean);
}

/**
 * Extracts emails and phone numbers from raw resume text using regex fallback.
 */
function extractContactFallbacks(text: string): { email?: string; phone?: string } {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

  return {
    email: emailMatch ? emailMatch[0] : undefined,
    phone: phoneMatch ? phoneMatch[0] : undefined,
  };
}

/**
 * Groups normalized entities and section parsed data into canonical StructuredResume JSON.
 */
export function buildStructuredResume(
  text: string,
  rawEntities: RawNEREntity[],
): StructuredResume {
  const normalized = mergeRawEntities(rawEntities);
  const fallbacks = extractContactFallbacks(text);
  const sectionData = parseResumeSections(text);

  // Combine skills extracted by NER and section parser. As a safety net,
  // scan the full resume text for known tech skills: PDF exports often lay
  // the skills line out in ways section parsing alone misses (wide spacing,
  // slash-joined tokens, uncommon headings), and NER can drop short tokens
  // like "HTML" or punctuated ones like "Node.js".
  const textSkills = findSkillsInText(text);
  const allSkills = normalizeSkills([...normalized.skills, ...sectionData.skills, ...textSkills]);

  // Extract Summary section if present
  const summarySection = sectionData.sections.find((s) => s.key === 'summary');
  const summary = summarySection?.content ? summarySection.content.trim() : undefined;

  // Personal Info
  const personal = {
    name: normalized.names[0] || undefined,
    email: normalized.emails[0] || fallbacks.email,
    phone: normalized.phones[0] || fallbacks.phone,
    location: normalized.locations[0] || undefined,
  };

  // Experience Items
  const experienceSection = sectionData.sections.find((s) => s.key === 'experience');
  const experience: ExperienceItem[] = [];

  if (experienceSection && experienceSection.content) {
    const blocks = experienceSection.content.split(/\n{2,}/);
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        experience.push({
          title: lines[0],
          company: lines[1] && !lines[1].startsWith('•') ? lines[1] : undefined,
          description: lines.slice(1).join(' '),
        });
      }
    }
  }

  // Fallback / merge with NER company/title/date if no section experience found
  if (experience.length === 0 && (normalized.companies.length > 0 || normalized.titles.length > 0)) {
    const count = Math.max(normalized.companies.length, normalized.titles.length);
    for (let i = 0; i < count; i++) {
      experience.push({
        title: normalized.titles[i] || undefined,
        company: normalized.companies[i] || undefined,
        startDate: normalized.dates[i * 2] || undefined,
        endDate: normalized.dates[i * 2 + 1] || undefined,
      });
    }
  }

  // Education Items
  const educationSection = sectionData.sections.find((s) => s.key === 'education');
  const education: EducationItem[] = [];

  if (educationSection && educationSection.content) {
    const blocks = educationSection.content.split(/\n{2,}/);
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        education.push({
          institution: lines[0],
          degree: lines[1] || normalized.degrees[0],
          field: normalized.fields[0],
          description: lines.slice(1).join(' '),
        });
      }
    }
  }

  if (education.length === 0 && (normalized.institutions.length > 0 || normalized.degrees.length > 0)) {
    const count = Math.max(normalized.institutions.length, normalized.degrees.length);
    for (let i = 0; i < count; i++) {
      education.push({
        institution: normalized.institutions[i] || undefined,
        degree: normalized.degrees[i] || undefined,
        field: normalized.fields[i] || undefined,
        startDate: normalized.dates[i] || undefined,
      });
    }
  }

  // Projects (extracted using Section Parser as required by specification #12)
  const projectsSection = sectionData.sections.find((s) => s.key === 'projects');
  const projects: ProjectItem[] = [];

  if (projectsSection && projectsSection.content) {
    const blocks = projectsSection.content.split(/\n{2,}|(?:\n(?=\s*[•\-*]\s))/);
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        const name = lines[0].replace(/^[\s•\-*]+/, '').split(/[:\-–]/)[0].trim();
        const description = lines.join(' ');
        // Find matching technologies in description
        const techFound = allSkills.filter((skill) =>
          description.toLowerCase().includes(skill.toLowerCase()),
        );

        projects.push({
          name: name || undefined,
          description,
          technologies: techFound.length > 0 ? techFound : undefined,
        });
      }
    }
  }

  // Certifications
  const certsSection = sectionData.sections.find((s) => s.key === 'certifications');
  const certifications: CertificationItem[] = normalized.certs.map((c) => ({ name: c }));

  if (certsSection && certsSection.content) {
    const lines = certsSection.content.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const cleanCert = line.replace(/^[\s•\-*]+/, '').trim();
      if (cleanCert && !certifications.some((c) => c.name?.toLowerCase() === cleanCert.toLowerCase())) {
        certifications.push({ name: cleanCert });
      }
    }
  }

  return {
    personal,
    summary,
    skills: allSkills,
    experience,
    education,
    projects,
    certifications,
    languages: normalized.languages,
  };
}
