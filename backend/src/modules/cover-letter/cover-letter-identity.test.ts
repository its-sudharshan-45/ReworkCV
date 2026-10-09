import { describe, expect, it } from 'vitest';
import {
  enforceSignatureIdentity,
  extractEmailFromText,
  extractGithubUrl,
  extractLinkedinUrl,
  extractNameFromResumeHeader,
  extractPortfolioUrl,
  resolveCandidateIdentity,
} from './cover-letter-identity.js';

const RESUME_TEXT = `Sudharshan N
Full Stack Developer
its.sudharshan.in@gmail.com | +91 98765 43210

SKILLS
HTML, CSS, JavaScript, Node.js, Express, MongoDB

EXPERIENCE
Intern at OneDot Communications
Built a Student Record Manager using Node.js and MongoDB.`;

describe('extractNameFromResumeHeader', () => {
  it('finds the name on the first line', () => {
    expect(extractNameFromResumeHeader(RESUME_TEXT)).toBe('Sudharshan N');
  });

  it('skips role-like lines and email lines', () => {
    const text = `Full Stack Developer
Jane Doe
jane@example.com`;
    expect(extractNameFromResumeHeader(text)).toBe('Jane Doe');
  });

  it('returns undefined when no name-like line exists', () => {
    expect(extractNameFromResumeHeader('Experienced engineer with many skills.')).toBeUndefined();
    expect(extractNameFromResumeHeader('')).toBeUndefined();
    expect(extractNameFromResumeHeader(null)).toBeUndefined();
  });
});

describe('extractEmailFromText', () => {
  it('finds the first email address', () => {
    expect(extractEmailFromText(RESUME_TEXT)).toBe('its.sudharshan.in@gmail.com');
  });

  it('returns undefined when absent', () => {
    expect(extractEmailFromText('No contact here')).toBeUndefined();
  });
});

describe('extract social links', () => {
  const textWithLinks = `Jane Doe
https://linkedin.com/in/janedoe
https://github.com/janedoe
Portfolio: https://janedoe.dev/work
Contact: jane@example.com`;

  it('finds LinkedIn, GitHub, and portfolio URLs from resume text', () => {
    expect(extractLinkedinUrl(textWithLinks)).toBe('https://linkedin.com/in/janedoe');
    expect(extractGithubUrl(textWithLinks)).toBe('https://github.com/janedoe');
    expect(extractPortfolioUrl(textWithLinks)).toBe('https://janedoe.dev/work');
  });

  it('never mistakes social or platform URLs for a portfolio', () => {
    const text = `Jane Doe
https://github.com/janedoe
Portfolio: https://github.com/janedoe/project`;
    expect(extractPortfolioUrl(text)).toBeUndefined();
  });

  it('returns undefined when links are absent', () => {
    expect(extractLinkedinUrl('No links here')).toBeUndefined();
    expect(extractGithubUrl('No links here')).toBeUndefined();
    expect(extractPortfolioUrl('No links here')).toBeUndefined();
  });
});

describe('resolveCandidateIdentity', () => {
  it('prefers the stored name when it is evidenced in the resume text', () => {
    const identity = resolveCandidateIdentity({
      original_filename: 'resume.pdf',
      extracted_text: RESUME_TEXT,
      structured_data: {
        structuredResume: {
          personal: { name: 'Sudharshan N', email: 'its.sudharshan.in@gmail.com' },
          skills: [],
          experience: [],
          education: [],
          projects: [],
          certifications: [],
          languages: [],
        },
      },
    });
    expect(identity.name).toBe('Sudharshan N');
    expect(identity.email).toBe('its.sudharshan.in@gmail.com');
  });

  it('replaces a stored name that never appears in the resume text with the letterhead name', () => {
    const identity = resolveCandidateIdentity({
      original_filename: 'SUDHARSHAN_AI.pdf',
      extracted_text: RESUME_TEXT,
      structured_data: {
        structuredResume: {
          personal: { name: 'SUDHARSHAN AI' },
          skills: [],
          experience: [],
          education: [],
          projects: [],
          certifications: [],
          languages: [],
        },
      },
    });
    expect(identity.name).toBe('Sudharshan N');
    expect(identity.email).toBe('its.sudharshan.in@gmail.com');
  });

  it('recovers name and email from raw text when structured data is missing', () => {
    const identity = resolveCandidateIdentity({
      original_filename: 'upload.pdf',
      extracted_text: RESUME_TEXT,
      structured_data: null,
    });
    expect(identity.name).toBe('Sudharshan N');
    expect(identity.email).toBe('its.sudharshan.in@gmail.com');
  });

  it('falls back to the filename only as a last resort', () => {
    const identity = resolveCandidateIdentity({
      original_filename: 'Software_Engineer.pdf',
      extracted_text: 'Just some prose without a letterhead.',
      structured_data: null,
    });
    expect(identity.name).toBe('Software Engineer');
  });

  it('marks resume-sourced names as resume and filename names as fallback', () => {
    const fromResume = resolveCandidateIdentity({
      original_filename: 'resume.pdf',
      extracted_text: RESUME_TEXT,
      structured_data: {
        structuredResume: {
          personal: { name: 'Sudharshan N' },
          skills: [],
          experience: [],
          education: [],
          projects: [],
          certifications: [],
          languages: [],
        },
      },
    });
    expect(fromResume.nameSource).toBe('resume');

    const fromFilename = resolveCandidateIdentity({
      original_filename: 'resume.pdf',
      extracted_text: 'Just some prose without a letterhead.',
      structured_data: null,
    });
    expect(fromFilename.name).toBe('resume');
    expect(fromFilename.nameSource).toBe('fallback');
  });

  it('resolves LinkedIn, GitHub, and portfolio links from the resume text', () => {
    const identity = resolveCandidateIdentity({
      original_filename: 'resume.pdf',
      extracted_text: `Jane Doe
https://linkedin.com/in/janedoe
https://github.com/janedoe
Portfolio: https://janedoe.dev
jane@example.com`,
      structured_data: {
        structuredResume: {
          personal: { name: 'Jane Doe', email: 'jane@example.com' },
          skills: [],
          experience: [],
          education: [],
          projects: [],
          certifications: [],
          languages: [],
        },
      },
    });
    expect(identity.linkedin).toBe('https://linkedin.com/in/janedoe');
    expect(identity.github).toBe('https://github.com/janedoe');
    expect(identity.portfolio).toBe('https://janedoe.dev');
  });
});

