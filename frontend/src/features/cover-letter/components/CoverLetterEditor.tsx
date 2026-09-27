import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  RotateCw,
  Save,
  FileText,
  Sparkles,
  Loader2,
  FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CoverLetter } from '../types/cover-letter';
import {
  updateCoverLetter,
  generateCoverLetter,
  downloadCoverLetterFile,
} from '../api/cover-letter.api';

interface CoverLetterEditorProps {
  coverLetter: CoverLetter;
  onUpdate?: (updated: CoverLetter) => void;
}

export function CoverLetterEditor({ coverLetter, onUpdate }: CoverLetterEditorProps) {
  const [content, setContent] = useState(coverLetter.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await updateCoverLetter(coverLetter.id, content);
      onUpdate?.(res.coverLetter);
      setFeedback('Cover letter saved successfully.');
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback('Failed to save cover letter changes.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    setFeedback(null);
    try {
      const res = await generateCoverLetter({
        resumeId: coverLetter.resumeId,
        jobAnalysisId: coverLetter.jobAnalysisId ?? undefined,
        jobTitle: coverLetter.jobTitle ?? undefined,
        companyName: coverLetter.companyName ?? undefined,
        jobDescription: coverLetter.jobDescription,
        tone: (coverLetter.tone as 'professional') || 'professional',
      });
      setContent(res.coverLetter.content);
      onUpdate?.(res.coverLetter);
      setFeedback('New personalized cover letter generated.');
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback('Failed to regenerate cover letter. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleDownload(format: 'pdf' | 'docx') {
    if (format === 'pdf') setIsDownloadingPdf(true);
    if (format === 'docx') setIsDownloadingDocx(true);
    try {
      await downloadCoverLetterFile(coverLetter.id, format);
    } catch {
      setFeedback(`Failed to download ${format.toUpperCase()}.`);
    } finally {
      if (format === 'pdf') setIsDownloadingPdf(false);
      if (format === 'docx') setIsDownloadingDocx(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header and Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#16A36A]" />
            Cover Letter Editor
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {coverLetter.jobTitle ? `Tailored for ${coverLetter.jobTitle}` : 'Customized Cover Letter'}
            {coverLetter.companyName ? ` at ${coverLetter.companyName}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Copy Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="rounded-xl text-xs font-semibold gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </Button>

          {/* Regenerate Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="rounded-xl text-xs font-semibold gap-1.5"
          >
            {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            <span>Regenerate</span>
          </Button>

          {/* PDF Download */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDownload('pdf')}
            disabled={isDownloadingPdf}
            className="rounded-xl text-xs font-semibold gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
          >
            {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>PDF</span>
          </Button>

          {/* DOCX Download */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDownload('docx')}
            disabled={isDownloadingDocx}
            className="rounded-xl text-xs font-semibold gap-1.5 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800"
          >
            {isDownloadingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            <span>DOCX</span>
          </Button>

          {/* Save Button */}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl text-xs font-bold gap-1.5 bg-[#16A36A] hover:bg-[#138A5A] text-white"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save</span>
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
          {feedback}
        </div>
      )}

      {/* Editor Canvas */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          className="w-full p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-normal text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#16A36A] resize-y"
          placeholder="Your cover letter content..."
        />
        <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span>Words: {content.trim().split(/\s+/).filter(Boolean).length}</span>
          <span>100% grounded in your actual uploaded resume</span>
        </div>
      </div>
    </div>
  );
}
