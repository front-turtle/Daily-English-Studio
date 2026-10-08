import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expressionReviewInput, parseExpressionReview } from '../src/lib/expressionReviewData.ts';
test('expression review distinguishes source direction and pair review', () => {
  assert.equal(expressionReviewInput('', ' 검토했다 ').mode, 'ko-en');
  assert.equal(expressionReviewInput(' reviewed ', '').mode, 'en-ko');
  assert.deepEqual(expressionReviewInput(' reviewed ', ' 해결했다 '), { mode: 'review-pair', sourceEnglish: 'reviewed', proposedKoreanMeaning: '해결했다' });
  assert.throws(() => expressionReviewInput(' ', ''));
  assert.throws(() => expressionReviewInput('a'.repeat(2001), ''));
});
test('invalid AI suggestions cannot be applied', () => {
  assert.throws(() => parseExpressionReview('{}'));
  assert.throws(() => parseExpressionReview('{"english":"a","korean":" ","feedback":"b"}'));
  assert.deepEqual(parseExpressionReview('{"english":" reviewed ","korean":" 검토했다 ","feedback":" 의미 수정 "}'), { english: 'reviewed', korean: '검토했다', feedback: '의미 수정' });
});
