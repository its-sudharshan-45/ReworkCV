/**
 * Client-side mirror of the backend soft-skill vocabulary
 * (`backend/src/ai/job/soft-skills.ts`, the authoritative source).
 *
 * Used ONLY as a fallback for analyses persisted before soft-skill
 * reporting existed: those records carry no `matchedSoft`/`missingSoft`,
 * so legacy "preferred" lists are split here into genuine soft skills
 * (Communication, Leadership, …) versus technical nice-to-haves
 * (React, Docker, AWS, …) that must never render under "Soft Skills".
 * New analyses always use the backend-provided fields instead.
 */

// Canonical display name -> aliases (lowercase, kept in sync with backend).
const SOFT_SKILL_ALIASES: Record<string, string[]> = {
  Communication: ['communication', 'communicating', 'written communication', 'verbal communication', 'active listening', 'presentation skills', 'presenting', 'interpersonal communication'],
  Teamwork: ['teamwork', 'team work', 'team player', 'team-player', 'collaboration', 'collaborative', 'collaborate', 'collaborating', 'cross-functional collaboration', 'team-oriented', 'team oriented'],
  'Problem-solving': ['problem-solving', 'problem solving', 'troubleshooting', 'analytical problem solving'],
  Adaptability: ['adaptability', 'adaptable', 'adapt', 'adapts', 'adapting', 'flexibility', 'flexible', 'fast learner', 'quick learner', 'eager to learn', 'comfortable with ambiguity', 'embrace change'],
  'Time management': ['time management', 'manage time', 'manages time', 'prioritization', 'prioritizing', 'multitasking', 'multi-tasking', 'meeting deadlines', 'deadline-driven', 'organized', 'highly organized'],
  'Critical thinking': ['critical thinking', 'analytical thinking', 'decision-making', 'decision making', 'sound judgment'],
  Leadership: ['leadership', 'leading teams', 'team leadership', 'mentoring', 'mentorship', 'ownership', 'taking ownership', 'accountability', 'leading initiatives'],
  'Emotional intelligence': ['emotional intelligence', 'empathy', 'empathetic', 'conflict resolution', 'conflict management', 'diplomacy', 'self-awareness', 'interpersonal skills'],
  Creativity: ['creativity', 'creative', 'creative thinking', 'innovation', 'innovative', 'out-of-the-box thinking', 'out of the box thinking'],
  'Work ethic': ['work ethic', 'strong work ethic', 'detail-oriented', 'detail oriented', 'attention to detail', 'self-motivated', 'self-starter', 'proactive', 'customer focus', 'customer obsession'],
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const KNOWN_SOFT: Set<string> = new Set();
for (const [display, aliases] of Object.entries(SOFT_SKILL_ALIASES)) {
  KNOWN_SOFT.add(normalize(display));
  for (const alias of aliases) KNOWN_SOFT.add(normalize(alias));
}

/**
 * Returns true when a standalone skill label denotes a soft skill.
 * Technical skills (React, Docker, AWS, TypeScript, …) always return false.
 */
export function isSoftSkillLabel(name: string | null | undefined): boolean {
  if (typeof name !== 'string') return false;
  const key = normalize(name).replace(/\s+skills?$/, '');
  if (!key) return false;
  return KNOWN_SOFT.has(key);
}
