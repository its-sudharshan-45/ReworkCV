// cspell:ignore subword
import { describe, expect, it } from 'vitest';
import {
  buildStructuredResume,
  deduplicateStrings,
  mergeRawEntities,
  normalizeSkills,
} from './resume-normalizer.js';
import type { RawNEREntity } from './resume-types.js';

describe('Resume Entity Normalizer', () => {
  it('merges B-/I- tagged entities and subword tokens', () => {
    const rawEntities: RawNEREntity[] = [
      { entity: 'B-NAME', word: 'John', score: 0.9, index: 1 },
      { entity: 'I-NAME', word: 'Doe', score: 0.9, index: 2 },
      { entity: 'B-SKILL', word: 'React', score: 0.9, index: 3 },
      { entity: 'I-SKILL', word: '##.js', score: 0.9, index: 4 },
    ];

    const merged = mergeRawEntities(rawEntities);
    expect(merged.names).toContain('John Doe');
    expect(merged.skills).toContain('React.js');
  });

  it('normalizes skill names and removes duplicates case-insensitively', () => {
    const skills = normalizeSkills(['React', 'react', 'React.js', 'React JS', 'reactjs', 'Node', 'nodejs', 'Node.js', 'Node JS']);
    expect(skills).toContain('React.js');
    expect(skills).toContain('Node.js');
    expect(skills.length).toBe(2);
  });

  it('normalizes space-separated framework aliases consistently', () => {
    const skills = normalizeSkills(['Express JS', 'express.js', 'Vue JS', 'vue.js', 'Next JS', 'nextjs']);
    expect(skills).toContain('Express.js');
    expect(skills).toContain('Vue.js');
    expect(skills).toContain('Next.js');
    expect(skills.length).toBe(3);
  });

  it('deduplicates general strings', () => {
    const items = deduplicateStrings(['Google', 'google', 'GOOGLE', 'Microsoft']);
    expect(items).toEqual(['Google', 'Microsoft']);
  });
  it('passes minimal model sample test requirements (Requirement 25)', () => {
    const sampleText = `
      John Doe
      john@example.com
      +91 9876543210

      SUMMARY
      Motivated software engineer with experience building web apps.

      EDUCATION
      B.Tech in Computer Science from ABC University (2020 - 2024)

      EXPERIENCE
      Software Engineer at Google (2024 - Present)

      PROJECTS
      UpSkilr Career Platform
      Full stack app built using React and Node.js for placement prep.

      SKILLS
      Skills: Java, React, Node.js, AWS, AWS Certified Developer
    `;

    const sampleEntities: RawNEREntity[] = [
      { entity: 'B-NAME', word: 'John', score: 0.9, index: 1 },
      { entity: 'I-NAME', word: 'Doe', score: 0.9, index: 2 },
      { entity: 'B-EMAIL', word: 'john@example.com', score: 0.9, index: 3 },
      { entity: 'B-PHONE', word: '+91 9876543210', score: 0.9, index: 4 },
      { entity: 'B-DEGREE', word: 'B.Tech', score: 0.9, index: 5 },
      { entity: 'B-FIELD', word: 'Computer Science', score: 0.9, index: 6 },
      { entity: 'B-INSTITUTION', word: 'ABC University', score: 0.9, index: 7 },
      { entity: 'B-TITLE', word: 'Software Engineer', score: 0.9, index: 8 },
      { entity: 'B-COMPANY', word: 'Google', score: 0.9, index: 9 },
      { entity: 'B-SKILL', word: 'Java', score: 0.9, index: 10 },
      { entity: 'B-SKILL', word: 'React', score: 0.9, index: 11 },
      { entity: 'B-SKILL', word: 'Node.js', score: 0.9, index: 12 },
      { entity: 'B-SKILL', word: 'AWS', score: 0.9, index: 13 },
      { entity: 'B-CERT', word: 'AWS Certified Developer', score: 0.9, index: 14 },
    ];

    const structured = buildStructuredResume(sampleText, sampleEntities);

    expect(structured.personal.name).toBe('John Doe');
    expect(structured.personal.email).toBe('john@example.com');
    expect(structured.personal.phone).toContain('9876543210');

    expect(structured.skills).toContain('Java');
    expect(structured.skills).toContain('React.js');
    expect(structured.skills).toContain('AWS');

    expect(structured.projects.length).toBeGreaterThan(0);
    expect(structured.projects[0].name).toBe('UpSkilr Career Platform');

    expect(structured.certifications.some((c) => c.name?.includes('AWS Certified Developer'))).toBe(true);
  });

  it('recovers HTML and Node.js from resume text even when NER finds nothing', () => {
    const text = `
      Jane Doe
      jane@example.com

      SKILLS
      HTML CSS JavaScript Node.js Express MongoDB

      EXPERIENCE
      Web Developer at Startup (2023 - Present)
      Built responsive pages with HTML and CSS.
    `;

    const structured = buildStructuredResume(text, []);

    expect(structured.skills).toContain('HTML');
    expect(structured.skills).toContain('Node.js');
    expect(structured.skills).toContain('CSS');
    expect(structured.skills).toContain('JavaScript');
  });

  it('merges split email tokens without introducing spaces', () => {
    const rawEntities: RawNEREntity[] = [
      { entity: 'B-EMAIL', word: 'its', score: 0.9, index: 1 },
      { entity: 'I-EMAIL', word: '.', score: 0.9, index: 2 },
      { entity: 'I-EMAIL', word: 'sudharshan', score: 0.9, index: 3 },
      { entity: 'I-EMAIL', word: '.', score: 0.9, index: 4 },
      { entity: 'I-EMAIL', word: 'in', score: 0.9, index: 5 },
      { entity: 'I-EMAIL', word: '@', score: 0.9, index: 6 },
      { entity: 'I-EMAIL', word: 'gmail', score: 0.9, index: 7 },
      { entity: 'I-EMAIL', word: '.', score: 0.9, index: 8 },
      { entity: 'I-EMAIL', word: 'com', score: 0.9, index: 9 },
    ];

    const merged = mergeRawEntities(rawEntities);
    expect(merged.emails).toEqual(['its.sudharshan.in@gmail.com']);
  });
});
