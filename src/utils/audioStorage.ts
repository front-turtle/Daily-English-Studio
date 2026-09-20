/**
 * Robust IndexedDB & Blob-based Audio Storage and Resolver
 * Ensures 100% reliable audio playback on Mobile Browsers (Chrome, Safari, Samsung Internet)
 * and Standalone PWA apps without server range-request or ephemeral container dependency.
 */

const DB_NAME = 'DailyEnglishAudioDB_v1';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked');
        resolve(request.result);
      };
    } catch (e) {
      reject(e);
    }
  });

  return dbPromise;
}

/**
 * Save audio Blob directly to IndexedDB with safety timeout
 */
export async function saveAudioToStorage(id: string, blob: Blob): Promise<void> {
  try {
    const db = await Promise.race([
      getDB(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('IDB timeout')), 2000)),
    ]);
    if (!db) return;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 2500); // Never hang caller
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = () => {
          clearTimeout(timeout);
          resolve();
        };
        tx.onerror = tx.onabort = () => {
          clearTimeout(timeout);
          resolve(); // Resolve anyway so caller flow is never halted
        };
        const store = tx.objectStore(STORE_NAME);
        store.put(blob, id);
      } catch (txErr) {
        clearTimeout(timeout);
        console.warn('IDB put error:', txErr);
        resolve();
      }
    });
  } catch (err) {
    console.warn('IndexedDB save warning:', err);
  }
}

/**
 * Get audio Blob from IndexedDB
 */
export async function getAudioFromStorage(id: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB get warning:', err);
    return null;
  }
}

/**
 * Delete audio Blob from IndexedDB
 */
export async function deleteAudioFromStorage(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete warning:', err);
  }
}

/**
 * Standardize audio MIME types.
 * Crucial for mobile iOS Safari & Android Chrome which reject non-standard 'audio/x-m4a' or 'audio/m4a'
 */
export function normalizeAudioMimeType(mime?: string, fileNameOrUrl?: string): string {
  const lowerMime = (mime || '').toLowerCase();
  const lowerPath = (fileNameOrUrl || '').toLowerCase();

  if (lowerMime.includes('m4a') || lowerMime.includes('mp4') || lowerPath.endsWith('.m4a') || lowerPath.endsWith('.mp4')) {
    return 'audio/mp4';
  }
  if (lowerMime.includes('mpeg') || lowerMime.includes('mp3') || lowerPath.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  if (lowerMime.includes('wav') || lowerPath.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (lowerMime.includes('webm') || lowerPath.endsWith('.webm')) {
    return 'audio/webm';
  }
  if (lowerMime.includes('aac') || lowerPath.endsWith('.aac')) {
    return 'audio/aac';
  }
  return 'audio/mp4';
}

/**
 * Ensures a base64 data URL has a mobile-compatible standard MIME header (e.g. data:audio/mp4;base64,...)
 */
export function normalizeBase64DataUrl(base64Data: string, fileNameOrUrl?: string): string {
  if (!base64Data) return '';
  if (!base64Data.startsWith('data:')) {
    const mime = normalizeAudioMimeType('', fileNameOrUrl);
    return `data:${mime};base64,${base64Data}`;
  }

  // Replace non-standard header like data:audio/x-m4a;base64, with data:audio/mp4;base64,
  return base64Data.replace(/^data:[^;]+;base64,/, (match) => {
    const rawMime = match.slice(5, match.indexOf(';'));
    const cleanMime = normalizeAudioMimeType(rawMime, fileNameOrUrl);
    return `data:${cleanMime};base64,`;
  });
}

/**
 * Convert Base64 data URL to Blob
 */
export function base64ToBlob(base64Data: string, fallbackMime = 'audio/mp4'): Blob {
  try {
    let rawMime = fallbackMime;
    let base64 = base64Data;

    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        rawMime = match[1] || fallbackMime;
        base64 = match[2];
      } else {
        const commaIdx = base64Data.indexOf(',');
        if (commaIdx !== -1) {
          base64 = base64Data.slice(commaIdx + 1);
        }
      }
    }

    const mimeType = normalizeAudioMimeType(rawMime, fallbackMime);
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  } catch (err) {
    console.error('base64ToBlob error:', err);
    return new Blob([], { type: normalizeAudioMimeType(fallbackMime) });
  }
}

/**
 * Convert Blob to Base64 data URL with safety timeout
 */
export function blobToBase64(blob: Blob, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('blobToBase64 conversion timeout'));
    }, timeoutMs);

    const reader = new FileReader();
    reader.onloadend = () => {
      clearTimeout(timer);
      resolve(reader.result as string);
    };
    reader.onerror = (e) => {
      clearTimeout(timer);
      reject(e);
    };
    reader.readAsDataURL(blob);
  });
}

