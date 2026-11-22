import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_UPLOAD_TOO_LARGE_MESSAGE,
  MAX_AUDIO_UPLOAD_BYTES,
  base64AudioByteLength,
  firestoreAudioChunkCount,
  firestoreChunkedAudioUrl,
} from '../src/utils/audioLimits.ts';

test('5MB is accepted unchanged by the size guard, 5MB + 1 byte is rejected', () => {
  const exact = 'data:audio/mpeg;base64,' + Buffer.alloc(MAX_AUDIO_UPLOAD_BYTES).toString('base64');
  const tooLarge = 'data:audio/mpeg;base64,' + Buffer.alloc(MAX_AUDIO_UPLOAD_BYTES + 1).toString('base64');
  assert.equal(base64AudioByteLength(exact), MAX_AUDIO_UPLOAD_BYTES);
  assert.equal(base64AudioByteLength(tooLarge), MAX_AUDIO_UPLOAD_BYTES + 1);
  assert.ok(base64AudioByteLength(exact) <= MAX_AUDIO_UPLOAD_BYTES);
  assert.ok(base64AudioByteLength(tooLarge) > MAX_AUDIO_UPLOAD_BYTES);
  assert.match(AUDIO_UPLOAD_TOO_LARGE_MESSAGE, /5MB/);
});

test('Firestore chunk metadata can identify ordered original audio parts', () => {
  assert.equal(firestoreChunkedAudioUrl(16), 'firestore-chunks:16');
  assert.equal(firestoreAudioChunkCount('firestore-chunks:16'), 16);
  assert.equal(firestoreAudioChunkCount('firestore-chunks:0'), 0);
  assert.equal(firestoreAudioChunkCount('firestore-chunks:33'), 0);
  assert.equal(firestoreAudioChunkCount(''), 0);
});
