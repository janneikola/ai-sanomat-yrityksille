import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeHealthStatus } from './sourceHealthService.js';

describe('computeHealthStatus', () => {
  it('returns green with 0 consecutive failures', () => {
    const result = computeHealthStatus({
      isActive: true,
      consecutiveFailures: 0,
      lastItemsAt: new Date(),
      lastItemCount: 5,
    });
    assert.strictEqual(result, 'green');
  });

  it('returns yellow with 2 consecutive failures', () => {
    const result = computeHealthStatus({
      isActive: true,
      consecutiveFailures: 2,
      lastItemsAt: new Date(),
      lastItemCount: 5,
    });
    assert.strictEqual(result, 'yellow');
  });

  it('returns yellow with 3 consecutive failures', () => {
    const result = computeHealthStatus({
      isActive: true,
      consecutiveFailures: 3,
      lastItemsAt: new Date(),
      lastItemCount: 5,
    });
    assert.strictEqual(result, 'yellow');
  });

  it('returns red with 4 consecutive failures', () => {
    const result = computeHealthStatus({
      isActive: true,
      consecutiveFailures: 4,
      lastItemsAt: null,
      lastItemCount: null,
    });
    assert.strictEqual(result, 'red');
  });

  it('returns red with 5+ consecutive failures', () => {
    const result = computeHealthStatus({
      isActive: true,
      consecutiveFailures: 5,
      lastItemsAt: null,
      lastItemCount: null,
    });
    assert.strictEqual(result, 'red');
  });

  it('returns yellow when stale (0 items for 7+ days)', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const result = computeHealthStatus({
      isActive: true,
      consecutiveFailures: 0,
      lastItemsAt: eightDaysAgo,
      lastItemCount: 0,
    });
    assert.strictEqual(result, 'yellow');
  });

  it('returns green when items received within 7 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = computeHealthStatus({
      isActive: true,
      consecutiveFailures: 0,
      lastItemsAt: threeDaysAgo,
      lastItemCount: 5,
    });
    assert.strictEqual(result, 'green');
  });

  it('returns red for inactive source', () => {
    const result = computeHealthStatus({
      isActive: false,
      consecutiveFailures: 0,
      lastItemsAt: new Date(),
      lastItemCount: 5,
    });
    assert.strictEqual(result, 'red');
  });

  it('returns green when lastItemsAt is null and no failures (new source)', () => {
    const result = computeHealthStatus({
      isActive: true,
      consecutiveFailures: 0,
      lastItemsAt: null,
      lastItemCount: null,
    });
    assert.strictEqual(result, 'green');
  });
});
