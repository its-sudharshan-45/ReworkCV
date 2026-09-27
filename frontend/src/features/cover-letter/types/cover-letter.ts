export interface CoverLetter {
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

export interface GenerateCoverLetterPayload {
  resumeId: string;
  jobAnalysisId?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  tone?: 'professional' | 'confident' | 'enthusiastic';
}
