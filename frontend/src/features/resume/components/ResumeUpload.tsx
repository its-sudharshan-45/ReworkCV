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
}

export function ResumeUpload({
  onUploadAndAnalyze,
  onAnalyzeSavedResume,
  isUploading,
  isProcessing,
  savedResumes = [],
  onSelectSavedResume,
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
    <div className="space-y-8 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-10 dark:border-slate-800 dark:bg-slate-900">
      {/* Header matching user image */}
      <div className="space-y-2 text-left">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#114B3E] sm:text-3xl lg:text-4xl dark:text-emerald-400">
          Secure Your Interview Chances With a Tailored Resume
        </h1>
        <p className="text-sm font-normal text-slate-600 sm:text-base dark:text-slate-400">
          Turn applications into interviews with personalized suggestions, ATS scoring and matching
          cover letters.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Upload Your Resume* */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 sm:text-lg dark:text-slate-200">
              <span className="text-lg font-extrabold text-[#114B3E] dark:text-emerald-400">①</span>
              <span>Upload Your Resume</span>
              <span className="text-red-500">*</span>
            </h2>
          </div>

          {/* Pill Tabs for Step 1 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setResumeMode('upload')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                resumeMode === 'upload'
                  ? 'shadow-xs border-2 border-[#007A5A] bg-[#007A5A]/5 font-bold text-[#007A5A] dark:bg-[#007A5A]/15'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>Upload File</span>
            </button>

            <button
              type="button"
              onClick={() => setResumeMode('saved')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                resumeMode === 'saved'
                  ? 'shadow-xs border-2 border-[#007A5A] bg-[#007A5A]/5 font-bold text-[#007A5A] dark:bg-[#007A5A]/15'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Use Saved Resume</span>
            </button>

            <button
              type="button"
              onClick={() => setResumeMode('paste')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                resumeMode === 'paste'
                  ? 'shadow-xs border-2 border-[#007A5A] bg-[#007A5A]/5 font-bold text-[#007A5A] dark:bg-[#007A5A]/15'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
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
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all duration-200 sm:p-10 ${
                  isDragOver
                    ? 'scale-[0.99] border-[#007A5A] bg-[#007A5A]/10'
                    : selectedFile
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-slate-300 bg-[#F7FAF8] hover:border-[#007A5A] dark:border-slate-700 dark:bg-slate-800/40'
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
                    <span className="text-sm font-bold text-[#007A5A] hover:underline sm:text-base dark:text-emerald-400">
                      Upload new files
                    </span>
                    <p className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
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
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-[#F7FAF8] p-5 dark:border-slate-800 dark:bg-slate-800/40">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select an existing resume from your account:
              </p>
              {savedResumes.length > 0 ? (
                <div className="grid gap-2">
                  {savedResumes.map((res) => (
                    <label
                      key={res.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                        selectedSavedId === res.id
                          ? 'border-[#007A5A] bg-[#007A5A]/10 font-bold text-slate-900 dark:text-slate-100'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
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
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 sm:text-lg dark:text-slate-200">
              <span className="text-lg font-extrabold text-[#114B3E] dark:text-emerald-400">②</span>
              <span>Add a Job Description</span>
              <span className="text-red-500">*</span>
            </h2>
          </div>

          {/* Pill Tabs for Step 2 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setJdMode('paste')}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                jdMode === 'paste'
                  ? 'shadow-xs border-2 border-[#007A5A] bg-[#007A5A]/5 font-bold text-[#007A5A] dark:bg-[#007A5A]/15'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              <span>Paste Text</span>
            </button>

            <button
              type="button"
              onClick={() => jdFileInputRef.current?.click()}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800`}
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
            <label
              htmlFor="job-title-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Job Title <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              id="job-title-input"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              disabled={isBusy}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-all focus:border-[#007A5A] focus:outline-none focus:ring-2 focus:ring-[#007A5A]/30 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
              rows={6}
              disabled={isBusy}
              className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-xs text-slate-900 placeholder-slate-400 transition-all focus:border-[#007A5A] focus:outline-none focus:ring-2 focus:ring-[#007A5A]/30 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {charCount >= minChars
                  ? '✓ Job description provided'
                  : `Minimum ${minChars} characters`}
              </span>
              <span>
                {charCount.toLocaleString()} / {maxChars.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && <FormMessage message={error} />}

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={isBusy}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#007A5A] py-4 text-sm font-bold text-white shadow-md shadow-[#007A5A]/20 transition-all hover:bg-[#006349] sm:py-5 sm:text-base"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Running AI ATS Match Analysis…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 text-emerald-200" />
                <span>Scan & Tailor Resume Fit</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
