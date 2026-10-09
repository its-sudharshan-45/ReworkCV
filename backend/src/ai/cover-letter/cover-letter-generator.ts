import { logger } from '../../config/logger.js';
import { aiService } from '../ai.service.js';
import type { StructuredResume } from '../resume/resume-types.js';
import type { JobMatchAnalysis } from '../job/job-types.js';

export interface GenerateCoverLetterOptions {
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateLocation?: string;
  candidateLinkedin?: string;
  candidateGithub?: string;
  candidatePortfolio?: string;
  structuredResume?: StructuredResume | null;
  extractedResumeText?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription: string;
  analysisContext?: JobMatchAnalysis | null;
  tone?: 'professional' | 'confident' | 'enthusiastic';
  /** Previous draft being revised — when set with userFeedback, rewrite instead of drafting fresh. */
  previousLetter?: string;
  /** The candidate's own requested changes, applied to previousLetter. */
  userFeedback?: string;
}

// Human voice rules shared by fresh drafts and rewrites: the letter must read
// like a real person wrote it, never like AI output.
const HUMAN_VOICE_RULES = `HUMAN VOICE (mandatory — the letter must NOT read as AI-generated):
- Sound like one specific person writing to another: concrete, direct, varied sentence lengths. No ornate or inflated diction.
- FORBIDDEN openers: "I am writing to express my interest", "I am thrilled/excited to apply", "With a proven track record", "I am confident in my ability", "In today's fast-paced world", "I am passionate about".
- FORBIDDEN crutches: em dashes (—), "delve", "leverage" (as verb), "robust", "cutting-edge", "seamless", "thrilled", "spearheaded", "utilize" (use "use"), "myriad", "tapestry", "landscape" (metaphorical), "I believe", "very/really" intensifiers, triplet parallelism ("I build, I lead, I deliver").
- Prefer plain verbs and specific facts: what you built, who used it, what changed. One idea per sentence.
- NEVER use bracket placeholders like [Hiring Organization] or [Company]. If the company name is unknown, address "the hiring team" and name only the role; never invent a company name.
- Contractions are allowed where natural ("I'm", "you'll"). Do not overdo them.
- Keep it to 3 short paragraphs plus greeting and sign-off. No headers, no subject lines, no meta commentary.`;

