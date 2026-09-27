import type { ResumeListItem } from '@/features/resume/types/resume';
import { ResumeCard } from '@/features/resume/components/ResumeCard';

interface ResumeListProps {
  resumes: ResumeListItem[];
  selectedResumeId: string | null;
  onSelect: (resumeId: string) => void;
  onDelete: (resumeId: string) => void;
  deletingResumeId: string | null;
}

export function ResumeList({
  resumes,
  selectedResumeId,
  onSelect,
  onDelete,
  deletingResumeId,
}: ResumeListProps) {
  if (resumes.length === 0) {
    return (
      <div className="bg-card text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        No resumes uploaded yet. Upload a PDF or text resume to get started.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {resumes.map((resume) => (
        <ResumeCard
          key={resume.id}
          resume={resume}
          selected={selectedResumeId === resume.id}
          onSelect={onSelect}
          onDelete={onDelete}
          isDeleting={deletingResumeId === resume.id}
        />
      ))}
    </div>
  );
}
