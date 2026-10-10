// ---------------------------------------------------------------------------
// Soft-skill vocabulary + detection.
//
// Hard (technical) skills come from the tech vocabulary (skill-normalizer /
// JD parser). Soft skills — communication, teamwork, leadership, … — need
// their own curated phrase list so the report can show a genuine "Soft
// Skills" section instead of mislabeling nice-to-have technical skills
// (React, Docker, AWS, …) as soft skills.
//
// Matching is boundary-aware on separator-normalized text, so "software"
// never matches "soft", "social media" never matches a soft skill, and
// "problem-solving" matches "problem solving" regardless of hyphenation.
// This module never affects ATS scores — classification only.
// ---------------------------------------------------------------------------

interface SoftSkillEntry {
  /** Canonical display name used across reports and exports. */
  display: string;
  /** Lowercase aliases matched in text (normalized before matching). */
  aliases: string[];
}

const SOFT_SKILL_ENTRIES: SoftSkillEntry[] = [
  { display: 'Communication', aliases: ['communication', 'communicating', 'written communication', 'verbal communication', 'active listening', 'presentation skills', 'presenting', 'interpersonal communication'] },
  { display: 'Teamwork', aliases: ['teamwork', 'team work', 'team player', 'team-player', 'collaboration', 'collaborative', 'collaborate', 'collaborating', 'cross-functional collaboration', 'team-oriented', 'team oriented'] },
  { display: 'Problem-solving', aliases: ['problem-solving', 'problem solving', 'troubleshooting', 'analytical problem solving'] },
  { display: 'Adaptability', aliases: ['adaptability', 'adaptable', 'adapt', 'adapts', 'adapting', 'flexibility', 'flexible', 'fast learner', 'quick learner', 'eager to learn', 'comfortable with ambiguity', 'embrace change'] },
  { display: 'Time management', aliases: ['time management', 'manage time', 'manages time', 'prioritization', 'prioritizing', 'multitasking', 'multi-tasking', 'meeting deadlines', 'deadline-driven', 'organized', 'highly organized'] },
  { display: 'Critical thinking', aliases: ['critical thinking', 'analytical thinking', 'decision-making', 'decision making', 'sound judgment'] },
  { display: 'Leadership', aliases: ['leadership', 'leading teams', 'team leadership', 'mentoring', 'mentorship', 'ownership', 'taking ownership', 'accountability', 'leading initiatives'] },
  { display: 'Emotional intelligence', aliases: ['emotional intelligence', 'empathy', 'empathetic', 'conflict resolution', 'conflict management', 'diplomacy', 'self-awareness', 'interpersonal skills'] },
  { display: 'Creativity', aliases: ['creativity', 'creative', 'creative thinking', 'innovation', 'innovative', 'out-of-the-box thinking', 'out of the box thinking'] },
  { display: 'Work ethic', aliases: ['work ethic', 'strong work ethic', 'detail-oriented', 'detail oriented', 'attention to detail', 'self-motivated', 'self-starter', 'proactive', 'customer focus', 'customer obsession'] },
];

/** Normalize for comparison: lowercase, separators collapsed to one space. */
function normalizeSkillText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const CANONICAL_BY_NORMALIZED: Map<string, string> = new Map();
for (const entry of SOFT_SKILL_ENTRIES) {
  CANONICAL_BY_NORMALIZED.set(normalizeSkillText(entry.display), entry.display);
  for (const alias of entry.aliases) {
    const key = normalizeSkillText(alias);
    if (!CANONICAL_BY_NORMALIZED.has(key)) {
      CANONICAL_BY_NORMALIZED.set(key, entry.display);
    }
  }
}

/** Canonical display names, e.g. ["Communication", "Teamwork", ...]. */
export function listSoftSkillNames(): string[] {
  return SOFT_SKILL_ENTRIES.map((e) => e.display);
}

function normalizeHaystack(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

/**
 * Returns true when a standalone skill label (e.g. "Communication skills",
 * "Leadership") denotes a soft skill. A trailing "skill(s)" filler is
 * stripped before lookup so "Communication skills" still classifies.
 */
export function isSoftSkillName(name: string | null | undefined): boolean {
  if (typeof name !== 'string') return false;
  const key = normalizeSkillText(name).replace(/\s+skills?$/, '');
  if (!key) return false;
  return CANONICAL_BY_NORMALIZED.has(key);
}

/** Canonical display name for a soft-skill label, or null when not soft. */
export function canonicalizeSoftSkill(name: string | null | undefined): string | null {
  if (typeof name !== 'string') return null;
  const key = normalizeSkillText(name).replace(/\s+skills?$/, '');
  if (!key) return null;
  return CANONICAL_BY_NORMALIZED.get(key) ?? null;
}

/**
 * Scans free text for soft-skill phrases and returns canonical display names
 * in order of first appearance (deduped, capped). Boundary-aware: "software"
 * and "social media" never match.
 */
export function extractSoftSkillsFromText(text: string | null | undefined, limit = 20): string[] {
  if (typeof text !== 'string' || !text.trim()) return [];
  const haystack = normalizeHaystack(text);
  const found: Array<{ display: string; index: number }> = [];
  const seen = new Set<string>();
  for (const [normalized, display] of CANONICAL_BY_NORMALIZED) {
    if (seen.has(display)) continue;
    const index = haystack.indexOf(` ${normalized} `);
    if (index >= 0) {
      seen.add(display);
      found.push({ display, index });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found.slice(0, Math.max(1, limit)).map((f) => f.display);
}
