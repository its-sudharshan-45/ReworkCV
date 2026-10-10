import { describe, expect, it } from 'vitest';
import { isSoftSkillLabel } from './soft-skills';

describe('isSoftSkillLabel (legacy preferred-list fallback)', () => {
  it('recognizes genuine soft skills', () => {
    for (const soft of [
      'Communication',
      'communication skills',
      'Teamwork',
      'team player',
      'Leadership',
      'Problem-solving',
      'Adaptability',
      'Time management',
      'Critical thinking',
      'Emotional intelligence',
      'Creativity',
      'Work ethic',
      'detail-oriented',
    ]) {
      expect(isSoftSkillLabel(soft)).toBe(true);
    }
  });

  it('never classifies hard technical skills as soft', () => {
    for (const tech of [
      'React',
      'TypeScript',
      'Docker',
      'AWS',
      'CI/CD',
      'Node.js',
      'Python',
      'Kubernetes',
      'PostgreSQL',
      'GraphQL',
      'Git',
      'REST API',
    ]) {
      expect(isSoftSkillLabel(tech)).toBe(false);
    }
  });

  it('rejects empty and non-string input', () => {
    expect(isSoftSkillLabel('')).toBe(false);
    expect(isSoftSkillLabel(null)).toBe(false);
    expect(isSoftSkillLabel(undefined)).toBe(false);
  });
});
