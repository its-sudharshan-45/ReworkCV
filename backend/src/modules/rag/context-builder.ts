import { getRagConfig } from './rag.config.js';
import { RAG_SYSTEM_INSTRUCTIONS, sanitizeUntrustedData, wrapUntrusted } from './prompt-guard.js';
import type { RetrievedChunk } from './rag.types.js';

export interface AnalysisContextInput {
  resumeFacts: string;
  jobDescriptionFacts: string;
  deterministicAnalysis: string;
  analysisQuestion: string;
  retrievedChunks: RetrievedChunk[];
}

// Controlled context construction. The knowledge base is never sent wholesale:
// at most (topK + 2) chunks, each truncated, total context capped by config.

export function buildAnalysisPrompt(input: AnalysisContextInput): Array<{ role: 'system' | 'user'; content: string }> {
  const config = getRagConfig();

  const resume = sanitizeUntrustedData(input.resumeFacts, 12000);
  const jd = sanitizeUntrustedData(input.jobDescriptionFacts, 12000);
  const det = sanitizeUntrustedData(input.deterministicAnalysis, 12000);

  let knowledgeBlock: string;
  if (input.retrievedChunks.length === 0) {
    knowledgeBlock = '<retrieved_knowledge>\nNo relevant knowledge was retrieved above the similarity threshold. Base your response ONLY on the deterministic analysis and resume/job facts. State "No additional knowledge retrieved" in ragNote.\n</retrieved_knowledge>';
  } else {
    const perChunk = Math.max(200, Math.floor(config.maxContextChars / Math.max(input.retrievedChunks.length, 1)));
    const rendered = input.retrievedChunks
      .map((c, i) => `[KNOWLEDGE ${i + 1} | category=${c.category} | subcategory=${c.subcategory ?? 'general'} | role=${c.role ?? 'general'} | source=${c.source}]\n${c.content.slice(0, perChunk)}`)
      .join('\n\n---\n\n')
      .slice(0, config.maxContextChars);
    knowledgeBlock = `<retrieved_knowledge>\n${rendered}\n</retrieved_knowledge>`;
  }

  const question = sanitizeUntrustedData(input.analysisQuestion, 2000);

  const userPrompt = `${wrapUntrusted('resume_data', resume)}\n\n${wrapUntrusted('job_description', jd)}\n\n${wrapUntrusted('deterministic_analysis', det)}\n\n${knowledgeBlock}\n\n<analysis_question>\n${question.text}\n</analysis_question>\n\nRespond with a single JSON object matching this schema (no markdown fences, no extra text):\n{\n  "summary": "2-3 sentence contextual summary grounded in the deterministic analysis",\n  "strengths": [{"title": "...", "explanation": "...", "evidence": "..."}],\n  "weaknesses": [{"title": "...", "explanation": "...", "evidence": "..."}],\n  "recommendations": [{"priority": "high|medium|low", "area": "experience|skills|summary|projects|education|formatting|keywords", "recommendation": "...", "reason": "..."}],\n  "bulletAnalysis": [{"original": "verbatim resume bullet (or 'No measurable impact...')", "issue": "...", "suggestion": "concrete rewrite using only facts present"}],\n  "knowledgeReferences": [{"documentId": "...", "chunkId": "..."}]\n}`;

  return [
    { role: 'system', content: RAG_SYSTEM_INSTRUCTIONS },
    { role: 'user', content: userPrompt },
  ];
}
