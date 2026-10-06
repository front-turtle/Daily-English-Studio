import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANDSCAPE_STAGES, landscapeForStreak } from '../src/lib/growthLandscape.ts';

test('visual milestones switch on the exact existing growth day and preserve the scene between milestones', () => {
  for (let i = 0; i < LANDSCAPE_STAGES.length; i++) {
    const stage = LANDSCAPE_STAGES[i];
    assert.equal(landscapeForStreak(stage.days).key, stage.key);
    if (i) assert.equal(landscapeForStreak(stage.days - 1).key, LANDSCAPE_STAGES[i - 1].key);
    if (i + 1 < LANDSCAPE_STAGES.length) assert.equal(landscapeForStreak(LANDSCAPE_STAGES[i + 1].days - 1).key, stage.key);
  }
  assert.equal(landscapeForStreak(365).key, 'earth');
  assert.equal(landscapeForStreak(800).key, 'earth');
});

test('a reset streak returns to the meadow without retaining the former forest', () => {
  assert.equal(landscapeForStreak(210).key, 'paradise');
  assert.equal(landscapeForStreak(0).key, 'meadow');
  assert.equal(landscapeForStreak(-1).key, 'meadow');
  assert.equal(landscapeForStreak(NaN).key, 'meadow');
});
