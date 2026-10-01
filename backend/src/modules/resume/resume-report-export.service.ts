import PDFDocument from 'pdfkit';
import type { ResumeDetailResponse } from './resume.types.js';
import type { JobMatchAnalysis } from '../../ai/job/job-types.js';
import {
  buildReportData,
  scanForForbiddenValues,
  validateReportScores,
  type ReportData,
} from './resume-report-data.js';

export interface ReportPdfValidation {
  forbiddenTokens: string[];
  scoreErrors: string[];
  valid: boolean;
}

export function validateReportPdfData(report: ReportData, analysis?: JobMatchAnalysis | null): ReportPdfValidation {
  const forbiddenTokens = scanForForbiddenValues(report);
  const scoreErrors = validateReportScores(report, analysis);
  return { forbiddenTokens, scoreErrors, valid: forbiddenTokens.length === 0 && scoreErrors.length === 0 };
}

export class ResumeReportExportService {
  buildData(
    resume: ResumeDetailResponse,
    analysis?: JobMatchAnalysis | null,
    jobTitle?: string | null,
  ): ReportData {
    return buildReportData({ resume, analysis, jobTitle });
  }

  async generateReportPdf(
    resume: ResumeDetailResponse,
    analysis?: JobMatchAnalysis | null,
    jobTitle?: string | null,
  ): Promise<Buffer> {
    const report = buildReportData({ resume, analysis, jobTitle });

    const validation = validateReportPdfData(report, analysis);
    if (!validation.valid) {
      throw new Error(
        `Report data validation failed: ${[...validation.forbiddenTokens, ...validation.scoreErrors].join('; ')}`,
      );
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 50, left: 45, right: 45 },
        info: {
          Title: `Resume Analysis Report - ${report.candidate.filename}`,
          Author: 'Rework CV',
          Subject: 'ATS Resume Analysis Report',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const pageWidth = 505;
      const left = 45;

      const sectionTitle = (title: string) => {
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#114B3E').text(title);
        doc.moveDown(0.3);
        doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).stroke();
        doc.moveDown(0.5);
      };

      const body = (text: string) => {
        doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(text, { lineGap: 3 });
      };

      const bullet = (text: string) => {
        doc.font('Helvetica').fontSize(9).fillColor('#1E293B').text(`- ${text}`, { lineGap: 2 });
      };

      // ---- Header ----
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#114B3E').text('Rework CV - Resume Intelligence Report');
      doc.moveDown(0.3);
      const headerMeta: string[] = [`File: ${report.candidate.filename}`, `Date: ${report.overview.reportDate}`];
      if (report.candidate.name) headerMeta.push(`Candidate: ${report.candidate.name}`);
      if (report.overview.targetRole) headerMeta.push(`Target role: ${report.overview.targetRole}`);
      if (report.candidate.emailMasked) headerMeta.push(`Email: ${report.candidate.emailMasked}`);
      if (report.candidate.phoneMasked) headerMeta.push(`Phone: ${report.candidate.phoneMasked}`);
      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(headerMeta.join('  |  '));
      doc.moveDown(1);

      // ---- Score banner (exact deterministic scores) ----
      const score = report.scores.overall;
      const bannerY = doc.y;
      doc.rect(left, bannerY, pageWidth, 56).fillAndStroke('#F0FDF4', '#86EFAC');
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#16A36A').text(`${score}/100`, left + 15, bannerY + 13);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#114B3E')
        .text(`Overall Match Score${report.overview.category ? ` - ${report.overview.category}` : ''}`, left + 105, bannerY + 13);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#475569')
        .text(
          `Deterministic ATS scoring across skills, experience, responsibilities, keywords, education and projects. ${report.overview.suggestionCount} improvement(s) identified.`,
          left + 105,
          bannerY + 29,
          { width: pageWidth - 120 },
        );
      doc.y = bannerY + 68;

      // ---- Overview ----
      sectionTitle('1. Overview');
      if (report.overview.summary) {
        body(report.overview.summary);
        doc.moveDown(0.6);
      }
      if (report.overview.strengths?.length) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#166534').text('Key Strengths');
        doc.moveDown(0.3);
        for (const s of report.overview.strengths) bullet(s);
        doc.moveDown(0.6);
      }
      if (report.overview.improvements?.length) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#B45309').text('Key Improvements');
        doc.moveDown(0.3);
        for (const s of report.overview.improvements.slice(0, 8)) bullet(s);
        doc.moveDown(0.6);
      }

      // ---- Score breakdown (exact values) ----
      if (report.scores.breakdown) {
        sectionTitle('2. Score Breakdown (deterministic)');
        const b = report.scores.breakdown;
        const rows: Array<[string, number, string]> = [
          ['Skills', b.skills, '40% weight'],
          ['Experience', b.experience, '20% weight'],
          ['Responsibilities', b.responsibilities, '15% weight'],
          ['Keywords', b.keywords, '10% weight'],
          ['Education', b.education, '5% weight'],
          ['Projects', b.projects, '10% weight'],
        ];
        for (const [label, value, weight] of rows) {
          doc.font('Helvetica').fontSize(9).fillColor('#1E293B').text(`${label}: ${value}/100 (${weight})`, { lineGap: 2 });
        }
        doc.moveDown(0.8);
      }

      // ---- Content ----
      if (report.content) {
        sectionTitle('3. Content Analysis');
        if (report.content.score !== undefined) {
          doc.font('Helvetica').fontSize(9).fillColor('#1E293B').text(`Content score: ${report.content.score}/100`);
          doc.moveDown(0.3);
        }
        if (report.content.summaryText) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#114B3E').text('Summary');
          body(report.content.summaryText);
          doc.moveDown(0.4);
        }
        if (report.content.experienceText) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#114B3E').text('Experience (extracted)');
          body(report.content.experienceText.slice(0, 2000));
          doc.moveDown(0.4);
        }
        if (report.content.keywordsFound?.length || report.content.keywordsMissing?.length) {
          if (report.content.keywordsFound?.length) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#166534').text('Keywords found');
            body(report.content.keywordsFound.join(', '));
            doc.moveDown(0.3);
          }
          if (report.content.keywordsMissing?.length) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#B91C1C').text('Keywords missing');
            body(report.content.keywordsMissing.join(', '));
            doc.moveDown(0.3);
          }
        }
        if (report.content.bulletImprovements?.length) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#114B3E').text('Rewrite suggestions');
          doc.moveDown(0.2);
          for (const item of report.content.bulletImprovements.slice(0, 6)) {
            if (item.issue) bullet(`Issue: ${item.issue}`);
            if (item.suggestion) {
              doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#475569').text(`Suggestion: ${item.suggestion}`, { lineGap: 2 });
              doc.font('Helvetica').fillColor('#1E293B');
            }
          }
          doc.moveDown(0.4);
        }
      }

      // ---- Skills ----
      if (report.skills) {
        sectionTitle('4. Skills Analysis');
        if (report.skills.matchedRequired?.length) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#166534').text('Matched required skills');
          body(report.skills.matchedRequired.join(', '));
          doc.moveDown(0.4);
        }
        if (report.skills.missingRequired?.length) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#B91C1C').text('Missing required skills');
          body(report.skills.missingRequired.join(', '));
          doc.moveDown(0.3);
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748B').text('Only claim skills you genuinely have.', { lineGap: 2 });
          doc.font('Helvetica').fillColor('#1E293B');
          doc.moveDown(0.4);
        }
        if (report.skills.matchedPreferred?.length) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#1D4ED8').text('Matched preferred skills');
          body(report.skills.matchedPreferred.join(', '));
          doc.moveDown(0.4);
        }
        if (report.skills.missingPreferred?.length) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#B45309').text('Missing preferred skills');
          body(report.skills.missingPreferred.join(', '));
          doc.moveDown(0.4);
        }
      }

      // ---- Format (only existing checks) ----
      if (report.format) {
        sectionTitle('5. Format Analysis');
        if (report.format.experience) {
          const e = report.format.experience;
          body(
            `Experience: required ${e.requiredYears !== null && e.requiredYears !== undefined ? `${e.requiredYears} yr(s)` : 'not specified'}; detected ${e.detectedProfessionalYears} yr(s); level ${e.matchLevel}; score ${e.scorePercent}/100.`,
          );
          if (e.note) {
            doc.moveDown(0.2);
            body(e.note);
          }
          doc.moveDown(0.4);
        }
        if (report.format.education) {
          const e = report.format.education;
          body(`Education match: ${e.matchLevel}; score ${e.scorePercent}/100.`);
          if (e.detected.length > 0) {
            doc.moveDown(0.2);
            body(`Detected: ${e.detected.join('; ')}`);
          }
          doc.moveDown(0.4);
        }
      }

      // ---- Sections ----
      if (report.sections) {
        sectionTitle('6. Sections Analysis');
        if (report.sections.present.length > 0) {
          for (const s of report.sections.present) {
            bullet(`${s.title}: present`);
          }
          doc.moveDown(0.4);
        }
        if (report.sections.educationMatch) {
          body(`Education match level: ${report.sections.educationMatch}`);
          doc.moveDown(0.4);
        }
      }

      // ---- Style (only existing findings) ----
      if (report.style) {
        sectionTitle('7. Style Analysis');
        if (report.style.responsibilitiesMatched?.length) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#166534').text('Responsibilities aligned');
          doc.moveDown(0.2);
          for (const r of report.style.responsibilitiesMatched.slice(0, 6)) bullet(r);
          doc.moveDown(0.4);
        }
        if (report.style.responsibilitiesUnmatched?.length) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#B45309').text('Responsibilities to evidence');
          doc.moveDown(0.2);
          for (const r of report.style.responsibilitiesUnmatched.slice(0, 6)) bullet(r);
          doc.moveDown(0.4);
        }
        if (report.style.relevantProjects?.length) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#114B3E').text('Relevant projects');
          doc.moveDown(0.2);
          for (const p of report.style.relevantProjects.slice(0, 5)) {
            bullet(`${p.name} (${p.relevancePercent}% match${p.relevantTech.length > 0 ? `: ${p.relevantTech.join(', ')}` : ''})`);
          }
          doc.moveDown(0.4);
        }
      }

      // ---- Action plan (existing recommendations only) ----
      if (report.action_plan) {
        sectionTitle('8. Action Plan');
        if (report.action_plan.quickWins?.length) {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#B91C1C').text('Quick wins');
          doc.moveDown(0.3);
          for (const r of report.action_plan.quickWins) {
            bullet(`[HIGH] ${r.text}`);
            if (r.impact) {
              doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748B').text(`Impact: ${r.impact}`, { lineGap: 2 });
              doc.font('Helvetica').fillColor('#1E293B');
            }
          }
          doc.moveDown(0.5);
        }
        const remaining = report.action_plan.prioritized.filter((r) => r.priority !== 'high').slice(0, 8);
        if (remaining.length > 0) {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#114B3E').text('Prioritized improvements');
          doc.moveDown(0.3);
          for (const r of remaining) {
            bullet(`[${r.priority.toUpperCase()}] ${r.text}`);
          }
          doc.moveDown(0.5);
        }
        if (report.action_plan.keywordsToConsider?.length) {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#114B3E').text('Keywords to consider (only where truthful)');
          doc.moveDown(0.3);
          body(report.action_plan.keywordsToConsider.join(', '));
          doc.moveDown(0.5);
        }
      }

      // ---- AI insights (additional only; never overrides scores) ----
      if (report.aiSummary) {
        sectionTitle('Appendix: AI Insights (contextual guidance)');
        body(report.aiSummary);
        doc.moveDown(0.4);
        if (report.action_plan?.aiActions?.length) {
          for (const a of report.action_plan.aiActions) {
            bullet(`[${a.priority.toUpperCase()}] ${a.recommendation}`);
          }
          doc.moveDown(0.4);
        }
      }

      // ---- Footer ----
      doc.moveDown(1);
      doc.font('Helvetica').fontSize(8).fillColor('#94A3B8').text(
        'Generated by Rework CV - Confidential Career Report. Scores are deterministic and derived from the existing analysis engine.',
        { align: 'center' },
      );

      doc.end();
    });
  }
}

export const resumeReportExportService = new ResumeReportExportService();
