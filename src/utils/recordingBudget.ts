import type { AudioItem } from '../types.ts';

// Leave ample room under Firestore's 1 MiB document ceiling (UTF-8 metadata,
// field names and server-side userId included). Base64 itself is ASCII.
export const AUDIO_DOCUMENT_BUDGET = 900_000;
export function recordingBudget(item: AudioItem): number {
  const metadata = { ...item, myRecordingBase64: '', myRecordingUrl: null };
  return Math.max(0, AUDIO_DOCUMENT_BUDGET - new TextEncoder().encode(JSON.stringify(metadata)).length - 4096);
}
export function base64Size(bytes: number): number { return 4 * Math.ceil(bytes / 3) + 64; }
export function speechBitrate(duration: number, maxBase64: number): number | null {
  // MP3 headers and padding vary; reserve 10% plus a small fixed allowance.
  return [32, 24, 16].find(rate => base64Size(duration * rate * 1000 / 8 * 1.1 + 4096) <= maxBase64) ?? null;
}
