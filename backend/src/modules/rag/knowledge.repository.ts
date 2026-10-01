import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../config/logger.js';
import type { KnowledgeChunkMeta } from './rag.types.js';

// Persistence for the knowledge base. Uses Supabase PostgreSQL + pgvector
// when configured; degrades gracefully (throws a typed error the service
// layer converts into a deterministic-only fallback).

export interface PersistChunkInput extends KnowledgeChunkMeta {
  embedding: number[];
}

export interface KnowledgeRepository {
  listChunks(filter?: { categories?: string[]; role?: string | null; limit?: number }): Promise<Array<KnowledgeChunkMeta & { embedding: number[] | null }>>;
  upsertDocument(input: {
    title: string;
    category: string;
    subcategory: string | null;
    role: string | null;
    source: string;
    version: string;
    contentHash: string;
    chunkCount: number;
  }): Promise<string>;
  replaceChunks(documentId: string, chunks: PersistChunkInput[]): Promise<void>;
  deleteDocument(id: string): Promise<boolean>;
  countChunks(): Promise<number>;
}

function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const nums = (value as unknown[]).map((v) => Number(v)).filter((n) => Number.isFinite(n));
    return nums.length > 0 ? nums : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[[ \]]/g, '');
    if (!cleaned) return null;
    const nums = cleaned.split(',').map(Number).filter((n) => Number.isFinite(n));
    return nums.length > 0 ? nums : null;
  }
  return null;
}

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  async listChunks(filter: { categories?: string[]; role?: string | null; limit?: number } = {}): Promise<Array<KnowledgeChunkMeta & { embedding: number[] | null }>> {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('knowledge_chunks')
      .select('id,document_id,content,embedding,category,subcategory,role,source,version,chunk_index')
      .limit(filter.limit ?? 500);

    if (filter.categories && filter.categories.length > 0) {
      query = query.in('category', filter.categories);
    }
    if (filter.role) {
      query = query.or(`role.eq.${filter.role},role.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row['id']),
      documentId: String(row['document_id']),
      content: String(row['content'] ?? ''),
      category: String(row['category'] ?? ''),
      subcategory: (row['subcategory'] as string | null) ?? null,
      role: (row['role'] as string | null) ?? null,
      source: String(row['source'] ?? ''),
      version: String(row['version'] ?? 'v1'),
      chunkIndex: Number(row['chunk_index'] ?? 0),
      embedding: parseEmbedding(row['embedding']),
    }));
  }

  async upsertDocument(input: {
    title: string;
    category: string;
    subcategory: string | null;
    role: string | null;
    source: string;
    version: string;
    contentHash: string;
    chunkCount: number;
  }): Promise<string> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('knowledge_documents')
      .upsert(
        {
          title: input.title,
          category: input.category,
          subcategory: input.subcategory,
          role: input.role,
          source: input.source,
          version: input.version,
          content_hash: input.contentHash,
          chunk_count: input.chunkCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source,version' },
      )
      .select('id')
      .single();
    if (error) throw error;
    return String((data as { id: string }).id);
  }

  async replaceChunks(documentId: string, chunks: PersistChunkInput[]): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error: delError } = await supabase.from('knowledge_chunks').delete().eq('document_id', documentId);
    if (delError) throw delError;
    if (chunks.length === 0) return;
    const rows = chunks.map((c) => ({
      id: c.id,
      document_id: c.documentId,
      content: c.content,
      embedding: `[${c.embedding.join(',')}]`,
      category: c.category,
      subcategory: c.subcategory,
      role: c.role,
      source: c.source,
      version: c.version,
      chunk_index: c.chunkIndex,
    }));
    // Insert in batches to respect payload limits
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from('knowledge_chunks').insert(rows.slice(i, i + 100));
      if (error) throw error;
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('knowledge_documents').delete().eq('id', id).select('id');
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async countChunks(): Promise<number> {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase.from('knowledge_chunks').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  }
}

// In-memory fallback used when Supabase is unreachable (dev/test) and as the
// deterministic store behind unit tests. Never stores user resume data —
// knowledge chunks only.

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private chunks: Array<KnowledgeChunkMeta & { embedding: number[] | null }> = [];
  private docs = new Map<string, { id: string; hash: string }>();

  seed(chunks: Array<KnowledgeChunkMeta & { embedding: number[] | null }>): void {
    this.chunks = [...chunks];
  }

  snapshot(): Array<KnowledgeChunkMeta & { embedding: number[] | null }> {
    return [...this.chunks];
  }

  async listChunks(filter: { categories?: string[]; role?: string | null; limit?: number } = {}): Promise<Array<KnowledgeChunkMeta & { embedding: number[] | null }>> {
    let out = this.chunks;
    if (filter.categories?.length) out = out.filter((c) => filter.categories!.includes(c.category));
    if (filter.role) out = out.filter((c) => c.role === filter.role || c.role === null);
    return out.slice(0, filter.limit ?? 500);
  }

  async upsertDocument(input: { title: string; category: string; subcategory: string | null; role: string | null; source: string; version: string; contentHash: string; chunkCount: number }): Promise<string> {
    const key = `${input.source}::${input.version}`;
    const existing = this.docs.get(key);
    if (existing) return existing.id;
    const id = `doc-${createHash('sha256').update(key).digest('hex').slice(0, 12)}`;
    this.docs.set(key, { id, hash: input.contentHash });
    return id;
  }

  async replaceChunks(documentId: string, chunks: PersistChunkInput[]): Promise<void> {
    this.chunks = this.chunks.filter((c) => c.documentId !== documentId);
    this.chunks.push(...chunks.map((c) => ({ ...c, embedding: c.embedding as number[] | null })));
  }

  async deleteDocument(id: string): Promise<boolean> {
    const before = this.chunks.length;
    this.chunks = this.chunks.filter((c) => c.documentId !== id);
    for (const [k, v] of this.docs) if (v.id === id) this.docs.delete(k);
    return this.chunks.length !== before;
  }

  async countChunks(): Promise<number> {
    return this.chunks.length;
  }
}

export function isSupabaseAvailable(): boolean {
  try {
    getSupabaseAdmin();
    return Boolean(process.env['SUPABASE_URL'] && process.env['SUPABASE_SERVICE_ROLE_KEY']);
  } catch (err) {
    logger.debug({ err }, 'Supabase unavailable for knowledge repository');
    return false;
  }
}
