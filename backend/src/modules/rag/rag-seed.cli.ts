// Seed the RAG knowledge base in Supabase (run after migration 022).
// Usage: npm run rag:seed  (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
import '../../config/env.js';
import { knowledgeBaseService } from './knowledge-base.service.js';

async function main(): Promise<void> {
  const result = await knowledgeBaseService.ingestSeedCorpus();
  console.log(`Seeded ${result.documents} documents / ${result.chunks} chunks (${result.skipped} unchanged, skipped).`);
}

main().catch((err) => {
  console.error('RAG seeding failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
