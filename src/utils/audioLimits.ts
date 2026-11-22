// Audio uploads keep their original bytes. No automatic transcoding or compression.
export const MAX_AUDIO_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MiB

export function base64AudioByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}

export const AUDIO_UPLOAD_TOO_LARGE_MESSAGE =
  '업로드 불가: 파일 용량이 5MB를 초과했습니다. 5MB 이하의 음성 파일을 선택해주세요.';
