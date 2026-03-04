import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isGenericImageUrl } from './ogService.js';

describe('isGenericImageUrl', () => {
  it('returns false for a normal article image', () => {
    assert.strictEqual(
      isGenericImageUrl('https://cdn.example.com/images/article-photo.jpg'),
      false
    );
  });

  it('returns true for URL containing "default"', () => {
    assert.strictEqual(
      isGenericImageUrl('https://example.com/assets/logo-default.png'),
      true
    );
  });

  it('returns true for URL containing "placeholder"', () => {
    assert.strictEqual(
      isGenericImageUrl('https://cdn.example.com/images/placeholder_hero.jpg'),
      true
    );
  });

  it('returns true for URL containing "fallback"', () => {
    assert.strictEqual(
      isGenericImageUrl('https://example.com/og-fallback.jpg'),
      true
    );
  });

  it('returns true for URL containing "logo"', () => {
    assert.strictEqual(
      isGenericImageUrl('https://example.com/assets/logo.png'),
      true
    );
  });

  it('returns false for a valid news story image', () => {
    assert.strictEqual(
      isGenericImageUrl('https://news.example.com/images/story-2024.jpg'),
      false
    );
  });

  it('is case-insensitive', () => {
    assert.strictEqual(
      isGenericImageUrl('https://example.com/DEFAULT-hero.png'),
      true
    );
    assert.strictEqual(
      isGenericImageUrl('https://example.com/PLACEHOLDER.jpg'),
      true
    );
  });
});
