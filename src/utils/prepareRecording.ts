import { base64Size, speechBitrate } from './recordingBudget';

export async function prepareRecording(blob: Blob, maxBase64: number): Promise<Blob> {
  if (!blob.size) throw new Error('녹음 데이터가 비어 있습니다. 마이크를 확인해 주세요.');
  if (base64Size(blob.size) <= maxBase64) return blob;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) throw new Error('이 기기에서 녹음을 압축할 수 없습니다. 녹음 파일을 내려받아 보관하거나 더 짧게 나눠 주세요.');
  const context: AudioContext = new AudioCtx();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const bitrate = speechBitrate(decoded.duration, maxBase64);
    if (!bitrate) throw new Error('압축해도 저장 용량을 넘는 긴 녹음입니다. 파일을 내려받아 보관하고 녹음을 나눠 주세요.');
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 22050), 22050);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const rendered = await offline.startRendering();
    const { Mp3Encoder } = await import('@breezystack/lamejs');
    const encoder = new Mp3Encoder(1, 22050, bitrate);
    const pcm = rendered.getChannelData(0), parts: Uint8Array[] = [];
    for (let offset = 0; offset < pcm.length; offset += 1152) {
      const block = new Int16Array(Math.min(1152, pcm.length - offset));
      for (let i = 0; i < block.length; i++) { const value = Math.max(-1, Math.min(1, pcm[offset + i])); block[i] = value < 0 ? value * 32768 : value * 32767; }
      const bytes = encoder.encodeBuffer(block); if (bytes.length) parts.push(new Uint8Array(bytes));
      if (offset % (1152 * 64) === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    const tail = encoder.flush(); if (tail.length) parts.push(new Uint8Array(tail));
    const compressed = new Blob(parts, { type: 'audio/mpeg' });
    if (base64Size(compressed.size) > maxBase64) throw new Error('압축 후에도 용량을 넘었습니다. 녹음을 내려받아 보관하고 나눠서 녹음해 주세요.');
    return compressed;
  } finally { await context.close().catch(() => {}); }
}
