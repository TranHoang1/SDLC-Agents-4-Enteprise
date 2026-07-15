// Pre-downloads Xenova/paraphrase-multilingual-MiniLM-L12-v2 into the HF cache
// so the image works fully offline at runtime.
import { pipeline, env } from '@xenova/transformers';

// Explicitly set cacheDir so it matches TRANSFORMERS_CACHE env var
env.cacheDir = process.env.TRANSFORMERS_CACHE ?? '/app/.hf-cache';
env.allowLocalModels = false;

console.log('[preload] Downloading Xenova/paraphrase-multilingual-MiniLM-L12-v2 (quantized)...');
const extractor = await pipeline(
  'feature-extraction',
  'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  { quantized: true },
);

console.log('[preload] Running warm-up inference...');
await extractor('warm-up', { pooling: 'mean', normalize: true });

console.log('[preload] Model ready and cached.');
