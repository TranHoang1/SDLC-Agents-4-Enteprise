/**
 * WebModule — Unit tests for security/utility helpers.
 * Covers SsrfGuard, RateLimiter, ContentTruncator, UrlValidator, GitUrlParser,
 * HtmlExtractor, ResponseCache, and WebToolError.
 */

import { describe, it, expect, vi } from 'vitest';
import { SsrfGuard } from '../middleware/SsrfGuard.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { ContentTruncator } from '../middleware/ContentTruncator.js';
import { validateUrl } from '../utils/UrlValidator.js';
import { parseGitUrl } from '../utils/GitUrlParser.js';
import { HtmlExtractor } from '../utils/HtmlExtractor.js';
import { ResponseCache } from '../utils/ResponseCache.js';
import { WebToolError } from '../models/WebError.js';

describe('WebToolError', () => {
  it('carries code, message, and optional details', () => {
    const err = new WebToolError('SSRF_BLOCKED', 'Blocked', { ip: '10.0.0.1' });
    expect(err.name).toBe('WebToolError');
    expect(err.code).toBe('SSRF_BLOCKED');
    expect(err.details).toEqual({ ip: '10.0.0.1' });
    expect(err.message).toBe('Blocked');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('validateUrl', () => {
  it('returns a URL for http', () => {
    const url = validateUrl('https://example.com/foo');
    expect(url.hostname).toBe('example.com');
  });

  it('rejects empty or non-string input', () => {
    expect(() => validateUrl('')).toThrowError(/empty/);
    expect(() => validateUrl(undefined as never)).toThrowError(/empty/);
  });

  it('rejects malformed URLs', () => {
    expect(() => validateUrl('not a url')).toThrow(WebToolError);
  });

  it('rejects disallowed protocols', () => {
    expect(() => validateUrl('file:///etc/passwd')).toThrowError(/Protocol/);
    expect(() => validateUrl('ftp://example.com')).toThrowError(/Protocol/);
  });
});

describe('SsrfGuard', () => {
  const guard = new SsrfGuard(['127.0.0.1']);

  it('isBlocked detects private IPv4 ranges', () => {
    expect(guard.isBlocked('127.0.0.1')).toBe(true);
    expect(guard.isBlocked('10.1.2.3')).toBe(true);
    expect(guard.isBlocked('172.16.0.1')).toBe(true);
    expect(guard.isBlocked('172.31.255.255')).toBe(true);
    expect(guard.isBlocked('192.168.1.1')).toBe(true);
    expect(guard.isBlocked('169.254.0.1')).toBe(true);
    expect(guard.isBlocked('0.0.0.0')).toBe(true);
    expect(guard.isBlocked('8.8.8.8')).toBe(false);
    expect(guard.isBlocked('172.32.0.1')).toBe(false);
  });

  it('isBlocked detects private IPv6 ranges', () => {
    expect(guard.isBlocked('::1')).toBe(true);
    expect(guard.isBlocked('fc00::1')).toBe(true);
    expect(guard.isBlocked('fd12:3456::1')).toBe(true);
    expect(guard.isBlocked('fe80::1')).toBe(true);
    expect(guard.isBlocked('2001:4860:4860::8888')).toBe(false);
  });

  it('throws INVALID_URL for malformed URLs', async () => {
    await expect(guard.validate('garbage')).rejects.toThrowError(/Invalid URL/);
  });

  it('throws INVALID_URL for disallowed protocols', async () => {
    await expect(guard.validate('file:///etc/passwd')).rejects.toThrowError(/Protocol not allowed/);
  });

  it('throws SSRF_BLOCKED when a literal IP is private', async () => {
    const err = await guard.validate('http://127.0.0.1/admin')
      .then(() => null, (e: WebToolError) => e);
    expect(err).toBeInstanceOf(WebToolError);
    expect(err!.code).toBe('SSRF_BLOCKED');
    expect(err!.details).toEqual({ ip: '127.0.0.1' });
  });

  it('returns the IP for safe public literal hosts', async () => {
    const ip = await guard.validate('http://8.8.8.8/ping');
    expect(ip).toBe('8.8.8.8');
  });
});

describe('RateLimiter', () => {
  it('allows the configured number of requests', () => {
    const limiter = new RateLimiter(3);
    expect(limiter.consume('tool').allowed).toBe(true);
    expect(limiter.consume('tool').allowed).toBe(true);
    const third = limiter.consume('tool');
    expect(third.allowed).toBe(true);
  });

  it('rejects requests beyond the limit', () => {
    const limiter = new RateLimiter(2);
    limiter.consume('tool');
    limiter.consume('tool');
    const result = limiter.consume('tool');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetMs).toBeGreaterThan(0);
  });

  it('keeps independent buckets per tool', () => {
    const limiter = new RateLimiter(1);
    expect(limiter.consume('a').allowed).toBe(true);
    expect(limiter.consume('a').allowed).toBe(false);
    expect(limiter.consume('b').allowed).toBe(true);
  });

  it('consumeOrThrow throws WebToolError on exhaustion', () => {
    const limiter = new RateLimiter(1);
    limiter.consume('tool');
    expect(() => limiter.consumeOrThrow('tool')).toThrow(WebToolError);
    expect(() => limiter.consumeOrThrow('tool')).toThrowError(/Rate limit exceeded/);
  });

  it('does not throw when under the limit', () => {
    const limiter = new RateLimiter(2);
    expect(() => limiter.consumeOrThrow('tool')).not.toThrow();
  });
});

describe('ContentTruncator', () => {
  it('passes content through when under the limit', () => {
    const truncator = new ContentTruncator(1); // 1KB
    const result = truncator.truncate('abc');
    expect(result).toEqual({ content: 'abc', truncated: false, originalLength: 3 });
  });

  it('truncates content above the limit', () => {
    const truncator = new ContentTruncator(1); // 1KB
    const big = 'x'.repeat(2048);
    const result = truncator.truncate(big);
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBe(1024);
    expect(result.originalLength).toBe(2048);
  });

  it('supports a per-call custom limit', () => {
    const truncator = new ContentTruncator(10);
    const result = truncator.truncate('hello', 3);
    expect(result.truncated).toBe(true);
    expect(result.content).toBe('hel');
  });
});

describe('parseGitUrl', () => {
  it('parses a GitHub blob URL with path and ref', () => {
    const parsed = parseGitUrl('https://github.com/owner/repo/blob/main/src/a.ts');
    expect(parsed).toEqual({
      host: 'github.com',
      owner: 'owner',
      repo: 'repo',
      ref: 'main',
      path: 'src/a.ts',
    });
  });

  it('strips .git suffix from repo names', () => {
    const parsed = parseGitUrl('https://gitlab.com/gitlab-org/gitlab.git');
    expect(parsed.repo).toBe('gitlab');
  });

  it('rejects unsupported hosts', () => {
    expect(() => parseGitUrl('https://bitbucket.org/o/r')).toThrowError(/Unsupported git host/);
  });

  it('rejects URLs without owner/repo', () => {
    expect(() => parseGitUrl('https://github.com/onlyOwner')).toThrowError(/owner\/repo/);
  });

  it('rejects malformed URLs', () => {
    expect(() => parseGitUrl('not-a-url')).toThrowError(/Cannot parse/);
  });

  it('leaves ref/path undefined for plain repo URLs', () => {
    expect(parseGitUrl('https://github.com/o/r')).toEqual({
      host: 'github.com', owner: 'o', repo: 'r', path: undefined, ref: undefined,
    });
  });
});

describe('HtmlExtractor', () => {
  const extractor = new HtmlExtractor();

  it('strips tags and decodes entities', () => {
    const text = extractor.toText('<p>Hello &amp; &lt;World&gt;</p><script>evil()</script>');
    expect(text).toBe('Hello & <World>');
  });

  it('removes style and script content entirely', () => {
    const text = extractor.toText('<div>Keep<style>.x{color:red}</style></div><script>alert(1)</script>');
    expect(text).toContain('Keep');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('.x');
  });

  it('converts block tags to newlines', () => {
    const text = extractor.toText('<p>One</p><p>Two</p>');
    expect(text).toBe('One\nTwo');
  });

  it('returns empty string for empty / whitespace input', () => {
    expect(extractor.toText('')).toBe('');
    expect(extractor.toText(null as never)).toBe('');
  });

  it('extracts content by class selector', () => {
    const html = '<div><div class="article">Hello World</div><div>ignored</div></div>';
    const text = extractor.extractBySelector(html, '.article');
    expect(text).toBe('Hello World');
  });

  it('extracts content by id selector', () => {
    const html = '<figure><img><figcaption id="cap">Caption text</figcaption></figure>';
    const text = extractor.extractBySelector(html, '#cap');
    expect(text).toBe('Caption text');
  });

  it('extracts content by element selector', () => {
    const html = '<main><article>Content here</article></main>';
    const text = extractor.extractBySelector(html, 'article');
    expect(text).toBe('Content here');
  });

  it('returns empty when selector does not match', () => {
    expect(extractor.extractBySelector('<div>no</div>', '.missing')).toBe('');
  });
});

describe('ResponseCache', () => {
  it('stores and retrieves values within TTL', () => {
    const cache = new ResponseCache<string>(60_000);
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
    expect(cache.size).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const cache = new ResponseCache<string>(60_000);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('drops expired entries on get', () => {
    const cache = new ResponseCache<string>(-1); // already expired on set
    cache.set('k', 'v');
    expect(cache.get('k')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('purges expired entries', () => {
    const cache = new ResponseCache<string>(-1);
    cache.set('k1', 'v1');
    cache.purgeExpired();
    expect(cache.size).toBe(0);
  });

  it('evicts LRU entry on overflow', () => {
    vi.useFakeTimers();
    try {
      const cache = new ResponseCache<string>(60_000, 2);
      cache.set('a', '1');
      vi.advanceTimersByTime(10);
      cache.set('b', '2');
      vi.advanceTimersByTime(10);
      cache.get('a'); // touch 'a' so 'b' becomes the least recently accessed
      vi.advanceTimersByTime(10);
      cache.set('c', '3'); // evicts 'b'
      expect(cache.get('a')).toBe('1');
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe('3');
    } finally {
      vi.useRealTimers();
    }
  });
});