/**
 * Resume-Job Matching Engine
 *
 * Compares a StructuredResume (from Hugging Face NER) against
 * JobRequirements (from the JD parser) and produces a fully explainable
 * JobMatchAnalysis with per-category scores.
 *
 * Anti-hallucination guarantee: all evidence references come only from
 * fields present in the StructuredResume. Nothing is inferred or invented.
 */

import type { StructuredResume } from '../resume/resume-types.js';
import {
  ATS_MATCH_WEIGHTS,
  getMatchCategory,
  type JobMatchAnalysis,
  type JobRequirements,
  type SkillMatchDetail,
  type ExperienceMatchDetail,
  type EducationMatchDetail,
  type ResponsibilityMatchDetail,
  type KeywordMatchDetail,
  type ProjectMatchDetail,
  type ProjectRelevance,
} from './job-types.js';
import { findMatchingSkills, findSkillsInText, normalizeSkill, skillsMatch } from './skill-normalizer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Extract approximate years from experience entries */
function estimateProfessionalYears(resume: StructuredResume): number {
  let years = 0;
  for (const exp of resume.experience) {
    if (exp.startDate && exp.endDate) {
      const start = new Date(exp.startDate).getFullYear();
      const end = exp.endDate.toLowerCase().includes('present')
        ? new Date().getFullYear()
        : new Date(exp.endDate).getFullYear();
      const diff = end - start;
      if (diff > 0 && diff < 40) years += diff;
    } else {
      // If no dates, conservatively count each entry as 1 year
      years += 1;
    }
  }
  return years;
}

