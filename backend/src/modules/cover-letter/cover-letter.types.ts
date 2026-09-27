export interface CoverLetterRecord {
  id: string;
  user_id: string;
  resume_id: string;
  job_analysis_id: string | null;
  job_title: string | null;
  company_name: string | null;
  job_description: string;
  content: string;
  tone: string;
  created_at: string;
  updated_at: string;
}

export interface CoverLetterResponse {
  id: string;
  userId: string;
  resumeId: string;
  jobAnalysisId: string | null;
  jobTitle: string | null;
  companyName: string | null;
  jobDescription: string;
  content: string;
  tone: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateCoverLetterInput {
  resumeId: string;
  jobAnalysisId?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  tone?: 'professional' | 'confident' | 'enthusiastic';
}

export interface UpdateCoverLetterInput {
  content: string;
}
