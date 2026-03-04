import { describe, it } from 'node:test';
import assert from 'node:assert';
import { toImageUrl } from './emailService.js';

describe('toImageUrl', () => {
  const baseUrl = 'https://app.aisanomat.fi';

  it('passes through absolute https URL unchanged', () => {
    const ogUrl = 'https://cdn.reuters.com/photo.jpg';
    assert.strictEqual(toImageUrl(ogUrl, baseUrl), ogUrl);
  });

  it('passes through absolute http URL unchanged', () => {
    const ogUrl = 'http://example.com/image.png';
    assert.strictEqual(toImageUrl(ogUrl, baseUrl), ogUrl);
  });

  it('prefixes relative path starting with / with API base URL', () => {
    assert.strictEqual(
      toImageUrl('/images/abc123.png', baseUrl),
      'https://app.aisanomat.fi/api/images/abc123.png'
    );
  });

  it('prefixes relative path without leading / with API base URL', () => {
    assert.strictEqual(
      toImageUrl('images/abc123.png', baseUrl),
      'https://app.aisanomat.fi/api/images/abc123.png'
    );
  });

  it('works with localhost base URL', () => {
    assert.strictEqual(
      toImageUrl('/images/test.png', 'http://localhost:3000'),
      'http://localhost:3000/api/images/test.png'
    );
  });
});