/** Parse required years from experience requirement strings */
function parseRequiredYears(requirements: string[]): number | null {
  for (const req of requirements) {
    const m = req.match(/(\d+)\s*\+?\s*(?:to\s*\d+\s*)?years?/i);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/** Keyword overlap fraction between two strings */
function textOverlapScore(source: string, target: string): number {
  const sourceWords = new Set(source.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  const targetWords = target.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (targetWords.length === 0) return 0;
  const matched = targetWords.filter((w) => sourceWords.has(w));
  return matched.length / targetWords.length;
}

// ---------------------------------------------------------------------------
// Per-category scoring
// ---------------------------------------------------------------------------

function scoreSkills(resume: StructuredResume, req: JobRequirements): SkillMatchDetail {
  let { matched: matchedRequired, missing: missingRequired } = findMatchingSkills(
    resume.skills,
    req.requiredSkills,
  );
  let { matched: matchedPreferred, missing: missingPreferred } = findMatchingSkills(
    resume.skills,
    req.preferredSkills,
  );

  // Evidence fallback: a required/preferred skill mentioned anywhere in the
  // resume body (summary, experience, projects, education) counts as present
  // even when the skills-list extraction missed it. This only ever promotes
  // skills with genuine boundary-matched textual evidence — never invents.
  if (missingRequired.length > 0 || missingPreferred.length > 0) {
    const resumeCorpus = [
      resume.summary ?? '',
      resume.skills.join(' '),
      ...resume.experience.map((e) => `${e.title ?? ''} ${e.company ?? ''} ${e.description ?? ''}`),
      ...resume.projects.map((p) => `${p.name ?? ''} ${p.description ?? ''} ${(p.technologies ?? []).join(' ')}`),
      ...resume.education.map((e) => `${e.degree ?? ''} ${e.field ?? ''} ${e.institution ?? ''}`),
    ].join('\n');
    const evidenced = new Set(findSkillsInText(resumeCorpus).map((s) => normalizeSkill(s)));

    const promote = (missing: string[], matched: string[]) => {
      const stillMissing: string[] = [];
      const promoted: string[] = [];
      for (const skill of missing) {
        if (evidenced.has(normalizeSkill(skill))) {
          promoted.push(skill);
        } else {
          stillMissing.push(skill);
        }
      }
      return { matched: [...matched, ...promoted], missing: stillMissing };
    };

    ({ matched: matchedRequired, missing: missingRequired } = promote(missingRequired, matchedRequired));
    ({ matched: matchedPreferred, missing: missingPreferred } = promote(missingPreferred, matchedPreferred));
  }

  const totalRequired = req.requiredSkills.length;
  const totalPreferred = req.preferredSkills.length;

  let score = 0;
  if (totalRequired > 0) {
    score = (matchedRequired.length / totalRequired) * 80;
  } else {
    score = 80; // no required skills specified → full credit for required portion
  }

  if (totalPreferred > 0) {
    score += (matchedPreferred.length / totalPreferred) * 20;
  } else {
    score += 20;
  }

  return {
    matchedRequired,
    missingRequired,
    matchedPreferred,
    missingPreferred,
    scorePercent: clamp(score),
  };
}

function scoreExperience(resume: StructuredResume, req: JobRequirements): ExperienceMatchDetail {
  const requiredYears = parseRequiredYears(req.experienceRequirements);
  const professionalYears = estimateProfessionalYears(resume);
  const internshipMonths = 0; // HF NER does not reliably distinguish internship vs full-time
  const projectCount = resume.projects.length;

  let matchLevel: ExperienceMatchDetail['matchLevel'] = 'unspecified';
  let scorePercent = 70; // baseline when no requirement is stated
  let note = 'No specific experience requirement found in job description.';

  if (requiredYears !== null) {
    if (professionalYears >= requiredYears) {
      matchLevel = 'strong';
      scorePercent = 100;
      note = `Required ${requiredYears}+ years. Detected approximately ${professionalYears} year(s) of recorded experience.`;
    } else if (professionalYears >= requiredYears * 0.6) {
      matchLevel = 'partial';
      scorePercent = 60;
      note = `Required ${requiredYears}+ years. Detected approximately ${professionalYears} year(s) recorded in resume. Gap may be offset by projects or internships.`;
    } else {
      matchLevel = 'insufficient';
      scorePercent = 30;
      note = `Required ${requiredYears}+ years. Detected approximately ${professionalYears} year(s) in resume. Significant experience gap noted.`;
    }
  } else {
    if (resume.experience.length >= 2) {
      matchLevel = 'strong';
      scorePercent = 90;
      note = `${resume.experience.length} position(s) recorded. No explicit year requirement in job description.`;
    } else if (resume.experience.length === 1) {
      matchLevel = 'partial';
      scorePercent = 70;
      note = `1 position recorded. No explicit year requirement in job description.`;
    } else {
      matchLevel = 'insufficient';
      scorePercent = 40;
      note = `No work experience detected in resume. Consider highlighting internships or project work.`;
    }
  }

  return {
    requiredYears,
    detectedProfessionalYears: professionalYears,
    detectedInternshipMonths: internshipMonths,
    detectedProjectCount: projectCount,
    matchLevel,
    scorePercent: clamp(scorePercent),
    note,
  };
}

function scoreEducation(resume: StructuredResume, req: JobRequirements): EducationMatchDetail {
  const required = req.educationRequirements;
  const detected = resume.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(', '));

  if (required.length === 0) {
    return { required, detected, matchLevel: 'strong', scorePercent: 100 };
  }

  if (detected.length === 0) {
    return { required, detected, matchLevel: 'none', scorePercent: 0 };
  }

  // Check degree type match with relaxed matching
  const degreeKeywords = ['bachelor', 'master', 'phd', 'b.tech', 'm.tech', 'b.e', 'm.e', 'b.sc', 'associate', 'doctorate'];
  const fieldKeywords = ['computer science', 'software', 'information technology', 'engineering', 'data science', 'artificial intelligence', 'mathematics', 'statistics'];

  const resumeEduText = detected.join(' ').toLowerCase();
  const reqText = required.join(' ').toLowerCase();

  const degreeMatch = degreeKeywords.some((d) => reqText.includes(d) && resumeEduText.includes(d));
  const relatedField = fieldKeywords.some((f) => resumeEduText.includes(f));

  if (degreeMatch && relatedField) {
    return { required, detected, matchLevel: 'strong', scorePercent: 100 };
  } else if (degreeMatch || relatedField) {
    return { required, detected, matchLevel: 'partial', scorePercent: 70 };
  } else {
    return { required, detected, matchLevel: 'partial', scorePercent: 50 };
  }
}

function scoreResponsibilities(resume: StructuredResume, req: JobRequirements): ResponsibilityMatchDetail {
  if (req.responsibilities.length === 0) {
    return { matched: [], unmatched: [], scorePercent: 80 };
  }

  // Build a corpus from resume experience descriptions and project descriptions
  const resumeCorpus = [
    ...resume.experience.map((e) => e.description ?? ''),
    ...resume.projects.map((p) => p.description ?? ''),
    resume.summary ?? '',
  ].join('\n');

  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const responsibility of req.responsibilities) {
    const overlap = textOverlapScore(resumeCorpus, responsibility);
    if (overlap >= 0.3) {
      matched.push(responsibility);
    } else {
      unmatched.push(responsibility);
    }
  }

  const scorePercent = req.responsibilities.length > 0
    ? clamp((matched.length / req.responsibilities.length) * 100)
    : 80;

  return { matched, unmatched, scorePercent };
}

function scoreKeywords(resume: StructuredResume, req: JobRequirements): KeywordMatchDetail {
  if (req.keywords.length === 0) {
    return { found: [], missing: [], scorePercent: 80 };
  }

  // Build searchable resume text
  const resumeText = [
    resume.summary ?? '',
    resume.skills.join(' '),
    ...resume.experience.map((e) => `${e.title ?? ''} ${e.company ?? ''} ${e.description ?? ''}`),
    ...resume.projects.map((p) => `${p.name ?? ''} ${p.description ?? ''} ${(p.technologies ?? []).join(' ')}`),
    ...resume.education.map((e) => `${e.degree ?? ''} ${e.field ?? ''} ${e.institution ?? ''}`),
  ].join(' ').toLowerCase();

  const found: string[] = [];
  const missing: string[] = [];

  for (const kw of req.keywords) {
    // Use skill-aware matching for tech keywords, substring match for phrases
    const normalizedKw = normalizeSkill(kw).toLowerCase();
    const inResume =
      resumeText.includes(normalizedKw) ||
      resumeText.includes(kw.toLowerCase()) ||
      resume.skills.some((s) => skillsMatch(s, kw));

    if (inResume) {
      found.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const scorePercent = clamp((found.length / req.keywords.length) * 100);
  return { found, missing, scorePercent };
}

function scoreProjects(resume: StructuredResume, req: JobRequirements): ProjectMatchDetail {
  if (resume.projects.length === 0) {
    return { relevantProjects: [], scorePercent: 0 };
  }

  const jdSkillsNorm = [...req.requiredSkills, ...req.preferredSkills].map((s) => normalizeSkill(s));

  const relevantProjects: ProjectRelevance[] = resume.projects.map((project) => {
    const techs = project.technologies ?? [];
    const projectText = `${project.name ?? ''} ${project.description ?? ''} ${techs.join(' ')}`;
    const projectWordsNorm = projectText.toLowerCase().split(/\W+/).filter((w) => w.length > 1);

    const relevantTech = jdSkillsNorm.filter((jdSkill) => {
      return (
        projectWordsNorm.some((w) => w === jdSkill || jdSkill.includes(w) || w.includes(jdSkill)) ||
        techs.some((t) => skillsMatch(t, jdSkill))
      );
    }).map((s) => req.requiredSkills.find((r) => normalizeSkill(r) === s) ?? s);

    const relevancePercent = jdSkillsNorm.length > 0
      ? clamp((relevantTech.length / jdSkillsNorm.length) * 100)
      : 0;

    return {
      name: project.name ?? 'Unnamed Project',
      technologies: techs,
      relevantTech,
      relevancePercent,
    } satisfies ProjectRelevance;
  });

  // Sort by relevance descending
  relevantProjects.sort((a, b) => b.relevancePercent - a.relevancePercent);

  const avgRelevance = relevantProjects.length > 0
    ? relevantProjects.reduce((sum, p) => sum + p.relevancePercent, 0) / relevantProjects.length
    : 0;

  // Bonus for having any project at all
  const scorePercent = relevantProjects.length > 0
    ? clamp(Math.max(20, avgRelevance))
    : 0;

  return { relevantProjects, scorePercent };
}

// ---------------------------------------------------------------------------
// Strengths & recommendations generator
// ---------------------------------------------------------------------------

function buildStrengths(
  breakdown: JobMatchAnalysis['breakdown'],
  skillDetail: SkillMatchDetail,
  _expDetail: ExperienceMatchDetail,
  eduDetail: EducationMatchDetail,
  projDetail: ProjectMatchDetail,
): string[] {
  const strengths: string[] = [];

  if (breakdown.skills >= 80) {
    const n = skillDetail.matchedRequired.length;
    strengths.push(`Strong skills match — ${n} required skill${n !== 1 ? 's' : ''} aligned: ${skillDetail.matchedRequired.slice(0, 4).join(', ')}${n > 4 ? '…' : ''}`);
  }
  if (breakdown.experience >= 80) {
    strengths.push(`Experience level meets or exceeds the job requirement`);
  }
  if (breakdown.education >= 80 && eduDetail.matchLevel === 'strong') {
    strengths.push(`Education background aligns well with job requirements`);
  }
  if (breakdown.responsibilities >= 80) {
    strengths.push(`Resume demonstrates key responsibilities expected for this role`);
  }
  if (breakdown.projects >= 70 && projDetail.relevantProjects.some((p) => p.relevancePercent >= 50)) {
    const topProject = projDetail.relevantProjects[0];
    strengths.push(`Relevant project experience — "${topProject.name}" demonstrates applicable skills`);
  }
  if (breakdown.keywords >= 80) {
    strengths.push(`Good keyword coverage for ATS optimization`);
  }

  return strengths;
}

function buildRecommendations(
  breakdown: JobMatchAnalysis['breakdown'],
  skillDetail: SkillMatchDetail,
  keywordDetail: KeywordMatchDetail,
  respDetail: ResponsibilityMatchDetail,
  eduDetail: EducationMatchDetail,
  projDetail: ProjectMatchDetail,
): JobMatchAnalysis['recommendations'] {
  const recs: JobMatchAnalysis['recommendations'] = [];

  // High priority — missing required skills
  if (skillDetail.missingRequired.length > 0) {
    recs.push({
      priority: 'high',
      text: `Add the following required skills if you have genuine experience with them: ${skillDetail.missingRequired.slice(0, 4).join(', ')}${skillDetail.missingRequired.length > 4 ? '…' : ''}`,
      impact: `+${Math.round(skillDetail.missingRequired.length * 4)} ATS points`,
    });
  }

  // High priority — unmatched responsibilities
  if (respDetail.unmatched.length > 0 && breakdown.responsibilities < 70) {
    recs.push({
      priority: 'high',
      text: `Your experience section does not clearly demonstrate: ${respDetail.unmatched.slice(0, 2).join('; ')}. Add specific examples if applicable.`,
      impact: '+8 ATS points',
    });
  }

  // High priority — education requirement
  if (eduDetail.matchLevel === 'none' && eduDetail.required.length > 0) {
    recs.push({
      priority: 'high',
      text: `Education requirement noted in job posting (${eduDetail.required.slice(0, 2).join('; ')}). Ensure relevant degree or coursework is explicitly documented.`,
      impact: '+5 ATS points',
    });
  }

  // Medium priority — missing keywords
  const importantMissingKw = keywordDetail.missing.slice(0, 5);
  if (importantMissingKw.length > 0 && breakdown.keywords < 75) {
    recs.push({
      priority: 'medium',
      text: `Include these ATS keywords in relevant sections where truthful: ${importantMissingKw.join(', ')}`,
      impact: '+5 ATS points',
    });
  }

  // Medium priority — preferred skills
  if (skillDetail.missingPreferred.length > 0) {
    recs.push({
      priority: 'medium',
      text: `Consider gaining experience in preferred skills: ${skillDetail.missingPreferred.slice(0, 3).join(', ')}`,
      impact: '+3 ATS points',
    });
  }

  // Medium priority — project evidence
  if (projDetail.relevantProjects.length === 0 && breakdown.projects < 50) {
    recs.push({
      priority: 'medium',
      text: 'Add practical project descriptions with technologies used to showcase applied technical competency.',
      impact: '+8 ATS points',
    });
  }

  // Low priority — general experience improvements
  if (breakdown.experience < 60) {
    recs.push({
      priority: 'low',
      text: 'Quantify your experience with specific metrics and years to better demonstrate seniority.',
      impact: '+5 ATS points',
    });
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Main matching function
// ---------------------------------------------------------------------------

/**
 * Compare a StructuredResume against JobRequirements and return a
 * fully explainable JobMatchAnalysis.
 */
export function matchResumeToJob(
  resume: StructuredResume,
  requirements: JobRequirements,
): JobMatchAnalysis {
  const skillDetail = scoreSkills(resume, requirements);
  const experienceDetail = scoreExperience(resume, requirements);
  const educationDetail = scoreEducation(resume, requirements);
  const responsibilityDetail = scoreResponsibilities(resume, requirements);
  const keywordDetail = scoreKeywords(resume, requirements);
  const projectDetail = scoreProjects(resume, requirements);

  const breakdown = {
    skills: skillDetail.scorePercent,
    experience: experienceDetail.scorePercent,
    responsibilities: responsibilityDetail.scorePercent,
    keywords: keywordDetail.scorePercent,
    education: educationDetail.scorePercent,
    projects: projectDetail.scorePercent,
  };

  // Weighted aggregate
  const rawScore =
    breakdown.skills * ATS_MATCH_WEIGHTS.skills +
    breakdown.experience * ATS_MATCH_WEIGHTS.experience +
    breakdown.responsibilities * ATS_MATCH_WEIGHTS.responsibilities +
    breakdown.keywords * ATS_MATCH_WEIGHTS.keywords +
    breakdown.education * ATS_MATCH_WEIGHTS.education +
    breakdown.projects * ATS_MATCH_WEIGHTS.projects;

  const matchScore = clamp(rawScore);
  const category = getMatchCategory(matchScore);

  const strengths = buildStrengths(breakdown, skillDetail, experienceDetail, educationDetail, projectDetail);
  const recommendations = buildRecommendations(
    breakdown,
    skillDetail,
    keywordDetail,
    responsibilityDetail,
    educationDetail,
    projectDetail,
  );

  const overview = strengths.length > 0
    ? `Your resume demonstrates ${strengths[0].toLowerCase().replace(/^your\s+/i, '')}. ${recommendations.length > 0 ? recommendations[0].text : ''}`
    : recommendations.length > 0
      ? recommendations[0].text
      : `Your resume has a ${category.toLowerCase()} against this job description.`;

  return {
    matchScore,
    category,
    overview,
    breakdown,
    matchedSkills: skillDetail.matchedRequired,
    missingRequiredSkills: skillDetail.missingRequired,
    missingPreferredSkills: skillDetail.missingPreferred,
    skillDetail,
    experienceDetail,
    educationDetail,
    responsibilityDetail,
    keywordDetail,
    projectDetail,
    strengths,
    recommendations,
  };
}
