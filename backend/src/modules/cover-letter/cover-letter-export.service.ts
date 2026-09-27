import PDFDocument from 'pdfkit';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';

export interface CoverLetterExportMetadata {
  candidateName?: string;
  jobTitle?: string;
  companyName?: string;
}

export class CoverLetterExportService {
  async generatePdf(content: string, metadata: CoverLetterExportMetadata = {}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 54, bottom: 54, left: 54, right: 54 },
        info: {
          Title: `Cover Letter - ${metadata.candidateName || 'Candidate'}`,
          Author: metadata.candidateName || 'Rework CV',
          Subject: 'Cover Letter',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // Header
      if (metadata.candidateName) {
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#114B3E').text(metadata.candidateName);
        doc.moveDown(0.5);
      }

      const subtitleParts: string[] = [];
      if (metadata.jobTitle) subtitleParts.push(`Application for ${metadata.jobTitle}`);
      if (metadata.companyName) subtitleParts.push(`at ${metadata.companyName}`);

      if (subtitleParts.length > 0) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor('#64748B').text(subtitleParts.join(' '));
        doc.moveDown(1.5);
      } else {
        doc.moveDown(1);
      }

      // Date
      doc.font('Helvetica').fontSize(10).fillColor('#64748B').text(new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }));
      doc.moveDown(1.5);

      // Body paragraphs
      doc.font('Helvetica').fontSize(10.5).fillColor('#1E293B').lineGap(4);

      const paragraphs = content.split(/\n\s*\n/);
      for (const p of paragraphs) {
        const trimmed = p.trim();
        if (trimmed) {
          doc.text(trimmed, { align: 'left', lineGap: 4 });
          doc.moveDown(0.8);
        }
      }

      doc.end();
    });
  }

  async generateDocx(content: string, metadata: CoverLetterExportMetadata = {}): Promise<Buffer> {
    const children: Paragraph[] = [];

    if (metadata.candidateName) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          spacing: { before: 0, after: 120 },
          children: [
            new TextRun({
              text: metadata.candidateName,
              bold: true,
              size: 28,
              color: '114B3E',
              font: 'Calibri',
            }),
          ],
        }),
      );
    }

    // Subtitle
    if (metadata.jobTitle || metadata.companyName) {
      const parts = [
        metadata.jobTitle ? `Application for ${metadata.jobTitle}` : '',
        metadata.companyName ? `at ${metadata.companyName}` : '',
      ].filter(Boolean).join(' ');

      children.push(
        new Paragraph({
          spacing: { before: 0, after: 200 },
          children: [
            new TextRun({
              text: parts,
              italics: true,
              size: 20,
              color: '64748B',
              font: 'Calibri',
            }),
          ],
        }),
      );
    }

    // Paragraphs
    const paragraphs = content.split(/\n\s*\n/);
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (trimmed) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 140 },
            children: [
              new TextRun({
                text: trimmed,
                size: 22,
                color: '1E293B',
                font: 'Calibri',
              }),
            ],
          }),
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
            },
          },
          children,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}

export const coverLetterExportService = new CoverLetterExportService();
