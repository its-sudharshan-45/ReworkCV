import { describe, expect, it } from 'vitest';
import { parseResumeSections } from './resume.section-parser.js';

const SAMPLE_RESUME = `
JANE DOE
Software Engineer

SUMMARY
Motivated computer science student with internship experience building web applications.

SKILLS
JavaScript, TypeScript, React, Node.js, PostgreSQL

EXPERIENCE
Software Intern | Acme Corp | 2024
Built REST APIs and React dashboards.

EDUCATION
B.S. Computer Science | State University | 2026

PROJECTS
UpSkilr Career Platform
Built a full-stack career preparation platform.

CERTIFICATIONS
AWS Cloud Practitioner
`.trim();

describe('parseResumeSections', () => {
  it('detects common resume sections in varied order', () => {
    const structured = parseResumeSections(SAMPLE_RESUME);
    const keys = structured.sections.map((section) => section.key);

    expect(keys).toContain('summary');
    expect(keys).toContain('skills');
    expect(keys).toContain('experience');
    expect(keys).toContain('education');
    expect(keys).toContain('projects');
    expect(keys).toContain('certifications');
    expect(structured.skills.length).toBeGreaterThan(3);
  });

  it('tolerates missing sections without fabricating content', () => {
    const structured = parseResumeSections('SUMMARY\nShort intro only.');
    expect(structured.sections.some((section) => section.key === 'summary')).toBe(true);
    expect(structured.sections.some((section) => section.key === 'experience')).toBe(false);
    expect(structured.skills).toEqual([]);
  });

  it('handles empty documents', () => {
    const structured = parseResumeSections('');
    expect(structured.sections).toEqual([]);
    expect(structured.skills).toEqual([]);
  });

  it('correctly identifies section heading variations with markdown and colons', () => {
    const markdownResume = `
Alex Developer
alex@example.com

## PROFESSIONAL SUMMARY
Passionate engineer with 4 years building scalable microservices.

### CORE SKILLS:
React, TypeScript, Python, Docker

**WORK EXPERIENCE:**
Senior Dev at TechHub (2021 - Present)
Led frontend architecture.

## ACADEMIC BACKGROUND:
B.S. in Software Engineering, 2020

### ACADEMIC PROJECTS
AI Resume Scanner: built with Node and Python

## ACHIEVEMENTS
- First place at National Hackathon 2023
- Dean's Honor List
`.trim();

    const structured = parseResumeSections(markdownResume);
    const keys = structured.sections.map((s) => s.key);

    expect(keys).toContain('summary');
    expect(keys).toContain('skills');
    expect(keys).toContain('experience');
    expect(keys).toContain('education');
    expect(keys).toContain('projects');
    expect(keys).toContain('certifications');
    expect(structured.skills).toContain('React');
    expect(structured.skills).toContain('TypeScript');
  });

  it('handles resume with only education and leaves missing sections empty', () => {
    const eduOnly = `
John Doe
EDUCATION
B.Tech in Information Technology
XYZ University
`.trim();

    const structured = parseResumeSections(eduOnly);
    expect(structured.sections.map((s) => s.key)).toContain('education');
    expect(structured.sections.some((s) => s.key === 'skills')).toBe(false);
    expect(structured.sections.some((s) => s.key === 'experience')).toBe(false);
    expect(structured.sections.some((s) => s.key === 'projects')).toBe(false);
    expect(structured.skills).toEqual([]);
  });

  it('extracts skills from space-separated and slash-joined lines without dropping the line', () => {
    const resume = `
Jane Doe

SKILLS
HTML CSS JavaScript Node.js Express MongoDB
HTML/CSS/TypeScript
Frontend: React, Tailwind CSS
`.trim();

    const structured = parseResumeSections(resume);
    expect(structured.skills).toContain('HTML');
    expect(structured.skills).toContain('CSS');
    expect(structured.skills).toContain('JavaScript');
    expect(structured.skills).toContain('Node.js');
    expect(structured.skills).toContain('TypeScript');
    expect(structured.skills).toContain('React');
  });

  it('keeps CI/CD intact while splitting slash-joined skills', () => {
    const resume = `
Jane Doe

TECH STACK
CI/CD, Docker, HTML/CSS, AWS
`.trim();

    const structured = parseResumeSections(resume);
    expect(structured.sections.map((s) => s.key)).toContain('skills');
    expect(structured.skills).toContain('CI/CD');
    expect(structured.skills).toContain('Docker');
    expect(structured.skills).toContain('HTML');
    expect(structured.skills).toContain('CSS');
    expect(structured.skills).toContain('AWS');
  });
});
