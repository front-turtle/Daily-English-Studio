export interface DailyComposition {
  id: string;
  date: string; // YYYY-MM-DD
  korean: string; // 한글 작문
  english: string; // 1차 영어 작문
  polished?: string; // 나중에 다듬은 표현 / 개선문
  polishedTip?: string; // 개선 팁
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AudioItem {
  id: string;
  title: string;
  fileName: string;
  audioUrl: string; // 원본 음성 파일 URL 또는 식별자
  audioBase64?: string; // 오프라인 & 크로스 디바이스 완벽 재생을 위한 음원 데이터
  myRecordingUrl?: string | null; // 내 녹음 음성 파일 URL
  myRecordingBase64?: string | null; // 내 녹음 오디오 데이터
  myRecordingDuration?: number | null; // 내 녹음 음성 길이 (초)
  date: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt?: number;
  transcript?: string; // 음성 파일 대본 / 스크립트
}

export interface KeyExpression {
  id: string;
  expression: string; // 영어 주요 표현/문장
  meaning: string; // 한글 의미
  memo?: string; // 상황/활용 메모
  favorite?: boolean;
  date: string; // YYYY-MM-DD
  createdAt: number;
  spokenCount?: number; // 내가 발화한 횟수
}

export type ActiveTab = 'writing' | 'audio-shadowing' | 'expressions' | 'ai' | 'summary';

export interface BackupData {
  version: number;
  exportedAt: string;
  userEmail?: string | null;
  compositions: DailyComposition[];
  audioItems: AudioItem[];
  expressions: KeyExpression[];
}
