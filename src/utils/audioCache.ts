import type { AudioItem } from '../types.ts';
import { base64ToBlob, blobToBase64, getAudioFromStorage, saveAudioToStorage } from './audioStorage.ts';

// Serialize fallback writes so an older, slower snapshot cannot replace a new one.
let queue: Promise<void> = Promise.resolve();
export function cacheAudioItems(items: AudioItem[]): Promise<void> {
  const save = async () => {
    try { localStorage.setItem('audio_items_v2', JSON.stringify(items)); return; } catch {}
    const metadata: AudioItem[] = [];
    for (const item of items) {
      const compact = { ...item };
      if (item.audioBase64) {
        await saveAudioToStorage(item.id, base64ToBlob(item.audioBase64), true);
        compact.audioBase64 = ''; compact.audioUrl = `indexeddb:${item.id}`;
      }
      if (item.myRecordingBase64) {
        await saveAudioToStorage(`rec-${item.id}`, base64ToBlob(item.myRecordingBase64), true);
        compact.myRecordingBase64 = null; compact.myRecordingUrl = `indexeddb:rec-${item.id}`;
      }
      metadata.push(compact);
    }
    // Only discard inline audio once the corresponding binary writes succeeded.
    localStorage.setItem('audio_items_v2', JSON.stringify(metadata));
  };
  const result = queue.catch(() => {}).then(save); queue = result; return result;
}

export async function hydrateAudioItems(items: AudioItem[], strict = false): Promise<AudioItem[]> {
  return Promise.all(items.map(async item => {
    const restored = { ...item };
    if (!item.audioBase64 && item.audioUrl?.startsWith('indexeddb:')) {
      const blob = await getAudioFromStorage(item.id);
      if (!blob && strict) throw new Error('기기에 보관된 원본 음성을 찾을 수 없어 백업을 중단했습니다.');
      if (blob) { restored.audioBase64 = await blobToBase64(blob); restored.audioUrl = ''; }
    }
    if (!item.myRecordingBase64 && item.myRecordingUrl?.startsWith('indexeddb:')) {
      const blob = await getAudioFromStorage(`rec-${item.id}`);
      if (!blob && strict) throw new Error('기기에 보관된 녹음을 찾을 수 없어 백업을 중단했습니다.');
      if (blob) { restored.myRecordingBase64 = await blobToBase64(blob); restored.myRecordingUrl = null; }
    }
    return restored;
  }));
}
