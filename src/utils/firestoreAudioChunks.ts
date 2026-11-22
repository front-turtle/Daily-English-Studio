import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { firestoreChunkedAudioUrl } from './audioLimits';
export { firestoreAudioChunkCount } from './audioLimits';
import { db } from '../lib/firebase';

// Firestore documents are limited to 1 MiB. Keep original audio unchanged,
// splitting its base64 representation across ordinary owner-protected documents.
const CHUNK_LENGTH = 450_000;
const MAX_CHUNKS = 32;

function chunkDocId(audioId: string, index: number): string {
  return `${audioId}__original_chunk_${index}`;
}

/**
 * Atomically persist original (uncompressed) audio and its metadata.
 * Store chunks in the existing audioItems collection so current deployed
 * Firestore owner permissions work without a rules migration.
 * Subscribers must ignore documents whose kind is audio-chunk.
 */
export async function writeChunkedAudioItem(
  userId: string,
  audioId: string,
  dataUrl: string,
  metadata: Record<string, unknown>
): Promise<string> {
  const count = Math.ceil(dataUrl.length / CHUNK_LENGTH);
  if (count < 1 || count > MAX_CHUNKS) {
    throw new Error('음성 파일 저장 크기를 초과했습니다.');
  }

  const marker = firestoreChunkedAudioUrl(count);
  const batch = writeBatch(db);
  for (let i = 0; i < count; i++) {
    batch.set(doc(db, 'audioItems', chunkDocId(audioId, i)), {
      kind: 'audio-chunk',
      userId,
      parentAudioId: audioId,
      chunkIndex: i,
      payload: dataUrl.slice(i * CHUNK_LENGTH, (i + 1) * CHUNK_LENGTH),
    });
  }
  batch.set(doc(db, 'audioItems', audioId), {
    ...metadata,
    audioBase64: '',
    audioUrl: marker,
  });
  await batch.commit();
  return marker;
}

export async function readChunkedAudio(audioId: string, count: number): Promise<string> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) {
    throw new Error('음성 파일 저장 정보가 올바르지 않습니다.');
  }
  const pieces = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      getDoc(doc(db, 'audioItems', chunkDocId(audioId, index)))
    )
  );
  const dataUrl = pieces.map((snap, index) => {
    if (!snap.exists()) throw new Error('음성 파일 일부를 찾을 수 없습니다.');
    const data = snap.data();
    if (data.kind !== 'audio-chunk' ||
        data.parentAudioId !== audioId ||
        data.chunkIndex !== index ||
        typeof data.payload !== 'string') {
      throw new Error('음성 파일 저장 데이터가 손상되었습니다.');
    }
    return data.payload as string;
  }).join('');
  if (!dataUrl.startsWith('data:') || !dataUrl.includes(';base64,')) {
    throw new Error('음성 파일 형식이 올바르지 않습니다.');
  }
  return dataUrl;
}

export async function deleteChunkedAudioItem(audioId: string, count: number): Promise<void> {
  const batch = writeBatch(db);
  if (count > 0 && count <= MAX_CHUNKS) {
    for (let i = 0; i < count; i++) {
      batch.delete(doc(db, 'audioItems', chunkDocId(audioId, i)));
    }
  }
  batch.delete(doc(db, 'audioItems', audioId));
  await batch.commit();
}
