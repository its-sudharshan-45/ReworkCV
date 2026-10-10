import { z } from 'zod';

// Resource IDs travel as opaque strings (Supabase UUIDs in production, but
// tests and future key formats use other shapes). Ownership and existence are
// enforced in the service layer via user-scoped repository queries — these
// schemas only guarantee shape and length so malformed payloads fail fast
// with a consistent 400 VALIDATION_ERROR instead of reaching the database.
const resourceId = z.string().min(1, 'ID must not be empty').max(200);

export const generateCoverLetterSchema = z.object({
  resumeId: resourceId,
  jobAnalysisId: resourceId.optional(),
  jobTitle: z.string().max(200, 'Job title must be 200 characters or fewer').optional(),
  companyName: z.string().max(200, 'Company name must be 200 characters or fewer').optional(),
  jobDescription: z
    .string()
    .max(20_000, 'Job description must be 20000 characters or fewer')
    .optional(),
  tone: z.enum(['professional', 'confident', 'enthusiastic']).optional(),
});

export const updateCoverLetterSchema = z.object({
  content: z
    .string()
    .min(1, 'Cover letter content is required')
    .max(20_000, 'Cover letter content must be 20000 characters or fewer'),
});

export const rewriteCoverLetterSchema = z.object({
  feedback: z
    .string()
    .min(3, 'Please describe the changes you would like (at least 3 characters)')
    .max(2000, 'Feedback must be 2000 characters or fewer'),
});