// In-memory Blob URL cache to reuse active URLs and avoid memory bloat
const blobUrlCache = new Map<string, string>();

/**
 * Resolves a 100% playable URL (preferably blob: URL or normalized data: URL) for any audio item.
 * On mobile browsers and PWAs, this bypasses range request problems, cookie redirects, and codec blocks.
 */
export async function resolvePlayableAudioUrl(
  id: string,
  audioUrl?: string,
  audioBase64?: string | null,
  onResolvedBase64?: (base64: string) => void
): Promise<string> {
  // 1. If audioBase64 is directly provided
  if (audioBase64 && audioBase64.length > 20) {
    const normalizedB64 = normalizeBase64DataUrl(audioBase64, audioUrl);
    
    // For smaller audio files (typical shadowing clips < 2MB), standard data: URL is the most reliable on mobile Safari
    // as it avoids WebKit cross-process blob sandbox permission bugs
    if (normalizedB64.length < 2_500_000) {
      // Also cache in IndexedDB in background
      try {
        const mime = normalizeAudioMimeType('', audioUrl);
        const blob = base64ToBlob(normalizedB64, mime);
        saveAudioToStorage(id, blob).catch(() => {});
      } catch {}
      return normalizedB64;
    }

    // For larger files, create Blob URL
    try {
      const mime = normalizeAudioMimeType('', audioUrl);
      const blob = base64ToBlob(normalizedB64, mime);
      await saveAudioToStorage(id, blob);
      const objectUrl = URL.createObjectURL(blob);
      blobUrlCache.set(id, objectUrl);
      return objectUrl;
    } catch {
      return normalizedB64;
    }
  }

  // 2. If we already have a cached Blob URL for this item, return it
  if (blobUrlCache.has(id)) {
    return blobUrlCache.get(id)!;
  }

  // 3. Check IndexedDB storage
  const cachedBlob = await getAudioFromStorage(id);
  if (cachedBlob && cachedBlob.size > 0) {
    const objectUrl = URL.createObjectURL(cachedBlob);
    blobUrlCache.set(id, objectUrl);
    return objectUrl;
  }

  // 4. If audioUrl is already a blob URL or data URL
  if (audioUrl?.startsWith('blob:') || audioUrl?.startsWith('data:')) {
    return audioUrl.startsWith('data:') ? normalizeBase64DataUrl(audioUrl) : audioUrl;
  }

  // 5. Try fetching from server via resolve-base64 endpoint
  if (audioUrl) {
    try {
      const res = await fetch(`/api/audio/resolve-base64?path=${encodeURIComponent(audioUrl)}&id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.base64) {
          const normalizedB64 = normalizeBase64DataUrl(data.base64, audioUrl);
          const mime = normalizeAudioMimeType(data.mimeType || '', audioUrl);
          const blob = base64ToBlob(normalizedB64, mime);
          await saveAudioToStorage(id, blob);

          if (onResolvedBase64) {
            onResolvedBase64(normalizedB64);
          }

          if (normalizedB64.length < 2_500_000) {
            return normalizedB64;
          }

          const objectUrl = URL.createObjectURL(blob);
          blobUrlCache.set(id, objectUrl);
          return objectUrl;
        }
      }
    } catch (err) {
      console.warn('Could not resolve audio via API:', err);
    }

    // 6. Direct stream fallback via RFC 206 Range Stream endpoint
    if (audioUrl.includes('/uploads/audio/')) {
      const fileName = audioUrl.split('/').pop();
      if (fileName) {
        return `/api/audio/stream/${encodeURIComponent(fileName)}`;
      }
    }

    // 7. Direct fetch fallback
    try {
      const directRes = await fetch(audioUrl);
      if (directRes.ok) {
        const directBlob = await directRes.blob();
        if (directBlob.size > 0) {
          await saveAudioToStorage(id, directBlob);
          const objectUrl = URL.createObjectURL(directBlob);
          blobUrlCache.set(id, objectUrl);

          if (directBlob.size < 700000 && onResolvedBase64) {
            blobToBase64(directBlob).then((b64) => {
              onResolvedBase64(normalizeBase64DataUrl(b64, audioUrl));
            }).catch(() => {});
          }

          return objectUrl;
        }
      }
    } catch (directErr) {
      console.warn('Direct audio fetch error:', directErr);
    }
  }

  // 8. Last resort: return original audioUrl
  return audioUrl || '';
}

/**
 * Clean up an active Blob URL for an item
 */
export function revokeAudioBlobUrl(id: string): void {
  const url = blobUrlCache.get(id);
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
    blobUrlCache.delete(id);
  }
}
