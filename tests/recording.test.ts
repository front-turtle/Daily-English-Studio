import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mp3Encoder } from '@breezystack/lamejs';
import { indexedDB, IDBDatabase } from 'fake-indexeddb';
import { recordingBudget, base64Size, speechBitrate } from '../src/utils/recordingBudget.ts';
import { cacheAudioItems, hydrateAudioItems } from '../src/utils/audioCache.ts';
import { base64ToBlob, normalizeAudioMimeType, saveAudioToStorage } from '../src/utils/audioStorage.ts';

const item = { id: 'audio-test', title: 'test', fileName: 'test.mp3', audioUrl: '', date: '2026-09-26', createdAt: 1, audioBase64: 'data:audio/mpeg;base64,' + 'A'.repeat(390000) };

test('20, 60 and 120 second speech encodes fit the actual combined document budget', () => {
  const budget = recordingBudget(item);
  for (const duration of [20, 60, 120]) {
    const bitrate = speechBitrate(duration, budget);
    assert.ok(bitrate);
    const encoder = new Mp3Encoder(1, 22050, bitrate!);
    let bytes = 0;
    for (let offset = 0; offset < duration * 22050; offset += 1152) {
      const samples = Int16Array.from({ length: Math.min(1152, duration * 22050 - offset) }, (_, i) => Math.sin((offset + i) * 440 * 2 * Math.PI / 22050) * 12000);
      bytes += encoder.encodeBuffer(samples).length;
    }
    bytes += encoder.flush().length;
    assert.ok(bytes > 0);
    assert.ok(base64Size(bytes) <= budget, `${duration}s output fits`);
  }
  assert.equal(speechBitrate(3600, budget), null);
  assert.ok(recordingBudget({ ...item, transcript: '한글'.repeat(1000) }) < budget - 2900);
  assert.equal(normalizeAudioMimeType('audio/ogg;codecs=opus'), 'audio/ogg');
});

test('quota fallback persists audio in IndexedDB, survives reload, and does not silently accept storage failure', async () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { indexedDB } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    setItem(key: string, value: string) { if (value.length > 1000) throw new Error('QuotaExceededError'); values.set(key, value); },
    getItem(key: string) { return values.get(key) ?? null; },
  } });
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: class {
    result = ''; onload: (() => void) | null = null;
    async readAsDataURL(blob: Blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onload?.(); }
  } });
  const recording = 'data:audio/webm;base64,' + Buffer.from('recording'.repeat(1500)).toString('base64');
  await cacheAudioItems([{ ...item, myRecordingBase64: recording, myRecordingDuration: 60 }]);
  const metadata = JSON.parse(values.get('audio_items_v2')!);
  assert.equal(metadata[0].myRecordingUrl, 'indexeddb:rec-audio-test');
  assert.equal(metadata[0].audioBase64, '');
  const hydrated = await hydrateAudioItems(metadata, true);
  assert.equal(hydrated[0].myRecordingBase64, recording);
  assert.equal(hydrated[0].myRecordingDuration, 60);
  assert.equal(hydrated[0].audioBase64, item.audioBase64);
  const originalTransaction = IDBDatabase.prototype.transaction;
  try {
    IDBDatabase.prototype.transaction = function() { throw new Error('disk full'); };
    await assert.rejects(saveAudioToStorage('failure', base64ToBlob(recording), true), /disk full/);
    await assert.rejects(cacheAudioItems([{ ...item, myRecordingBase64: recording + 'AAAA' }]), /disk full/);
    assert.equal(values.get('audio_items_v2'), JSON.stringify(metadata));
  } finally { IDBDatabase.prototype.transaction = originalTransaction; }
});
