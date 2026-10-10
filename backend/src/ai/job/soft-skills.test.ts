import { describe, expect, it } from 'vitest';
import {
  canonicalizeSoftSkill,
  extractSoftSkillsFromText,
  isSoftSkillName,
  listSoftSkillNames,
} from './soft-skills.js';

describe('soft-skill vocabulary', () => {
  it('covers the common soft-skill families', () => {
    const names = listSoftSkillNames();
    for (const expected of [
      'Communication',
      'Teamwork',
      'Problem-solving',
      'Adaptability',
      'Time management',
      'Critical thinking',
      'Leadership',
      'Emotional intelligence',
      'Creativity',
      'Work ethic',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('extracts soft skills from JD-style prose', () => {
    const text = [
      'We need excellent communication and teamwork skills.',
      'The candidate shows strong leadership, mentoring junior engineers,',
      'adapts quickly to change, and manages time well under deadlines.',
    ].join(' ');
    const found = extractSoftSkillsFromText(text);
    expect(found).toContain('Communication');
    expect(found).toContain('Teamwork');
    expect(found).toContain('Leadership');
    expect(found).toContain('Adaptability');
    expect(found).toContain('Time management');
  });

  it('matches aliases and hyphen variants to canonical names', () => {
    expect(extractSoftSkillsFromText('great at problem solving and collaborating')).toContain('Problem-solving');
    expect(extractSoftSkillsFromText('problem-solving skills required')).toContain('Problem-solving');
    expect(extractSoftSkillsFromText('must be detail oriented and proactive')).toEqual(
      expect.arrayContaining(['Work ethic']),
    );
    expect(canonicalizeSoftSkill('Communication skills')).toBe('Communication');
    expect(canonicalizeSoftSkill('LEADERSHIP')).toBe('Leadership');
  });

  it('never classifies hard technical skills as soft', () => {
    for (const tech of ['React', 'TypeScript', 'Docker', 'AWS', 'CI/CD', 'Node.js', 'Python', 'Kubernetes', 'PostgreSQL', 'GraphQL']) {
      expect(isSoftSkillName(tech)).toBe(false);
      expect(canonicalizeSoftSkill(tech)).toBeNull();
    }
    // Boundary traps: "software" contains "soft", "social media" is not a skill claim.
    expect(extractSoftSkillsFromText('Built software with social media integrations.')).toEqual([]);
    expect(extractSoftSkillsFromText('')).toEqual([]);
    expect(extractSoftSkillsFromText(null)).toEqual([]);
  });

  it('classifies standalone soft-skill labels', () => {
    expect(isSoftSkillName('Communication')).toBe(true);
    expect(isSoftSkillName('team player')).toBe(true);
    expect(isSoftSkillName('  Time Management  ')).toBe(true);
    expect(isSoftSkillName('')).toBe(false);
    expect(isSoftSkillName(null)).toBe(false);
  });
});
