import type { StructuredResume } from '../../ai/resume/resume-types.js';

export interface CandidateIdentity {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  /**
   * Provenance of the name: 'resume' when it comes from parsed resume data
   * (NER, raw personal block, or letterhead/email found in the resume text),
   * 'fallback' when only the filename or 'Candidate' default was available.
   * Generation must refuse 'fallback' identities.
   */
  nameSource: 'resume' | 'fallback';
}

interface ResumeIdentitySource {
  original_filename?: string;
  extracted_text?: string | null;
  structured_data?: {
    structuredResume?: StructuredResume | null;
    personal?: {
      name?: string;
      email?: string;
      phone?: string;
      location?: string;
    };
  } | null;
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** Lines that are headings/labels rather than a person's name. */
const NON_NAME_WORDS = new Set([
  'resume', 'curriculum', 'vitae', 'profile', 'portfolio', 'summary', 'objective',
  'experience', 'education', 'skills', 'projects', 'contact', 'phone', 'email',
  'address', 'linkedin', 'github', 'developer', 'engineer', 'manager', 'designer',
  'analyst', 'consultant', 'architect', 'intern', 'student', 'stack', 'full',
]);

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts a candidate name from the top of the raw resume text (the resume
 * letterhead). Used when NER produced no name, or when the stored name does
 * not actually appear in the resume text (e.g. a filename-derived fallback).
 */
export function extractNameFromResumeHeader(extractedText: string | null | undefined): string | undefined {
  if (!extractedText) return undefined;

  const lines = extractedText
    .split('\n')
    .map((line) => collapseWhitespace(line))
    .filter(Boolean)
    .slice(0, 6);

  for (const line of lines) {
    if (line.length < 2 || line.length > 60) continue;
    if (line.includes('@') || line.includes('://') || line.includes(':')) continue;
    if ((line.match(/\d/g) ?? []).length >= 4) continue;

    const words = line.split(' ');
    if (words.length < 2 || words.length > 4) continue;
    if (!words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word))) continue;
    if (words.some((word) => NON_NAME_WORDS.has(word.toLowerCase()))) continue;

    return line;
  }

  return undefined;
}

export function extractEmailFromText(extractedText: string | null | undefined): string | undefined {
  if (!extractedText) return undefined;
  return extractedText.match(EMAIL_PATTERN)?.[0];
}

/** Strict validity: no spaces, full address shape. Stored NER emails with merge artifacts fail this. */
export function isValidEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  return EMAIL_PATTERN.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) && !/\s/.test(value);
}

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+/gi;

function cleanUrl(raw: string): string {
  return raw.replace(/[.,;:!?)\]]+$/, '');
}

function findUrls(extractedText: string | null | undefined): string[] {
  if (!extractedText) return [];
  return (extractedText.match(URL_PATTERN) ?? []).map(cleanUrl).filter(Boolean);
}

