import { hydrateAudioItems } from '../utils/audioCache';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  RefreshCw,
  Download,
  Upload,
  Copy,
  LogOut,
  Smartphone,
  Laptop,
  Check,
  AlertCircle,
  FileJson,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DailyComposition, AudioItem, KeyExpression, BackupData } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  compositions: DailyComposition[];
  audioItems: AudioItem[];
  expressions: KeyExpression[];
  onImportBackup: (backup: BackupData, mode: 'merge' | 'overwrite') => Promise<void>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  compositions,
  audioItems,
  expressions,
  onImportBackup,
}) => {
  const {
    user,
    syncStatus,
    lastSavedTime,
    signInWithGoogle,
    signOut,
    markSaving,
    markSynced,
  } = useAuth();

  const { isInstallable, isInstalled, isIOS, installApp } = usePWAInstall();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatSavedTime = (date: Date | null) => {
    if (!date) return '방금 전';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 10) return '방금 전';
    if (diffSec < 60) return `${diffSec}초 전`;
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleManualSync = () => {
    setIsSyncingNow(true);
    markSaving();
    setTimeout(() => {
      markSynced();
      setIsSyncingNow(false);
      showToast('모든 최신 학습 데이터가 안전하게 저장되었습니다.');
    }, 500);
  };

  // Export to JSON File
  const handleExportFile = async () => {
    try {
    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userEmail: user?.email || null,
      compositions,
      audioItems: await hydrateAudioItems(audioItems, true),
      expressions,
    };

    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `daily_english_backup_${datePart}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('전체 데이터 백업 파일(.json)이 다운로드되었습니다.');
    } catch (err) { showToast(err instanceof Error ? err.message : '백업에 실패했습니다.'); }
  };

  // Copy JSON to Clipboard
  const handleCopyJson = async () => {
    try {
    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userEmail: user?.email || null,
      compositions,
      audioItems: await hydrateAudioItems(audioItems, true),
      expressions,
    };

    const jsonStr = JSON.stringify(backup, null, 2);
    try {
      await navigator.clipboard.writeText(jsonStr);
      showToast('전체 백업 데이터(JSON)가 클립보드에 복사되었습니다.');
    } catch {
      showToast('클립보드 복사에 실패했습니다.');
    }
    } catch (err) { showToast(err instanceof Error ? err.message : '백업에 실패했습니다.'); }
  };

  // Handle File Selection for Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validate that it has at least some valid properties
        if (
          !Array.isArray(parsed.compositions) &&
          !Array.isArray(parsed.audioItems) &&
          !Array.isArray(parsed.expressions)
        ) {
          alert('올바른 Daily English 백업 파일 형식이 아닙니다.');
          return;
        }

        setPendingBackup({
          version: parsed.version || 1,
          exportedAt: parsed.exportedAt || new Date().toISOString(),
          userEmail: parsed.userEmail || null,
          compositions: Array.isArray(parsed.compositions) ? parsed.compositions : [],
          audioItems: Array.isArray(parsed.audioItems) ? parsed.audioItems : [],
          expressions: Array.isArray(parsed.expressions) ? parsed.expressions : [],
        });
      } catch (err) {
        console.error(err);
        alert('JSON 파일 해석 중 오류가 발생했습니다. 올바른 파일인지 확인해주세요.');
      }
    };
    reader.readAsText(file);
  };

  // Execute Import
  const executeImport = async (mode: 'merge' | 'overwrite') => {
    if (!pendingBackup) return;
    setIsImporting(true);
    try {
      await onImportBackup(pendingBackup, mode);
      const totalCount =
        pendingBackup.compositions.length +
        pendingBackup.audioItems.length +
        pendingBackup.expressions.length;
      showToast(`성공적으로 복원되었습니다 (총 ${totalCount}개 항목).`);
      setPendingBackup(null);
      setImportFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      alert('데이터 가져오기 중 오류가 발생했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 flex items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full my-auto max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3.5rem)] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="shrink-0 px-5 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              EN
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                내 계정 및 전체 데이터 관리
              </h2>
              <p className="text-[11px] text-slate-500">
                실시간 동기화 상태, 백업 내보내기/가져오기, 기기별 앱 설치
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 divide-y divide-slate-100 text-slate-800">
          {/* Toast inside modal */}
          {toastMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* 1. 계정 및 연동 상태 */}
          <div className="space-y-3 pt-0">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              1. 계정 정보
            </h3>
            {user ? (
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shrink-0">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {user.displayName || '학습자'}
                      </p>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold shrink-0">
                        연동됨
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    await signOut();
                    showToast('로그아웃되었습니다.');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>로그아웃</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">
                      Google 계정으로 로그인하기
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      로그인하면 모든 기기(스마트폰, 태블릿, PC)에서 데이터가 실시간 클라우드 자동 저장됩니다.
                    </p>
                  </div>

                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs transition-all cursor-pointer shrink-0"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google로 계속하기</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. 저장 & 실시간 동기화 상태 (사용자 요청: 초록색 저장 표기) */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                2. 실시간 저장 & 동기화 상태
              </h3>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncingNow}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingNow ? 'animate-spin' : ''}`} />
                <span>{isSyncingNow ? '동기화 확인 중...' : '지금 저장 확인'}</span>
              </button>
            </div>

            {syncStatus === 'syncing' || isSyncingNow ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-amber-900">
                      학습 데이터 동기화 중...
                    </p>
                    <p className="text-[11px] text-amber-700">
                      변경사항을 데이터베이스에 안전하게 기록하고 있습니다.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-800">
                  동기화 중
                </span>
              </div>
            ) : (
              /* 저장 완료 상태 - 초록색 표기 강조 */
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-emerald-950">
                        저장 완료 (동기화 완료)
                      </p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                        정상 보관됨
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      최근 저장 확인: {formatSavedTime(lastSavedTime)} ({user ? 'Google Cloud' : '로컬 브라우저'})
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. 전체 데이터 Export & Import (사용자 핵심 요청) */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                3. 전체 정보 백업 (Export & Import)
              </h3>
              <div className="text-[10px] text-slate-500">
                총 {compositions.length}개 영작 • {audioItems.length}개 쉐도잉 • {expressions.length}개 표현
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Export Card */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>전체 정보 내보내기 (Export)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  내가 작성한 모든 영작문, 녹음/음성 목록, 주요 표현 데이터를 백업 파일로 저장합니다.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportFile}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>백업 파일 받기 (.json)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    title="클립보드로 JSON 복사"
                    className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs transition-colors cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Import Card */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>전체 정보 가져오기 (Import)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  이전에 저장해 둔 백업 파일(.json)을 불러와 데이터를 즉시 복원합니다.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="backup-file-input"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5 text-indigo-600" />
                  <span>백업 파일 선택하기</span>
                </button>
              </div>
            </div>

            {/* Import Confirmation Preview when file is loaded */}
            {pendingBackup && (
              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>불러온 파일: {importFileName}</span>
                  </div>
                  <button
                    onClick={() => {
                      setPendingBackup(null);
                      setImportFileName('');
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-800"
                  >
                    취소
                  </button>
                </div>

                <div className="text-xs text-indigo-900 space-y-1 bg-white/70 p-2.5 rounded-xl border border-indigo-100">
                  <p>• 영작문: <strong>{pendingBackup.compositions.length}개</strong></p>
                  <p>• 쉐도잉 오디오: <strong>{pendingBackup.audioItems.length}개</strong></p>
                  <p>• 주요 표현: <strong>{pendingBackup.expressions.length}개</strong></p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    백업 생성일: {new Date(pendingBackup.exportedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => executeImport('merge')}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    {isImporting ? '가져오는 중...' : '기존 데이터에 추가 (Merge - 권장)'}
                  </button>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => {
                      if (confirm('기존 데이터가 백업 내용으로 완전히 대체됩니다. 계속하시겠습니까?')) {
                        executeImport('overwrite');
                      }
                    }}
                    className="py-2 px-3 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold transition-all cursor-pointer"
                  >
                    새로 덮어쓰기
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. 데스크탑, 모바일, 태블릿 설치 (PWA) */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              4. 기기별 앱 설치 (데스크탑 • 모바일 • 태블릿)
            </h3>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <Laptop className="w-4 h-4 text-indigo-600" />
                  <span>설치형 앱 (PWA) 지원</span>
                </div>
                {isInstalled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    앱으로 실행 중
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                별도의 앱스토어 다운로드 없이 바탕화면 또는 홈 화면에 바로가기 앱을 설치하여 전체화면으로 편리하게 학습할 수 있습니다.
              </p>

              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await installApp();
                    if (ok) showToast('앱이 성공적으로 설치되었습니다!');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>지금 이 기기에 앱 설치하기</span>
                </button>
              )}

              {/* Platform Guidelines */}
              <div className="text-[11px] text-slate-500 space-y-1.5 bg-white p-3 rounded-xl border border-slate-200/70">
                <div className="font-semibold text-slate-700">기기별 간편 설치 방법:</div>
                <p>• <strong>삼성 인터넷 (Galaxy)</strong>: 상단 주소창 우측의 <strong>다운로드(↓) 버튼</strong> 또는 메뉴(≡) &gt; [현재 페이지 추가] &gt; <strong>[홈 화면]</strong></p>
                <p>• <strong>안드로이드 크롬 (Chrome)</strong>: 우측 상단 메뉴(⋮) &gt; <strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong></p>
                <p>• <strong>아이폰/아이패드 (Safari)</strong>: 하단 공유 버튼(⎋) &gt; <strong>[홈 화면에 추가]</strong></p>
                <p>• <strong>PC/데스크탑 (Chrome/Edge)</strong>: 브라우저 주소창 우측의 [설치 ⊕] 아이콘</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
