// cspell:ignore msword openxmlformats officedocument wordprocessingml
export type ResumeProcessingStatus = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export type ResumeSectionKey =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'education'
  | 'projects'
  | 'certifications'
  | 'other';

export interface ResumeSection {
  key: ResumeSectionKey;
  title: string;
  content: string;
}

export interface PersonalInfo {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
}

export interface ExperienceItem {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface EducationItem {
  degree?: string;
  field?: string;
  institution?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface ProjectItem {
  name?: string;
  description?: string;
  technologies?: string[];
}

export interface CertificationItem {
  name?: string;
  issuer?: string;
  date?: string;
}

export interface StructuredResume {
  personal: PersonalInfo;
  summary?: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  languages?: string[];
  achievements?: string[];
}

export interface StructuredResumeData {
  sections: ResumeSection[];
  skills: string[];
  structuredResume?: StructuredResume;
}

export interface SectionAnalysis {
  key: ResumeSectionKey;
  present: boolean;
  itemCount: number;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface ResumeAnalysis {
  completenessScore: number;
  sectionAnalyses: SectionAnalysis[];
  skillCount: number;
  duplicateSkillCount: number;
  suggestions: string[];
}

export interface ResumeListItem {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  processingStatus: ResumeProcessingStatus;
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeDetail extends ResumeListItem {
  extractedText: string | null;
  structuredData: StructuredResumeData | null;
  analysisResult: ResumeAnalysis | null;
  failureReason: string | null;
}

export interface ResumeListResponse {
  resumes: ResumeListItem[];
}

export interface ResumeDetailResponse {
  resume: ResumeDetail;
}

export const ACCEPTED_RESUME_TYPES =
  '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export const MAX_RESUME_SIZE_LABEL = '5 MB';

// ---------------------------------------------------------------------------
// Job-Specific ATS Match Analysis Types
// ---------------------------------------------------------------------------

export type MatchCategory =
  | 'Excellent Match'
  | 'Strong Match'
  | 'Good Match'
  | 'Moderate Match'
  | 'Low Match';

export interface JobMatchBreakdown {
  skills: number;
  experience: number;
  responsibilities: number;
  keywords: number;
  education: number;
  projects: number;
}

export interface SkillMatchDetail {
  matchedRequired: string[];
  missingRequired: string[];
  matchedPreferred: string[];
  missingPreferred: string[];
  scorePercent: number;
}

export interface ExperienceMatchDetail {
  requiredYears: number | null;
  detectedProfessionalYears: number;
  detectedInternshipMonths: number;
  detectedProjectCount: number;
  matchLevel: 'strong' | 'partial' | 'insufficient' | 'unspecified';
  scorePercent: number;
  note: string;
}

export interface EducationMatchDetail {
  required: string[];
  detected: string[];
  matchLevel: 'strong' | 'partial' | 'none';
  scorePercent: number;
}

export interface ResponsibilityMatchDetail {
  matched: string[];
  unmatched: string[];
  scorePercent: number;
}

export interface KeywordMatchDetail {
  found: string[];
  missing: string[];
  scorePercent: number;
}

export interface ProjectRelevance {
  name: string;
  technologies: string[];
  relevantTech: string[];
  relevancePercent: number;
}

export interface ProjectMatchDetail {
  relevantProjects: ProjectRelevance[];
  scorePercent: number;
}

export interface JobMatchRecommendation {
  priority: 'high' | 'medium' | 'low';
  text: string;
  impact: string;
}

export interface AiInsightStrength {
  title: string;
  explanation: string;
  evidence: string;
}

export interface AiInsightWeakness {
  title: string;
  explanation: string;
  evidence: string;
}

export interface AiInsightRecommendation {
  priority: 'high' | 'medium' | 'low';
  area: string;
  recommendation: string;
  reason: string;
}

export interface AiBulletAnalysis {
  original: string;
  issue: string;
  suggestion: string;
}

export interface AiInsights {
  summary: string;
  strengths: AiInsightStrength[];
  weaknesses: AiInsightWeakness[];
  recommendations: AiInsightRecommendation[];
  bulletAnalysis: AiBulletAnalysis[];
  ragUsed: boolean;
  ragNote?: string;
}

export interface JobMatchAnalysis {
  matchScore: number;
  category: MatchCategory;
  overview: string;
  breakdown: JobMatchBreakdown;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  skillDetail: SkillMatchDetail;
  experienceDetail: ExperienceMatchDetail;
  educationDetail: EducationMatchDetail;
  responsibilityDetail: ResponsibilityMatchDetail;
  keywordDetail: KeywordMatchDetail;
  projectDetail: ProjectMatchDetail;
  strengths: string[];
  recommendations: JobMatchRecommendation[];
  /** RAG/AI insights (optional; deterministic scores stay authoritative). */
  aiInsights?: AiInsights;
}

export interface JobAnalysisListItem {
  id: string;
  resumeId: string;
  jobTitle: string | null;
  matchScore: number;
  category: string;
  createdAt: string;
}

export interface AnalyzeJobResponse {
  success: boolean;
  data: JobMatchAnalysis;
  analysisId: string;
  /** Non-fatal degradation notes from the backend (RAG/AI fallback). */
  warnings?: string[];
}

export interface JobAnalysisDetail {
  success: boolean;
  data: JobMatchAnalysis;
  analysisId: string;
  resumeId: string;
  jobTitle: string | null;
  jobDescription: string;
  createdAt: string;
  warnings?: string[];
}

export interface JobAnalysisListResponse {
  analyses: JobAnalysisListItem[];
}
