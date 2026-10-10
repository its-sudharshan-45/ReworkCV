import { describe, expect, it } from 'vitest';
import { parseJobDescription } from './job-jd-parser.js';

const FULL_STACK_JD = `
Full Stack Developer

We are looking for a talented Full Stack Developer with strong experience in React, Node.js,
TypeScript, and PostgreSQL. The ideal candidate should have 3+ years of experience building
scalable web applications.

Required Skills
React
Node.js
TypeScript
PostgreSQL
REST API
Git

Preferred Skills
Docker
AWS
Redis
CI/CD

Responsibilities
Build and maintain scalable web applications
Develop and maintain REST APIs using Node.js and Express
Work closely with frontend and backend teams
Write automated tests and participate in code reviews
Deploy applications using Docker and cloud services

Education
Bachelor's degree in Computer Science or a related field

Experience
3+ years of professional experience in full-stack development
`.trim();

describe('parseJobDescription', () => {
  it('extracts required skills from a well-structured JD', () => {
    const req = parseJobDescription(FULL_STACK_JD, 'Full Stack Developer');
    expect(req.requiredSkills.length).toBeGreaterThan(0);
    // Should find at least React, Node.js, TypeScript
    const lowerReq = req.requiredSkills.map((s) => s.toLowerCase());
    expect(lowerReq.some((s) => s.includes('react'))).toBe(true);
    expect(lowerReq.some((s) => s.includes('node'))).toBe(true);
  });

  it('extracts preferred skills separately', () => {
    const req = parseJobDescription(FULL_STACK_JD);
    const lowerPref = req.preferredSkills.map((s) => s.toLowerCase());
    expect(lowerPref.some((s) => s.includes('docker'))).toBe(true);
  });

  it('extracts soft skills without touching hard-skill lists', () => {
    const jd = [
      'Senior Frontend Engineer.',
      'Must have excellent communication skills and a collaborative, team-player mindset.',
      'Required Skills',
      'React',
      'TypeScript',
    ].join('\n');
    const req = parseJobDescription(jd, 'Frontend Engineer');
    expect(req.softSkills).toContain('Communication');
    expect(req.softSkills).toContain('Teamwork');
    // Soft-skill extraction never leaks into hard-skill lists.
    for (const s of [...req.requiredSkills, ...req.preferredSkills]) {
      expect(s.toLowerCase()).not.toContain('communication');
    }
  });

  it('extracts experience requirements with year pattern', () => {
    const req = parseJobDescription(FULL_STACK_JD);
    expect(req.experienceRequirements.length).toBeGreaterThan(0);
    const found = req.experienceRequirements.some((e) => e.includes('3'));
    expect(found).toBe(true);
  });

  it('extracts education requirements', () => {
    const req = parseJobDescription(FULL_STACK_JD);
    expect(req.educationRequirements.length).toBeGreaterThan(0);
    const hasBachelor = req.educationRequirements.some((e) =>
      e.toLowerCase().includes('bachelor'),
    );
    expect(hasBachelor).toBe(true);
  });

  it('extracts responsibilities', () => {
    const req = parseJobDescription(FULL_STACK_JD);
    expect(req.responsibilities.length).toBeGreaterThan(0);
  });

  it('extracts keywords', () => {
    const req = parseJobDescription(FULL_STACK_JD);
    expect(req.keywords.length).toBeGreaterThan(0);
  });

  it('sets title when provided', () => {
    const req = parseJobDescription(FULL_STACK_JD, 'Senior Engineer');
    expect(req.title).toBe('Senior Engineer');
  });

  it('handles an empty JD gracefully', () => {
    const req = parseJobDescription('');
    expect(req.requiredSkills).toEqual([]);
    expect(req.responsibilities).toEqual([]);
  });

  it('handles a very short JD gracefully', () => {
    const req = parseJobDescription('React developer needed');
    expect(Array.isArray(req.requiredSkills)).toBe(true);
  });

  it('handles a JD with no section headings — falls back to full-text extraction', () => {
    const plain = 'We need someone with React, Node.js, PostgreSQL, and Docker experience for 2 years.';
    const req = parseJobDescription(plain);
    const lowerReq = req.requiredSkills.map((s) => s.toLowerCase());
    expect(lowerReq.some((s) => s.includes('react'))).toBe(true);
  });

  it('deduplicates skills when repeated across sections in JD', () => {
    const repeated = `
    Required Skills: React, TypeScript, React
    Must Have: TypeScript, React
    `;
    const req = parseJobDescription(repeated);
    const reactCount = req.requiredSkills.filter((s) => s.toLowerCase() === 'react').length;
    expect(reactCount).toBe(1);
  });

  it('extracts experience requirement with yrs abbreviation and range', () => {
    const jd = 'Seeking software developer with 5+ yrs of professional experience in backend systems.';
    const req = parseJobDescription(jd);
    expect(req.experienceRequirements.some((e) => e.includes('5'))).toBe(true);
  });

  it('handles JD containing only responsibilities without crashing', () => {
    const jd = `
    Responsibilities:
    Design robust data architectures.
    Mentor junior engineers.
    Participate in agile sprint planning.
    `;
    const req = parseJobDescription(jd);
    expect(req.responsibilities.length).toBeGreaterThan(0);
    expect(req.requiredSkills).toEqual([]);
    expect(req.preferredSkills).toEqual([]);
  });
});
