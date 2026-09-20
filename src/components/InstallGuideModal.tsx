import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Smartphone,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isSamsungBrowser,
    isAndroid,
    installApp,
  } = usePWAInstall();

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

  const handleOneClickInstall = async () => {
    const success = await installApp();
    if (success) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 flex items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full my-auto max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-4rem)] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="shrink-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              EN
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                <span>휴대폰에 앱으로 설치하기</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                홈 화면에서 실제 어플처럼 바로 실행
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800">
          {/* Quick 1-Click Install Button (if browser event available) */}
          {isInstallable && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>원클릭 빠른 설치 지원 기기</span>
              </div>
              <p className="text-xs text-indigo-800 leading-relaxed">
                아래 버튼을 누르면 스마트폰 홈 화면에 아이콘이 바로 생성됩니다.
              </p>
              <button
                type="button"
                onClick={handleOneClickInstall}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>지금 바로 홈 화면에 앱 설치하기</span>
              </button>
            </div>
          )}

          {/* Browser Specific Guides */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              스마트폰 브라우저별 간편 설치 방법
            </div>

            {/* 1. Samsung Internet Guide (Highlighted if detected) */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                isSamsungBrowser
                  ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-100'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                    S
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    삼성 인터넷 브라우저 (Galaxy)
                  </span>
                </div>
                {isSamsungBrowser && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    현재 브라우저
                  </span>
                )}
              </div>
              <ul className="text-xs text-slate-700 space-y-2 leading-relaxed pl-1">
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-indigo-600 shrink-0">방법 1:</span>
                  <span>
                    스마트폰 화면 <strong>상단 주소창 우측</strong>에 보이는 동그란 <strong>다운로드 아이콘 (↓)</strong>을 누르시면 즉시 어플로 설치됩니다.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-indigo-600 shrink-0">방법 2:</span>
                  <span>
                    우측 하단 메뉴 <strong>`≡` (선 세 개)</strong> 터치 → <strong>[현재 페이지 추가]</strong> → <strong>[홈 화면]</strong> 선택
                  </span>
                </li>
              </ul>
            </div>

            {/* 2. Chrome Guide (Android) */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                isAndroid && !isSamsungBrowser
                  ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-100'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                    C
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    크롬 브라우저 (Chrome)
                  </span>
                </div>
                {isAndroid && !isSamsungBrowser && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-900">
                    현재 브라우저
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 leading-relaxed pl-1">
                우측 상단 메뉴 <strong>`⋮` (점 세 개)</strong> 터치 → <strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong>를 누르시면 바탕화면에 바로 생성됩니다.
              </p>
            </div>

            {/* 3. iOS Safari Guide */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                isIOS
                  ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-100'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center">
                    
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    아이폰 / 아이패드 (Safari)
                  </span>
                </div>
                {isIOS && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                    현재 브라우저
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 leading-relaxed pl-1">
                사파리 화면 하단 중앙의 <strong>공유 버튼 `(⎋ / [↑])`</strong> 터치 → 아래로 스크롤하여 <strong>[홈 화면에 추가]</strong>를 누르시면 됩니다.
              </p>
            </div>
          </div>

          {/* Benefits Info */}
          <div className="p-3 bg-slate-100/70 rounded-xl text-[11px] text-slate-600 leading-relaxed space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>어플 설치 시 장점</span>
            </div>
            <p>• 주소창 없이 전체화면으로 시원하게 학습할 수 있습니다.</p>
            <p>• 홈 화면에서 카카오톡처럼 아이콘 터치 한 번으로 바로 실행됩니다.</p>
            <p>• 작성한 영작과 음성 데이터가 기기에 빠르게 저장 및 연동됩니다.</p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex justify-end">
          <button
            type="button"
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
