import { DragEvent, FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { ACCEPTED_RESUME_TYPES } from '@/features/resume/types/resume';
import { formatFileSize, validateResumeFile } from '@/features/resume/utils/status';
import type { ResumeListItem } from '@/features/resume/types/resume';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  Loader2,
  Briefcase,
  Type,
  FileUp,
  Info,
} from 'lucide-react';

interface ResumeUploadProps {
  onUploadAndAnalyze: (file: File, jobDescription: string, jobTitle?: string) => Promise<void>;
  onAnalyzeSavedResume?: (
    resumeId: string,
    jobDescription: string,
    jobTitle?: string,
  ) => Promise<void>;
  isUploading: boolean;
  isProcessing: boolean;
  savedResumes?: ResumeListItem[];
  onSelectSavedResume?: (resumeId: string) => void;
  /** Callback to delete a saved resume */
  onDelete?: (resumeId: string) => void;
  /** Compact mode — used inside the two-column hero layout */
  compact?: boolean;
}

export function ResumeUpload({
  onUploadAndAnalyze,
  onAnalyzeSavedResume,
  isUploading,
  isProcessing,
  savedResumes = [],
  onSelectSavedResume,
  onDelete,
  compact = false,
}: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const jdFileInputRef = useRef<HTMLInputElement>(null);

  // Resume Mode: 'upload' | 'saved' | 'paste'
  const [resumeMode, setResumeMode] = useState<'upload' | 'saved' | 'paste'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedResumeText, setPastedResumeText] = useState('');
  const [selectedSavedId, setSelectedSavedId] = useState<string>('');

  // Job Description Mode: 'paste' | 'upload'
  const [jdMode, setJdMode] = useState<'paste' | 'upload'>('paste');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const charCount = jobDescription.length;
  const maxChars = 20000;
  const minChars = 10;
  const isBusy = isUploading || isProcessing;

  function handleFileSelection(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      setError(null);
      return;
    }

    const validationError = validateResumeFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
    } else {
      setError(null);
      setSelectedFile(file);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileSelection(file);
  }

  function handleJdFileUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setJobDescription(text);
        setJdMode('paste');
      }
    };
    reader.readAsText(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (resumeMode === 'saved') {
      if (!selectedSavedId) {
        setError('Please select a saved resume or upload a new file.');
        return;
      }
      if (!jobDescription.trim() || charCount < minChars) {
        setError('Please provide the target Job Description to compare against.');
        return;
      }
      setError(null);
      if (onAnalyzeSavedResume) {
        await onAnalyzeSavedResume(selectedSavedId, jobDescription, jobTitle);
      } else if (onSelectSavedResume) {
        onSelectSavedResume(selectedSavedId);
      }
      return;
    }

    let fileToSubmit = selectedFile;

    // Handle text paste mode by converting to a File object
    if (resumeMode === 'paste') {
      if (!pastedResumeText.trim() || pastedResumeText.length < 20) {
        setError('Please paste your resume text before proceeding.');
        return;
      }
      fileToSubmit = new File([pastedResumeText], 'pasted_resume.txt', { type: 'text/plain' });
    }

    if (!fileToSubmit) {
      setError('Please upload your resume file first.');
      return;
    }

    if (!jobDescription.trim() || charCount < minChars) {
      setError('Please provide the target Job Description to compare against.');
      return;
    }

    const validationError = validateResumeFile(fileToSubmit);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    await onUploadAndAnalyze(fileToSubmit, jobDescription, jobTitle);
  }

  return (
    <div className={compact ? 'w-full space-y-6' : 'space-y-6 rounded-2xl bg-white p-5 sm:p-7 border border-slate-200/90 shadow-sm'}>
      {/* Step 1: Upload Your Resume* */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <span className="text-lg font-extrabold text-[#7C3AED]">①</span>
              <span>Upload Your Resume</span>
              <span className="text-red-500">*</span>
            </h2>
          </div>

          {/* Pill Tabs for Step 1 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setResumeMode('upload')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                resumeMode === 'upload'
                  ? 'border border-[#7C3AED] bg-[#F3E8FF] text-[#7C3AED] shadow-sm'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>Upload File</span>
            </button>

            <button
              type="button"
              onClick={() => setResumeMode('saved')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                resumeMode === 'saved'
                  ? 'border border-[#7C3AED] bg-[#F3E8FF] text-[#7C3AED] shadow-sm'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Saved Resume</span>
            </button>

            <button
              type="button"
              onClick={() => setResumeMode('paste')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                resumeMode === 'paste'
                  ? 'border border-[#7C3AED] bg-[#F3E8FF] text-[#7C3AED] shadow-sm'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              <span>Paste Text</span>
            </button>
          </div>

          {/* Tab 1: Upload File Area */}
          {resumeMode === 'upload' && (
            <div className="space-y-2">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isBusy && inputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-7 transition-all duration-200 ${
                  isDragOver
                    ? 'scale-[0.99] border-[#7C3AED] bg-[#F3E8FF]'
                    : selectedFile
                      ? 'border-emerald-400 bg-emerald-50/50'
                      : 'border-[#C084FC]/70 bg-[#FAF5FF] hover:border-[#7C3AED] hover:bg-[#F3E8FF]/60'
                } ${isBusy ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  ref={inputRef}
                  id="resume-file-input"
                  name="resume-file"
                  type="file"
                  aria-label="Upload resume"
                  accept={ACCEPTED_RESUME_TYPES}
                  className="hidden"
                  onChange={(e) => handleFileSelection(e.target.files?.[0] ?? null)}
                  disabled={isBusy}
                />

                {!selectedFile ? (
                  <div className="flex flex-col items-center space-y-1.5 text-center">
                    <span className="text-[14.5px] font-semibold text-[#7C3AED] hover:underline">
                      Upload new files
                    </span>
                    <p className="text-xs text-slate-500">
                      Drop files here or click to upload.
                    </p>
                  </div>
                ) : (
                  <div
                    className="shadow-xs flex w-full items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-white p-4 dark:bg-slate-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="truncate text-left">
                        <p className="truncate text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatFileSize(selectedFile.size)} • Ready for ATS scan
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Attached
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (inputRef.current) inputRef.current.value = '';
                        }}
                        disabled={isBusy}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Helper Notes below dashed box */}
              <div className="space-y-1 pt-1 text-[11px] text-slate-500 sm:text-xs dark:text-slate-400">
                <p className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>Supported formats: .pdf, .doc, .docx. Max size: 5 MB.</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>All languages supported.</span>
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Use Saved Resume */}
          {resumeMode === 'saved' && (
            <div className="space-y-3 rounded-xl border border-[#EDE4FF] bg-[#FAF5FF] p-4">
              <p className="text-xs font-semibold text-slate-700">
                Select an existing resume from your account:
              </p>
              {savedResumes.length > 0 ? (
                <div className="grid gap-2">
                  {savedResumes.map((res) => (
                    <label
                      key={res.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                        selectedSavedId === res.id
                          ? 'border-[#7C3AED] bg-[#F3E8FF] font-bold text-slate-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-[#C084FC]/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="saved-resume"
                          checked={selectedSavedId === res.id}
                          onChange={() => setSelectedSavedId(res.id)}
                          className="accent-[#007A5A]"
                        />
                        <span className="text-xs">{res.originalFilename}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(res.createdAt).toLocaleDateString()}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-slate-500 dark:text-slate-400">
                  No previously saved resumes found. Please switch to "Upload File" to add your
                  resume.
                </p>
              )}
            </div>
          )}

          {/* Tab 3: Paste Text */}
          {resumeMode === 'paste' && (
            <div className="space-y-2">
              <textarea
                value={pastedResumeText}
                onChange={(e) => setPastedResumeText(e.target.value)}
                placeholder="Paste the raw text of your resume here (Summary, Work Experience, Education, Technical Skills)..."
                rows={6}
                className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-xs text-slate-900 placeholder-slate-400 focus:border-[#007A5A] focus:outline-none focus:ring-2 focus:ring-[#007A5A]/30 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className="text-[11px] text-slate-400">
                {pastedResumeText.length} characters entered
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Add a Job Description* */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <span className="text-lg font-extrabold text-[#7C3AED]">②</span>
              <span>Add a Job Description</span>
              <span className="text-red-500">*</span>
            </h2>
          </div>

          {/* Pill Tabs for Step 2 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setJdMode('paste')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                jdMode === 'paste'
                  ? 'border border-[#7C3AED] bg-[#F3E8FF] text-[#7C3AED] shadow-sm'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              <span>Paste Text</span>
            </button>

            <button
              type="button"
              onClick={() => jdFileInputRef.current?.click()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>Upload File</span>
            </button>
            <input
              ref={jdFileInputRef}
              type="file"
              accept=".txt,.doc,.docx,.pdf"
              className="hidden"
              onChange={(e) => handleJdFileUpload(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Optional Job Title */}
          <div className="space-y-1">
            <label htmlFor="job-title-input" className="block text-xs font-semibold text-slate-700">
              Job Title <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              id="job-title-input"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Backend Engineer / Google"
              disabled={isBusy}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-all focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
            />
          </div>

          {/* Job Description Clean Textarea */}
          <div className="space-y-1.5">
            <textarea
              id="job-description-input"
              name="job-description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here. The more details you provide, the better we can check your resume's fit."
              rows={5}
              disabled={isBusy}
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-[13.5px] text-slate-700 placeholder-slate-400 transition-all focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 resize-y"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {charCount >= minChars ? '✓ Job description provided' : `Minimum ${minChars} characters`}
              </span>
              <span>{charCount.toLocaleString()} / {maxChars.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && <FormMessage message={error} />}

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            id="analyze-resume-btn"
            disabled={isBusy}
            className="px-7 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-60 disabled:scale-100"
            style={{
              background: isBusy
                ? '#9CA3AF'
                : 'linear-gradient(135deg, rgb(124, 58, 237) 0%, rgb(236, 72, 153) 100%)',
              boxShadow: isBusy ? 'none' : 'rgba(124, 58, 237, 0.4) 0px 10px 25px -5px',
            }}
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                <span>Analyzing…</span>
              </>
            ) : (
              <span>Analyze My Resume</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
