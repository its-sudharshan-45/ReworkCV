// Reusable text chunking for the ingestion pipeline.
// Configurable size/overlap; preserves paragraph then sentence boundaries so
// important concepts are not split; dedupes; normalizes whitespace.

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export function cleanText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoUnits(text: string): string[] {
  // Prefer paragraph boundaries, then sentences.
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const units: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= 1200) {
      units.push(para);
      continue;
    }
    const sentences = para.match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g) ?? [para];
    for (const s of sentences) {
      const t = s.trim();
      if (t) units.push(t);
    }
  }
  return units;
}

export function chunkText(text: string, options: ChunkingOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? 800;
  const chunkOverlap = Math.min(options.chunkOverlap ?? 100, Math.floor(chunkSize / 2));
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  const units = splitIntoUnits(cleaned);
  const chunks: string[] = [];
  let current = '';

  const push = (c: string) => {
    const t = c.trim();
    if (t) chunks.push(t);
  };

  for (const unit of units) {
    if ((current + '\n\n' + unit).trim().length <= chunkSize || !current) {
      current = current ? `${current}\n\n${unit}` : unit;
      continue;
    }
    push(current);
    // Overlap: carry the tail of the previous chunk forward
    const tail = current.slice(Math.max(0, current.length - chunkOverlap));
    const boundary = tail.search(/\s/);
    current = (boundary >= 0 ? tail.slice(boundary + 1) : tail) + '\n\n' + unit;
    current = current.trim();
    // A single oversized unit is hard-split on word boundaries
    while (current.length > chunkSize * 2) {
      let cut = current.lastIndexOf(' ', chunkSize);
      if (cut < chunkSize * 0.5) cut = chunkSize;
      push(current.slice(0, cut));
      current = current.slice(Math.max(0, cut - chunkOverlap)).trim();
    }
  }
  push(current);

  // Deduplicate identical chunks while preserving order
  const seen = new Set<string>();
  return chunks.filter((c) => {
    const key = c.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
