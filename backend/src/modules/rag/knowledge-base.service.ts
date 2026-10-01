import { createHash, randomUUID } from 'node:crypto';
import { logger } from '../../config/logger.js';
import { chunkText, cleanText } from './chunking.service.js';
import { getEmbeddingService } from './embedding.service.js';
import { KNOWLEDGE_SEED_DOCUMENTS } from './knowledge-seed.js';
import {
  InMemoryKnowledgeRepository,
  SupabaseKnowledgeRepository,
  type KnowledgeRepository,
} from './knowledge.repository.js';
import { getRagConfig } from './rag.config.js';
import type { RagIngestRequest } from './rag.types.js';

// Reusable ingestion pipeline:
// Document -> Text Extraction -> Cleaning -> Chunking -> Metadata ->
// Embedding Generation -> Vector Storage. Supports re-indexing and
// delete/replace. Embeddings are never hardcoded.

export interface IngestResult {
  documentId: string;
  source: string;
  version: string;
  chunkCount: number;
  skippedAsDuplicate: boolean;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(cleanText(content)).digest('hex');
}

let repositoryOverride: KnowledgeRepository | null = null;

export function setKnowledgeRepository(repo: KnowledgeRepository | null): void {
  repositoryOverride = repo;
}

export function getKnowledgeRepository(): KnowledgeRepository {
  if (repositoryOverride) return repositoryOverride;
  return new SupabaseKnowledgeRepository();
}

export class KnowledgeBaseService {
  constructor(private readonly repository: KnowledgeRepository = getKnowledgeRepository()) {}

  async ingestDocument(input: RagIngestRequest): Promise<IngestResult> {
    const config = getRagConfig();
    const cleaned = cleanText(input.content);
    if (!cleaned) throw new Error('Document content is empty after cleaning');
    const contentHash = hashContent(cleaned);

    const chunks = chunkText(cleaned, { chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap });
    if (chunks.length === 0) throw new Error('Document produced no chunks');

    const documentId = await this.repository.upsertDocument({
      title: input.title,
      category: input.category,
      subcategory: input.subcategory ?? null,
      role: input.role?.toLowerCase().replace(/[\s-]+/g, '_') ?? null,
      source: input.source,
      version: input.version,
      contentHash,
      chunkCount: chunks.length,
    });

    const existing = await this.repository.listChunks({ limit: 5000 });
    const sameDoc = existing.filter((c) => c.documentId === documentId);
    const sameHash =
      sameDoc.length === chunks.length &&
      sameDoc.every((c, i) => hashContent(c.content) === hashContent(chunks[i] ?? ''));
    if (sameHash) {
      logger.info({ source: input.source }, 'Knowledge document unchanged, skipping re-embed');
      return { documentId, source: input.source, version: input.version, chunkCount: chunks.length, skippedAsDuplicate: true };
    }

    const embeddingService = getEmbeddingService();
    const embeddings = await embeddingService.generateEmbeddings(chunks);

    await this.repository.replaceChunks(
      documentId,
      chunks.map((content, i) => ({
        id: randomUUID(),
        documentId,
        content,
        embedding: embeddings[i] ?? [],
        category: input.category,
        subcategory: input.subcategory ?? null,
        role: input.role?.toLowerCase().replace(/[\s-]+/g, '_') ?? null,
        source: input.source,
        version: input.version,
        chunkIndex: i,
      })),
    );

    logger.info({ source: input.source, chunks: chunks.length }, 'Knowledge document ingested');
    return { documentId, source: input.source, version: input.version, chunkCount: chunks.length, skippedAsDuplicate: false };
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.repository.deleteDocument(id);
  }

  /** Ingest (or refresh) the full built-in seed corpus. Idempotent. */
  async ingestSeedCorpus(): Promise<{ documents: number; chunks: number; skipped: number }> {
    let chunks = 0;
    let skipped = 0;
    for (const doc of KNOWLEDGE_SEED_DOCUMENTS) {
      const result = await this.ingestDocument({
        title: doc.title,
        content: doc.content,
        category: doc.category,
        subcategory: doc.subcategory,
        role: doc.role ?? undefined,
        source: doc.source === 'resume_guidelines' || doc.source === 'ats_guidelines' || doc.source === 'writing_guidelines' || doc.source === 'role_guidelines'
          ? `${doc.source}:${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
          : doc.source,
        version: doc.version,
      });
      chunks += result.chunkCount;
      if (result.skippedAsDuplicate) skipped++;
    }
    return { documents: KNOWLEDGE_SEED_DOCUMENTS.length, chunks, skipped };
  }

  /** Build an in-memory repository preloaded with the seed corpus (offline/tests). */
  static async buildInMemorySeeded(): Promise<InMemoryKnowledgeRepository> {
    const config = getRagConfig();
    const repo = new InMemoryKnowledgeRepository();
    const embeddingService = getEmbeddingService();
    const seeded: Awaited<ReturnType<InMemoryKnowledgeRepository['listChunks']>> = [];
    for (const doc of KNOWLEDGE_SEED_DOCUMENTS) {
      const chunks = chunkText(doc.content, { chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap });
      const embeddings = await embeddingService.generateEmbeddings(chunks);
      const documentId = `seed-${createHash('sha256').update(doc.title).digest('hex').slice(0, 12)}`;
      chunks.forEach((content, i) => {
        seeded.push({
          id: `seed-chunk-${createHash('sha256').update(documentId + i).digest('hex').slice(0, 12)}`,
          documentId,
          content,
          embedding: embeddings[i] ?? null,
          category: doc.category,
          subcategory: doc.subcategory,
          role: doc.role,
          source: doc.source,
          version: doc.version,
          chunkIndex: i,
        });
      });
    }
    repo.seed(seeded);
    return repo;
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
