import { describe, expect, it, vi } from 'vitest';

vi.mock('../ai.service.js', () => ({
  aiService: {
    complete: vi.fn().mockRejectedValue(new Error('provider down')),
  },
}));

import { generateCoverLetterText } from './cover-letter-generator.js';

describe('generateCoverLetterText deterministic fallback', () => {
  it('uses the exact candidate details with no placeholders or defaults', async () => {
    const text = await generateCoverLetterText({
      candidateName: 'Sudharshan N',
      candidateEmail: 'its.sudharshan.in@gmail.com',
      candidatePhone: '+91 98765 43210',
      candidateLinkedin: 'https://linkedin.com/in/sudharshan',
      candidateGithub: 'https://github.com/sudharshan',
      candidatePortfolio: 'https://sudharshan.dev',
      jobTitle: 'Full Stack Developer',
      jobDescription: 'Seeking a Full Stack Developer with React and Node.js experience.',
      structuredResume: {
        personal: { name: 'Sudharshan N' },
        skills: ['React', 'Node.js'],
        experience: [],
        education: [],
        projects: [],
        certifications: [],
        languages: [],
      },
    });

    expect(text).toContain('Sudharshan N');
    expect(text).toContain('its.sudharshan.in@gmail.com');
    expect(text).toContain('+91 98765 43210');
    expect(text).toContain('https://linkedin.com/in/sudharshan');
    expect(text).toContain('https://github.com/sudharshan');
    expect(text).toContain('https://sudharshan.dev');
    expect(text).not.toContain('Candidate');
    expect(text).not.toMatch(/\[[^\]]+\]/);
  });
});
