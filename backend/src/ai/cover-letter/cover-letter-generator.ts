import { logger } from '../../config/logger.js';
import { aiService } from '../ai.service.js';
import type { StructuredResume } from '../resume/resume-types.js';
import type { JobMatchAnalysis } from '../job/job-types.js';

export interface GenerateCoverLetterOptions {
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateLocation?: string;
  structuredResume?: StructuredResume | null;
  extractedResumeText?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription: string;
  analysisContext?: JobMatchAnalysis | null;
  tone?: 'professional' | 'confident' | 'enthusiastic';
}

export async function generateCoverLetterText(options: GenerateCoverLetterOptions): Promise<string> {
  const {
    candidateName,
    candidateEmail,
    candidatePhone,
    candidateLocation,
    structuredResume,
    extractedResumeText,
    jobTitle,
    companyName,
    jobDescription,
    analysisContext,
    tone = 'professional',
  } = options;

  // Build grounded candidate summary from resume only
  const skillsList = structuredResume?.skills?.length
    ? structuredResume.skills.join(', ')
    : (analysisContext?.matchedSkills || []).join(', ');

  const experiences = structuredResume?.experience?.length
    ? structuredResume.experience
        .map((exp) => `${exp.title || 'Role'} at ${exp.company || 'Company'} (${exp.startDate || ''} - ${exp.endDate || 'Present'}): ${exp.description || ''}`)
        .join('\n')
    : '';

  const matchedStrengths = analysisContext?.strengths?.length
    ? analysisContext.strengths.join('; ')
    : '';

  const prompt = `You are an expert career advisor and executive cover letter writer.
Write an authentic, highly persuasive, customized cover letter for the candidate applying for the target position.

CRITICAL INSTRUCTION - GROUNDING & TRUTHFULNESS:
You MUST NOT invent, exaggerate, or assume any experience, skills, projects, certifications, achievements, companies, dates, or degrees that are not explicitly documented in the provided resume data.
Base every claim on verifiable details from the candidate's actual background.

CANDIDATE INFORMATION:
Name: ${candidateName || 'Candidate'}
Email: ${candidateEmail || ''}
Phone: ${candidatePhone || ''}
Location: ${candidateLocation || ''}
Documented Skills: ${skillsList || 'Not specified'}
Documented Experience:
${experiences || extractedResumeText?.slice(0, 1500) || 'See resume details'}

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
1. Salutation (e.g. "Dear Hiring Manager," or "Dear [Company] Hiring Team,")
2. Engaging opening: State the target role, why the candidate is drawn to the company, and core alignment.
3. Core body paragraphs (1-2 paragraphs): Connect the candidate's verified track record, concrete skills, and accomplishments directly to the key needs of the job description.
4. Closing paragraph: Reiterate value proposition, express enthusiasm for discussion, and offer a professional call-to-action.
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

  // High quality deterministic fallback if AI provider is temporarily unavailable
  const candidate = candidateName || 'Candidate';
  const role = jobTitle || 'the advertised position';
  const company = companyName || 'your organization';

  const skillParagraph = skillsList
    ? `My professional background has enabled me to develop strong competencies in ${skillsList}, which directly correspond with the responsibilities outlined in your job description.`
    : `My technical background and hands-on experience have prepared me to deliver immediate value to your team.`;

  return `Dear Hiring Team at ${company},

I am writing to express my strong interest in the ${role} opportunity at ${company}. With a proven track record of delivering impactful results and a commitment to technical excellence, I am confident in my ability to make a meaningful contribution to your organization.

${skillParagraph} Throughout my career, I have focused on solving complex challenges, optimizing workflows, and collaborating effectively across teams to achieve strategic goals. I am particularly excited about ${company}'s mission and would welcome the opportunity to bring my dedication and experience to your projects.

Thank you for your time and consideration. I welcome the opportunity to discuss how my qualifications align with your team's objectives in greater detail.

Sincerely,

${candidate}
${candidateEmail ? `Email: ${candidateEmail}\n` : ''}${candidatePhone ? `Phone: ${candidatePhone}\n` : ''}`;
}
