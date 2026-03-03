import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeSatisfaction } from './feedbackService.js';

describe('computeSatisfaction', () => {
  it('returns correct scores for 3 up and 1 down', () => {
    const result = computeSatisfaction(3, 1);
    assert.deepStrictEqual(result, {
      totalVotes: 4,
      thumbsUp: 3,
      thumbsDown: 1,
      satisfaction: 75,
      flagged: false,
    });
  });

  it('returns flagged=true when satisfaction below 50% and at least 3 votes', () => {
    const result = computeSatisfaction(1, 3);
    assert.deepStrictEqual(result, {
      totalVotes: 4,
      thumbsUp: 1,
      thumbsDown: 3,
      satisfaction: 25,
      flagged: true,
    });
  });

  it('returns null satisfaction and flagged=false when 0 votes', () => {
    const result = computeSatisfaction(0, 0);
    assert.deepStrictEqual(result, {
      totalVotes: 0,
      thumbsUp: 0,
      thumbsDown: 0,
      satisfaction: null,
      flagged: false,
    });
  });

  it('does not flag when below 50% but fewer than 3 total votes', () => {
    const result = computeSatisfaction(0, 2);
    assert.deepStrictEqual(result, {
      totalVotes: 2,
      thumbsUp: 0,
      thumbsDown: 2,
      satisfaction: 0,
      flagged: false,
    });
  });

  it('returns 100% satisfaction with all thumbs up', () => {
    const result = computeSatisfaction(5, 0);
    assert.deepStrictEqual(result, {
      totalVotes: 5,
      thumbsUp: 5,
      thumbsDown: 0,
      satisfaction: 100,
      flagged: false,
    });
  });

  it('returns 50% satisfaction when equal votes', () => {
    const result = computeSatisfaction(2, 2);
    assert.deepStrictEqual(result, {
      totalVotes: 4,
      thumbsUp: 2,
      thumbsDown: 2,
      satisfaction: 50,
      flagged: false,
    });
  });

  it('rounds satisfaction to nearest integer', () => {
    const result = computeSatisfaction(1, 2);
    // 1/3 = 0.333... → 33%
    assert.equal(result.satisfaction, 33);
    assert.equal(result.flagged, true); // 33% < 50% and 3 votes
  });
});
