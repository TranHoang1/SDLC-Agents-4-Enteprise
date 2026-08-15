/**
 * SA4E-169 — Unit tests for the token-based text Chunker.
 */

import { describe, it, expect } from 'vitest';
import { Chunker } from '../chunker.js';

describe('Chunker', () => {
  it('returns a single chunk for text within maxTokens', () => {
    const chunker = new Chunker(512, 128);
    const text = 'a b c d e f';
    const chunks = chunker.chunk(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      text,
      index: 0,
      tokenCount: 6,
      startOffset: 0,
      endOffset: text.length,
    });
  });

  it('splits text longer than maxTokens into overlapping chunks', () => {
    const chunker = new Chunker(4, 2);
    const text = 'one two three four five six seven eight';
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].tokenCount).toBe(4);
    expect(chunks[0].text).toBe('one two three four');
    expect(chunks[1].tokenCount).toBe(4);
    expect(chunks[1].text).toBe('three four five six');
  });

  it('overlaps chunks by the configured token count', () => {
    const chunker = new Chunker(5, 2);
    const chunks = chunker.chunk('a b c d e f g h i j k l');
    expect(chunks.map(c => c.text)).toEqual(['a b c d e', 'd e f g h', 'g h i j k', 'j k l']);
    expect(chunks[1].text.split(' ').slice(-2)).toEqual(['g', 'h']);
    expect(chunks[2].text.split(' ').slice(-2)).toEqual(['j', 'k']);
  });

  it('assigns sequential indexes and token offsets', () => {
    const chunker = new Chunker(3, 1);
    const chunks = chunker.chunk('a b c d e f g h i');
    expect(chunks.map(c => c.index)).toEqual([0, 1, 2, 3, 4]);
    expect(chunks.map(c => c.startOffset)).toEqual([0, 2, 4, 6, 8]);
    expect(chunks.map(c => c.endOffset)).toEqual([3, 5, 7, 9, 9]);
  });

  it('emits a trailing remainder chunk after the last full chunk', () => {
    const chunker = new Chunker(4, 2);
    const chunks = chunker.chunk('a b c d e f');
    expect(chunks.map(c => c.text)).toEqual(['a b c d', 'c d e f', 'e f']);
    expect(chunks.map(c => c.tokenCount)).toEqual([4, 4, 2]);
  });

  it('emits a short remainder chunk when the tail is smaller than overlap', () => {
    const chunker = new Chunker(4, 1);
    const chunks = chunker.chunk('a b c d e f g');
    expect(chunks.map(c => c.text)).toEqual(['a b c d', 'd e f g', 'g']);
  });

  it('handles empty and whitespace-only text', () => {
    const chunker = new Chunker(4, 2);
    expect(chunker.chunk('')).toEqual([{
      text: '',
      index: 0,
      tokenCount: 0,
      startOffset: 0,
      endOffset: 0,
    }]);
    expect(chunker.chunk('   \n  ')).toHaveLength(1);
  });

  it('reports configured limits via getters', () => {
    const chunker = new Chunker(100, 40);
    expect(chunker.getMaxTokens()).toBe(100);
    expect(chunker.getOverlap()).toBe(40);
  });
});