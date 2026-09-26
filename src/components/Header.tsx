import React, { useState } from 'react';
import { User, Download, Bot } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DailyComposition, AudioItem, KeyExpression, BackupData } from '../types';
import { AccountModal } from './AccountModal';
import { InstallGuideModal } from './InstallGuideModal';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HeaderProps {
  onLogoClick?: () => void;
  onAiTutorClick?: () => void;
  isAiTutorActive?: boolean;
  compositions: DailyComposition[];
  audioItems: AudioItem[];
  expressions: KeyExpression[];
  onImportBackup: (backup: BackupData, mode: 'merge' | 'overwrite') => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  onLogoClick,
  onAiTutorClick,
  isAiTutorActive = false,
  compositions,
  audioItems,
  expressions,
  onImportBackup,
}) => {
  const {
    user,
    loading,
    syncStatus,
    lastSavedTime,
    error,
    clearError,
  } = useAuth();

  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await installApp();
      if (success) return;
    }
    setIsInstallModalOpen(true);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Left: Logo & Title (Clicking returns to top/writing) */}
        <div
          onClick={onLogoClick}
          className="flex min-w-0 items-center gap-2 cursor-pointer select-none"
          title="Daily English Studio"
        >
          <div className="w-8 h-8 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            EN
          </div>
          <div>
            <span className="font-bold text-sm sm:text-lg text-slate-900 tracking-tight whitespace-nowrap">
              Daily English
            </span>
          </div>
        </div>

        {/* Right: AI Tutor + PWA Install + Real-time Sync Status + Account */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={onAiTutorClick}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95 ${
              isAiTutorActive
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
            }`}
            title="AI 영어 튜터 열기"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI 튜터</span>
          </button>
          {/* PWA Install Button (Visible on mobile & desktop until installed) */}
          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
              title="스마트폰, 태블릿, PC에 앱으로 설치하기"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">앱 설치</span>
            </button>
          )}

          {/* Real-time Save Status Indicator (일자 형태 - 초록색: 저장 완료, 노란색: 저장 진행 중) */}
          <button
            type="button"
            id="header-save-status-indicator"
            onClick={() => setIsAccountModalOpen(true)}
            className="flex items-center justify-center p-1.5 rounded-md hover:bg-slate-100 transition-all cursor-pointer select-none active:scale-90 shrink-0"
            title={
              syncStatus === 'syncing'
                ? '저장 진행 중 (노란색) - 클릭 시 계정 및 데이터 설정'
                : '저장 완료 (초록색) - 클릭 시 계정 및 데이터 설정'
            }
            aria-label={syncStatus === 'syncing' ? '저장 진행 중' : '저장 완료'}
          >
            <span
              className={`w-1 sm:w-1.5 h-3.5 sm:h-4 rounded-full transition-all ${
                syncStatus === 'syncing'
                  ? 'bg-amber-400 shadow-xs shadow-amber-300/80 animate-pulse'
                  : 'bg-emerald-500 shadow-xs shadow-emerald-400/80'
              }`}
            />
          </button>

          {/* Account / Profile Button (Opens Account & Data Modal) */}
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
          ) : user ? (
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="relative rounded-full hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer"
              title="계정 정보 및 전체 백업 열기"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google Profile'}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              {/* Connected & Save Status Dot */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors ${
                  syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                }`}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-indigo-300 shadow-2xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              title="계정 관리 및 데이터 백업 열기"
            >
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>계정</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-1.5 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="font-bold underline ml-2 cursor-pointer">
            닫기
          </button>
        </div>
      )}

      {/* Account & Backup & Install Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        compositions={compositions}
        audioItems={audioItems}
        expressions={expressions}
        onImportBackup={onImportBackup}
      />

      {/* Mobile & Desktop Install Guide Modal */}
      <InstallGuideModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </header>
  );
};

