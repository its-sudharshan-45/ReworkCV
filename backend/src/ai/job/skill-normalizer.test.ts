// cspell:ignore reactjs vuejs nodejs
import { describe, expect, it } from 'vitest';
import { findMatchingSkills, findSkillsInText, normalizeSkill, skillsMatch } from './skill-normalizer.js';

describe('normalizeSkill', () => {
  it('normalizes ReactJS to react', () => {
    expect(normalizeSkill('ReactJS')).toBe('react');
  });
  it('normalizes React.js to react', () => {
    expect(normalizeSkill('React.js')).toBe('react');
  });
  it('normalizes Node to node.js', () => {
    expect(normalizeSkill('Node')).toBe('node.js');
  });
  it('normalizes nodejs to node.js', () => {
    expect(normalizeSkill('nodejs')).toBe('node.js');
  });
  it('normalizes Postgres to postgresql', () => {
    expect(normalizeSkill('Postgres')).toBe('postgresql');
  });
  it('normalizes PostgreSQL case-insensitively', () => {
    expect(normalizeSkill('POSTGRESQL')).toBe('postgresql');
  });
  it('normalizes Mongo to mongodb', () => {
    expect(normalizeSkill('Mongo')).toBe('mongodb');
  });
  it('normalizes K8s to kubernetes', () => {
    expect(normalizeSkill('k8s')).toBe('kubernetes');
  });
  it('passes through unknown skills lowercased', () => {
    expect(normalizeSkill('SomeUnknownTool')).toBe('someunknowntool');
  });
  it('strips .js suffix from unknown skills', () => {
    expect(normalizeSkill('coolFramework.js')).toBe('coolframework');
  });
});

describe('skillsMatch', () => {
  it('matches React and ReactJS', () => {
    expect(skillsMatch('React', 'ReactJS')).toBe(true);
  });
  it('matches Node and Node.js', () => {
    expect(skillsMatch('Node', 'Node.js')).toBe(true);
  });
  it('does not match React and Vue', () => {
    expect(skillsMatch('React', 'Vue')).toBe(false);
  });
  it('is case insensitive', () => {
    expect(skillsMatch('REACT', 'react')).toBe(true);
  });
});

describe('findMatchingSkills', () => {
  it('finds matched and missing skills', () => {
    const resumeSkills = ['React', 'Node.js', 'PostgreSQL', 'TypeScript'];
    const jdSkills = ['React', 'Docker', 'Node.js', 'AWS'];
    const result = findMatchingSkills(resumeSkills, jdSkills);
    expect(result.matched).toContain('React');
    expect(result.matched).toContain('Node.js');
    expect(result.missing).toContain('Docker');
    expect(result.missing).toContain('AWS');
  });

  it('returns all as missing when resume has no skills', () => {
    const result = findMatchingSkills([], ['React', 'Node.js']);
    expect(result.matched).toHaveLength(0);
    expect(result.missing).toHaveLength(2);
  });

  it('returns all as matched when JD has no skills', () => {
    const result = findMatchingSkills(['React'], []);
    expect(result.matched).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it('handles alias normalization across both lists', () => {
    const result = findMatchingSkills(['Postgres'], ['PostgreSQL']);
    expect(result.matched).toContain('PostgreSQL');
    expect(result.missing).toHaveLength(0);
  });

  it('matches space-separated aliases like React JS and Node JS', () => {
    const result = findMatchingSkills(['React JS', 'Node JS', 'Express JS'], ['React', 'Node.js', 'Express']);
    expect(result.matched).toContain('React');
    expect(result.matched).toContain('Node.js');
    expect(result.matched).toContain('Express');
    expect(result.missing).toHaveLength(0);
  });
});

describe('findSkillsInText', () => {
  it('finds HTML and Node.js mentioned in a skills line', () => {
    const found = findSkillsInText('Skills: HTML, CSS, JavaScript, Node.js, Express');
    expect(found).toContain('HTML');
    expect(found).toContain('Node.js');
  });

  it('does not confuse Java with JavaScript', () => {
    const found = findSkillsInText('Built apps with JavaScript and TypeScript');
    expect(found).not.toContain('Java');
    expect(found).toContain('TypeScript');
  });

  it('skips ambiguous short tokens like Go in prose', () => {
    const found = findSkillsInText('I want to go beyond and grow with the team');
    expect(found).not.toContain('Go');
  });

  it('returns empty for blank text', () => {
    expect(findSkillsInText('')).toEqual([]);
    expect(findSkillsInText('   ')).toEqual([]);
  });
});
