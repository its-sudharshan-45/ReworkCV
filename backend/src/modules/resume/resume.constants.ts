// cspell:ignore msword openxmlformats officedocument wordprocessingml
export const SUPPORTED_RESUME_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
] as const;

export const SUPPORTED_RESUME_EXTENSIONS = ['.pdf', '.txt', '.doc', '.docx'] as const;

export const SECTION_HEADING_PATTERNS: Record<string, RegExp[]> = {
  summary: [
    /^(professional\s+)?summary$/i,
    /^profile$/i,
    /^(career\s+)?objective$/i,
    /^about(\s+me)?$/i,
  ],
  skills: [
    /^(technical\s+|core\s+|key\s+)?skills$/i,
    /^core\s+(competencies|skills)$/i,
    /^key\s+competencies$/i,
    /^technical\s+competencies$/i,
    /^skills\s*(&|and)\s*competencies$/i,
    /^technologies$/i,
    /^tools(\s*(&|and)\s*technologies)?$/i,
    /^technical\s+(skills|expertise|stack)$/i,
    /^tech(\s+stack|\s+skills)?$/i,
    /^technical\s+stack$/i,
    /^technology\s+stack$/i,
    /^stack$/i,
    /^skill\s*set$/i,
    /^skills?\s*(&|and)\s*expertise$/i,
    /^areas?\s+of\s+expertise$/i,
    /^competencies$/i,
  ],
  experience: [
    /^(work|professional|relevant)\s+experience$/i,
    /^experience$/i,
    /^(employment|career|work)\s+history$/i,
    /^employment$/i,
  ],
  education: [
    /^education(al)?(\s+background)?$/i,
    /^academic(\s+background)?$/i,
    /^education\s*(&|and)\s*training$/i,
    /^academics$/i,
  ],
  projects: [
    /^(personal|academic|key|selected)\s+projects$/i,
    /^projects$/i,
  ],
  certifications: [
    /^certifications?$/i,
    /^licenses(\s+and|\s*&)?\s+certifications?$/i,
    /^certifications?(\s+and|\s*&)?\s+licenses$/i,
    /^(honors?|awards?)(\s+and|\s*&)?\s*(awards?|honors?)?$/i,
    /^achievements?$/i,
    /^certifications?(\s+and|\s*&)?\s+achievements?$/i,
  ],
};

/**
 * Deterministic section weights for resume scoring (sum = 100).
 * Each section score is proportional to detected content quality.
 */
export const SECTION_SCORE_WEIGHTS: Record<
  'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'certifications',
  number
> = {
  summary: 15,
  skills: 20,
  experience: 25,
  education: 15,
  projects: 15,
  certifications: 10,
};

export const MIN_RESUME_SCORE = 0;
export const MAX_RESUME_SCORE = 100;