describe('enforceSignatureIdentity', () => {
  const identity = { name: 'Sudharshan N', email: 'its.sudharshan.in@gmail.com', nameSource: 'resume' } as const;

  it('replaces a mismatched LLM signature with the exact resume identity', () => {
    const content = `Dear Hiring Team,

I am applying for the Full Stack Developer position.

Sincerely,

SUDHARSHAN AI
wrong@example.com`;
    const fixed = enforceSignatureIdentity(content, identity);
    expect(fixed).toContain('I am applying for the Full Stack Developer position.');
    expect(fixed).toContain('Sudharshan N');
    expect(fixed).toContain('its.sudharshan.in@gmail.com');
    expect(fixed).not.toContain('SUDHARSHAN AI');
    expect(fixed).not.toContain('wrong@example.com');
  });

  it('appends a deterministic signature when the draft has no sign-off', () => {
    const fixed = enforceSignatureIdentity('Dear Hiring Team,\n\nShort body.', identity);
    expect(fixed).toContain('Sincerely,');
    expect(fixed.endsWith('Sudharshan N\nits.sudharshan.in@gmail.com')).toBe(true);
  });

  it('removes a leading duplicate name header and keeps the body intact', () => {
    const fixed = enforceSignatureIdentity(
      `SUDHARSHAN AI

Dear Hiring Team,

Body here.

Sincerely,

Sudharshan N`,
      identity,
    );
    expect(fixed.startsWith('Dear Hiring Team,')).toBe(true);
    expect(fixed).toContain('Sudharshan N');
  });

  it('omits email/phone lines when they are absent', () => {
    const fixed = enforceSignatureIdentity('Dear Hiring Team,\n\nBody.\n\nSincerely,\nSomeone', {
      name: 'Jane Doe',
      nameSource: 'resume',
    });
    expect(fixed.endsWith('Sincerely,\n\nJane Doe')).toBe(true);
  });

  it('never truncates a mid-body thanks when the real sign-off is at the end', () => {
    const content = `Dear Hiring Team,

Thanks! That project taught me a lot about teamwork.
I built backends with Node.js after that.

Sincerely,

Wrong Name`;
    const fixed = enforceSignatureIdentity(content, identity);
    expect(fixed).toContain('Thanks! That project taught me a lot about teamwork.');
    expect(fixed).toContain('I built backends with Node.js after that.');
    expect(fixed.endsWith('Sudharshan N\nits.sudharshan.in@gmail.com')).toBe(true);
  });

  it('includes LinkedIn, GitHub, and portfolio lines when the resume provides them', () => {
    const fixed = enforceSignatureIdentity('Dear Hiring Team,\n\nBody.\n\nSincerely,\nSomeone', {
      name: 'Jane Doe',
      email: 'jane@example.com',
      linkedin: 'https://linkedin.com/in/janedoe',
      github: 'https://github.com/janedoe',
      portfolio: 'https://janedoe.dev',
      nameSource: 'resume',
    });
    expect(fixed).toContain('Jane Doe\njane@example.com\nhttps://linkedin.com/in/janedoe\nhttps://github.com/janedoe\nhttps://janedoe.dev');
  });
});

describe('resolveCandidateIdentity staleness guards', () => {
  const personal = (name?: string, email?: string) => ({
    structuredResume: {
      personal: { name, email },
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      languages: [],
    },
  });

  it('repairs a stored email with merge-artifact spaces from the raw resume text', () => {
    const identity = resolveCandidateIdentity({
      original_filename: 'resume.pdf',
      extracted_text: `Sudharshan N
its.sudharshan.in@gmail.com

SKILLS
HTML, Node.js`,
      structured_data: personal('Sudharshan N', '. sudharshan. in @ gmail.'),
    });
    expect(identity.name).toBe('Sudharshan N');
    expect(identity.email).toBe('its.sudharshan.in@gmail.com');
  });

  it('prefers the letterhead name sharing a token over a stale caps variant', () => {
    const identity = resolveCandidateIdentity({
      original_filename: 'SUDHARSHAN_AI.pdf',
      extracted_text: `Sudharshan N
Full Stack Developer
its.sudharshan.in@gmail.com

SUDHARSHAN AI PORTFOLIO
Projects below.`,
      structured_data: personal('SUDHARSHAN AI', 'its.sudharshan.in@gmail.com'),
    });
    expect(identity.name).toBe('Sudharshan N');
    expect(identity.nameSource).toBe('resume');
  });

  it('keeps the parsed name when the letterhead is an unrelated company line', () => {
    const identity = resolveCandidateIdentity({
      original_filename: 'resume.pdf',
      extracted_text: `OneDot Communications
Priya Sharma
priya@example.com

EXPERIENCE
Engineer at OneDot Communications.`,
      structured_data: personal('Priya Sharma', 'priya@example.com'),
    });
    expect(identity.name).toBe('Priya Sharma');
  });
});