export async function generateCoverLetterText(options: GenerateCoverLetterOptions): Promise<string> {
  const {
    candidateName,
    candidateEmail,
    candidatePhone,
    candidateLocation,
    candidateLinkedin,
    candidateGithub,
    candidatePortfolio,
    structuredResume,
    extractedResumeText,
    jobTitle,
    companyName,
    jobDescription,
    analysisContext,
    tone = 'professional',
    previousLetter,
    userFeedback,
  } = options;

  // Build grounded candidate summary from the analyzed resume only. Every
  // section below comes from the stored parsed resume — never defaults.
  const skillsList = structuredResume?.skills?.length
    ? structuredResume.skills.join(', ')
    : (analysisContext?.matchedSkills || []).join(', ');

  const experiences = structuredResume?.experience?.length
    ? structuredResume.experience
        .map((exp) => `${exp.title || 'Role'} at ${exp.company || 'Company'} (${exp.startDate || ''} - ${exp.endDate || 'Present'}): ${exp.description || ''}`)
        .join('\n')
    : '';

  const educationList = structuredResume?.education?.length
    ? structuredResume.education
        .map((edu) => [edu.degree, edu.field, edu.institution].filter(Boolean).join(', '))
        .filter(Boolean)
        .join('\n')
    : '';

  const projectList = structuredResume?.projects?.length
    ? structuredResume.projects
        .map((project) => {
          const tech = project.technologies?.length ? ` [${project.technologies.join(', ')}]` : '';
          return `${project.name || 'Project'}${tech}: ${project.description || ''}`;
        })
        .join('\n')
    : '';

  const matchedStrengths = analysisContext?.strengths?.length
    ? analysisContext.strengths.join('; ')
    : '';

  const trimmedFeedback = (userFeedback ?? '').trim();
  const isRewrite = trimmedFeedback.length > 0 && (previousLetter ?? '').trim().length > 0;

  const taskBlock = isRewrite
    ? `REWRITE TASK:
Below is the candidate's current cover letter draft followed by THEIR OWN requested changes.
Revise the draft to apply exactly what they asked for. Preserve everything they did not ask to change — same facts, same structure, same length unless they asked otherwise.
Grounding rules still apply: do not invent experience, skills, metrics or companies while revising.

CURRENT DRAFT:
${(previousLetter ?? '').trim().slice(0, 4000)}

CANDIDATE'S REQUESTED CHANGES:
${trimmedFeedback.slice(0, 2000)}`
    : `Write an authentic, highly persuasive, customized cover letter for the candidate applying for the target position.`;

  const prompt = `You are an expert career advisor and executive cover letter writer.
${taskBlock}

${HUMAN_VOICE_RULES}

CRITICAL INSTRUCTION - GROUNDING & TRUTHFULNESS:
You MUST NOT invent, exaggerate, or assume any experience, skills, projects, certifications, achievements, companies, dates, or degrees that are not explicitly documented in the provided resume data.
Base every claim on verifiable details from the candidate's actual background.

IDENTITY (mandatory — the candidate's exact resume details):
- Sign off with the candidate name below using its EXACT spelling and casing. Do not expand, shorten, title-case, uppercase, or otherwise alter it in any way.
- Reproduce the email, phone, LinkedIn, GitHub, and portfolio URLs EXACTLY as given below, or omit them if blank. Never invent, guess, reformat, or substitute contact details or links.
- Every fact in the letter (education, experience, skills, projects) must come from the documented resume sections below. Never substitute details from any other source.
- The candidate is the author of this letter: never address any part of the letter to the candidate, and never sign with any other name.

CANDIDATE INFORMATION:
Name: ${candidateName || 'Candidate'}
Email: ${candidateEmail || ''}
Phone: ${candidatePhone || ''}
Location: ${candidateLocation || ''}
LinkedIn: ${candidateLinkedin || ''}
GitHub: ${candidateGithub || ''}
Portfolio: ${candidatePortfolio || ''}
Documented Skills: ${skillsList || 'Not specified'}
Documented Experience:
${experiences || extractedResumeText?.slice(0, 1500) || 'See resume details'}
Documented Education:
${educationList || 'See resume details'}
Notable Projects:
${projectList || 'See resume details'}

TARGET OPPORTUNITY:
Target Job Title: ${jobTitle || 'Target Position'}
Company Name: ${companyName || 'Hiring Organization'}
Job Description:
${jobDescription.slice(0, 3000)}

ANALYSIS CONTEXT:
Identified Strengths / Relevant Matches: ${matchedStrengths || 'Skills and background align with key requirements'}

TONE & STYLE:
Tone: ${tone}
Style: Contemporary, concise, compelling, professional.
Structure:
1. Salutation (e.g. "Dear Hiring Manager," or "Dear hiring team,")
2. Opening: State the target role in one plain sentence and why this specific work fits the candidate's background.
3. Core body paragraphs (1-2 paragraphs): Connect the candidate's verified track record, concrete skills, and accomplishments directly to the key needs of the job description.
4. Closing paragraph: Reiterate value in one sentence and offer a plain call-to-action (a conversation), without gushing.
5. Sign-off: "Sincerely," followed by candidate's name and contact info.

Output ONLY the final cover letter text without additional preamble or meta commentary.`;

  try {
    const result = await aiService.complete({
      messages: [
        {
          role: 'system',
          content:
            'You are an elite professional cover letter writer who writes tailored, compelling, and 100% truthful cover letters grounded strictly in real resume data.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 1500,
    });

    const trimmed = result.content.trim();
    if (trimmed.length > 50) {
      return trimmed;
    }
  } catch (err) {
    logger.warn({ err }, 'AI Cover letter generation failed, falling back to deterministic template');
  }

  // Plain-spoken deterministic fallback if the AI provider is unavailable.
  const candidate = candidateName || 'Candidate';
  const role = jobTitle || 'the advertised position';

  const skillSentence = skillsList
    ? `My work has centered on ${skillsList}, which maps directly onto what this role requires.`
    : `My hands-on background has prepared me to contribute to your team quickly.`;

  return `Dear Hiring Manager,

I am applying for the ${role}. ${skillSentence}

In my recent work I have focused on shipping reliable software, cutting through ambiguity, and working closely with the people around me to get things done well. I pay attention to the details that affect users and I follow through on what I commit to.

I would welcome the chance to talk about how I can help your team. Thank you for your consideration.

Sincerely,

${candidate}
${candidateEmail ? `Email: ${candidateEmail}\n` : ''}${candidatePhone ? `Phone: ${candidatePhone}\n` : ''}${candidateLinkedin ? `LinkedIn: ${candidateLinkedin}\n` : ''}${candidateGithub ? `GitHub: ${candidateGithub}\n` : ''}${candidatePortfolio ? `Portfolio: ${candidatePortfolio}\n` : ''}`;
}