/** First LinkedIn profile URL found in the resume text, if any. */
export function extractLinkedinUrl(extractedText: string | null | undefined): string | undefined {
  return findUrls(extractedText).find((url) => /linkedin\.com\/in\//i.test(url));
}

/** First GitHub profile URL found in the resume text, if any. */
export function extractGithubUrl(extractedText: string | null | undefined): string | undefined {
  return findUrls(extractedText).find((url) => /github\.com\//i.test(url));
}

/**
 * First portfolio/website URL found in the resume text, if any. Only URLs on
 * lines that mention portfolio/website/blog/personal-site qualify, and social
 * or platform domains are never treated as a portfolio — never guessed.
 */
export function extractPortfolioUrl(extractedText: string | null | undefined): string | undefined {
  if (!extractedText) return undefined;
  const excluded = /linkedin\.com|github\.com|gitlab\.com|bitbucket\.org|twitter\.com|x\.com|facebook\.com|instagram\.com|medium\.com|leetcode\.com|hackerrank\.com|codechef\.com|gmail\.com|google\.com|fonts\.googleapis\.com/i;
  for (const line of extractedText.split('\n')) {
    if (!/portfolio|website|personal site|blog\b/i.test(line)) continue;
    const urls = (line.match(URL_PATTERN) ?? []).map(cleanUrl).filter((url) => !excluded.test(url));
    if (urls.length > 0) return urls[0];
  }
  return undefined;
}

function isEvidentInText(value: string, extractedText: string | null | undefined): boolean {
  if (!extractedText) return true;
  return extractedText.toLowerCase().includes(collapseWhitespace(value).toLowerCase());
}

function filenameFallback(originalFilename: string | undefined): string {
  if (!originalFilename) return 'Candidate';
  const base = originalFilename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return base || 'Candidate';
}

/**
 * Decides whether the resume letterhead name should replace the stored
 * parsed name: yes when the stored name is absent from the resume text
 * (stale/filename artifact), or when both names share a significant token
 * but differ (e.g. "SUDHARSHAN AI" vs "Sudharshan N" — same person, exact
 * self-styled spelling wins). Never when they are unrelated, so a company
 * logo line can never override the parsed candidate name.
 */
function shouldPreferLetterheadName(
  storedName: string,
  headerName: string,
  extractedText: string | null | undefined,
): boolean {
  if (collapseWhitespace(headerName).toLowerCase() === collapseWhitespace(storedName).toLowerCase()) {
    return false;
  }
  if (!isEvidentInText(storedName, extractedText)) {
    return true;
  }
  return sharesSignificantNameToken(storedName, headerName);
}

/** True when both names share a 2+ letter token (excluding label words). */
function sharesSignificantNameToken(a: string, b: string): boolean {
  const tokens = (value: string): Set<string> => {
    const set = new Set<string>();
    for (const word of value.toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
      if (word.length >= 2 && !NON_NAME_WORDS.has(word)) {
        set.add(word);
      }
    }
    return set;
  };
  const tokensA = tokens(a);
  for (const token of tokens(b)) {
    if (tokensA.has(token)) return true;
  }
  return false;
}

/**
 * Resolves the single source of truth for candidate identity from a resume
 * record. Priority: NER structured data → raw personal block → resume
 * letterhead/email/links in the extracted text → original filename.
 *
 * A stored name that appears nowhere in the resume text is treated as a
 * stale/filename artifact and replaced by the letterhead name when one is
 * found; a letterhead name sharing a significant token with the stored name
 * (same person, different styling) also wins over a stale all-caps variant.
 * An unrelated letterhead (e.g. a company line) never overrides the parsed
 * name. `nameSource` is 'fallback' only when no resume-evidenced name exists
 * at all; callers must refuse to generate with a fallback identity.
 */
export function resolveCandidateIdentity(resume: ResumeIdentitySource): CandidateIdentity {
  const structuredPersonal = resume.structured_data?.structuredResume?.personal;
  const rawPersonal = resume.structured_data?.personal;
  const extractedText = resume.extracted_text ?? undefined;

  const storedName =
    structuredPersonal?.name?.trim() ||
    rawPersonal?.name?.trim() ||
    undefined;
  const headerName = extractNameFromResumeHeader(extractedText);

  let name = storedName;
  if (!name) {
    name = headerName;
  } else if (headerName && shouldPreferLetterheadName(name, headerName, extractedText)) {
    name = headerName;
  }
  let nameSource: CandidateIdentity['nameSource'] = name ? 'resume' : 'fallback';
  if (!name) {
    name = filenameFallback(resume.original_filename);
    nameSource = 'fallback';
  }

  // A stored email with merge artifacts (spaces) is invalid — fall through
  // to the exact address regexed from the raw resume text instead.
  const email =
    (isValidEmail(structuredPersonal?.email?.trim()) && structuredPersonal?.email?.trim()) ||
    (isValidEmail(rawPersonal?.email?.trim()) && rawPersonal?.email?.trim()) ||
    extractEmailFromText(extractedText);

  const phone = structuredPersonal?.phone?.trim() || rawPersonal?.phone?.trim() || undefined;
  const location = structuredPersonal?.location?.trim() || rawPersonal?.location?.trim() || undefined;
  const linkedin = extractLinkedinUrl(extractedText);
  const github = extractGithubUrl(extractedText);
  const portfolio = extractPortfolioUrl(extractedText);

  return { name, email, phone, location, linkedin, github, portfolio, nameSource };
}

const SIGNOFF_PATTERN = /^(sincerely|best regards|kind regards|warm regards|respectfully|yours truly|thanks|thank you)[,!]?\s*$/i;

/**
 * A leading line is redundant when it is the candidate name itself, or a
 * standalone title-like header (few plain words, no sentence punctuation)
 * sitting directly above the "Dear ..." greeting. Dates, sentences, and the
 * greeting itself never qualify.
 */
function isRedundantLeadLine(lines: string[], index: number, candidateName: string): boolean {
  const line = collapseWhitespace(lines[index]);
  if (!line) return false;
  if (line.toLowerCase() === collapseWhitespace(candidateName).toLowerCase()) return true;

  const words = line.split(' ');
  if (words.length > 5) return false;
  if (!words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word))) return false;

  let next = index + 1;
  while (next < lines.length && !lines[next].trim()) next++;
  return next < lines.length && /^dear\b/i.test(lines[next].trim());
}

/**
 * Deterministically enforces the candidate's identity in generated letter
 * text: the sign-off block is rebuilt from the exact resume data (name with
 * identical spelling/casing, plus email/phone/links only when present), and a
 * leading duplicate name header is removed (exports render the header).
 * The letter body is never modified.
 */
export function enforceSignatureIdentity(content: string, identity: CandidateIdentity): string {
  const lines = content.split('\n');

  // Drop a leading header line that merely repeats the candidate name (the
  // export renders it as the document header), or any other standalone
  // title-like line above the greeting ("No headers" is already instructed,
  // this only repairs models that emit one anyway). The body is untouched.
  let start = 0;
  while (start < lines.length && !lines[start].trim()) start++;
  if (start < lines.length && isRedundantLeadLine(lines, start, identity.name)) {
    start++;
    while (start < lines.length && !lines[start].trim()) start++;
  }

  const bodyLines = lines.slice(start);
  // The sign-off is always near the end of the letter: only accept a match
  // in the trailing lines so a mid-body "Thanks!" can never truncate content.
  const searchFrom = Math.max(0, bodyLines.length - 8);
  let signoffIndex = -1;
  for (let i = bodyLines.length - 1; i >= searchFrom; i--) {
    if (SIGNOFF_PATTERN.test(bodyLines[i].trim())) {
      signoffIndex = i;
      break;
    }
  }

  const signature = [
    identity.name,
    identity.email,
    identity.phone,
    identity.linkedin,
    identity.github,
    identity.portfolio,
  ].filter((part): part is string => Boolean(part && part.trim()));

  if (signoffIndex >= 0) {
    const body = bodyLines.slice(0, signoffIndex + 1).join('\n').trimEnd();
    return `${body}\n\n${signature.join('\n')}`;
  }

  const body = bodyLines.join('\n').trimEnd();
  return `${body}\n\nSincerely,\n\n${signature.join('\n')}`;
}
