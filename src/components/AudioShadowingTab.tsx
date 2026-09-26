import { prepareRecording } from '../utils/prepareRecording';
import { recordingBudget } from '../utils/recordingBudget';
import React, { useState, useRef, useEffect } from 'react';
import { AudioItem } from '../types';
import { AudioPlayerWithSpeed } from './AudioPlayerWithSpeed';
import { blobToBase64 } from '../utils/audioStorage';
import {
  Upload,
  Mic,
  MicOff,
  Volume2,
  Trash2,
  Check,
  RotateCcw,
  Headphones,
  FileAudio,
  Play,
  Square,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Edit3,
  Copy,
  Loader2,
} from 'lucide-react';
import { getTodayDateString } from '../data/initialData';

interface AudioShadowingTabProps {
  audioItems: AudioItem[];
  currentDate?: string;
  onDateChange?: (date: string) => void;
  onUploadAudio: (
    title: string,
    fileName: string,
    fileBase64: string,
    date: string,
    transcript?: string
  ) => Promise<void>;
  onSaveRecording: (id: string, recordingBase64: string, mimeType: string, duration?: number) => Promise<void>;
  onDeleteRecording: (id: string) => Promise<void>;
  onDeleteAudioItem: (id: string) => Promise<void>;
  onUpdateItemBase64?: (id: string, base64: string) => void;
  onUpdateTranscript?: (id: string, transcript: string) => Promise<void>;
}

// Real-time microphone volume visualizer that directly manipulates DOM bar heights
// Prevents parent re-rendering completely, eliminating screen jitter / flickering
interface MicWaveMeterProps {
  analyser: AnalyserNode | null;
}

const MicWaveMeter: React.FC<MicWaveMeterProps> = ({ analyser }) => {
  const bar0Ref = useRef<HTMLDivElement | null>(null);
  const bar1Ref = useRef<HTMLDivElement | null>(null);
  const bar2Ref = useRef<HTMLDivElement | null>(null);
  const bar3Ref = useRef<HTMLDivElement | null>(null);
  const bar4Ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!analyser) return;

    let animId: number;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const bars = [bar0Ref, bar1Ref, bar2Ref, bar3Ref, bar4Ref];
    const factors = [0.5, 1.1, 1.6, 1.2, 0.7];

    const updateBars = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const level = Math.min(100, Math.round((avg / 80) * 100));

      factors.forEach((factor, idx) => {
        const barEl = bars[idx]?.current;
        if (barEl) {
          const height = Math.max(4, Math.min(20, Math.round((level / 100) * 16 * factor + 4)));
          barEl.style.height = `${height}px`;
        }
      });

      animId = requestAnimationFrame(updateBars);
    };

    animId = requestAnimationFrame(updateBars);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [analyser]);

  return (
    <div className="flex items-center gap-1 h-6 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg shrink-0 select-none">
      <span className="text-[10px] text-rose-600 font-semibold mr-1">마이크 감지</span>
      <div ref={bar0Ref} className="w-1 bg-rose-500 rounded-full transition-[height] duration-75" style={{ height: '4px' }} />
      <div ref={bar1Ref} className="w-1 bg-rose-500 rounded-full transition-[height] duration-75" style={{ height: '4px' }} />
      <div ref={bar2Ref} className="w-1 bg-rose-500 rounded-full transition-[height] duration-75" style={{ height: '4px' }} />
      <div ref={bar3Ref} className="w-1 bg-rose-500 rounded-full transition-[height] duration-75" style={{ height: '4px' }} />
      <div ref={bar4Ref} className="w-1 bg-rose-500 rounded-full transition-[height] duration-75" style={{ height: '4px' }} />
    </div>
  );
};

export const AudioShadowingTab: React.FC<AudioShadowingTabProps> = ({
  audioItems,
  currentDate,
  onDateChange,
  onUploadAudio,
  onSaveRecording,
  onDeleteRecording,
  onDeleteAudioItem,
  onUpdateItemBase64,
  onUpdateTranscript,
}) => {
  const todayStr = getTodayDateString();
  const activeDate = currentDate || todayStr;

  // Filter items strictly by currently active/selected date (all items are in SummaryTab)
  const filteredAudioItems = audioItems.filter((item) => {
    const itemDate = item.date || (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : todayStr);
    return itemDate === activeDate;
  });

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadTranscript, setUploadTranscript] = useState('');
  const [uploadDate, setUploadDate] = useState(activeDate);

  useEffect(() => {
    if (currentDate) {
      setUploadDate(currentDate);
    }
  }, [currentDate]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline delete confirmation state (safe in iframes)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Transcript view & edit state per audio item
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState<string>('');
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active recording state for a specific audio item
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [isRecordingNow, setIsRecordingNow] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isSavingRecording, setIsSavingRecording] = useState(false);

  // MediaRecorder & AudioContext refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Dedicated accurate 1-second interval timer for recording
  useEffect(() => {
    if (!isRecordingNow) {
      setRecordSeconds(0);
      return;
    }

    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
      setRecordSeconds(elapsed);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isRecordingNow]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewAudioUrl) {
        URL.revokeObjectURL(previewAudioUrl);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [previewAudioUrl]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadTitle.trim()) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  // Submit Upload to Server
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('업로드할 음성 파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    try {
      const prepared = await prepareRecording(selectedFile, 400_000);
      const base64 = await blobToBase64(prepared);
      const fileName = prepared === selectedFile ? selectedFile.name : selectedFile.name.replace(/\.[^/.]+$/, '') + '.mp3';
      await onUploadAudio(uploadTitle.trim() || selectedFile.name, fileName, base64, uploadDate || todayStr, uploadTranscript.trim());
      setSelectedFile(null); setUploadTitle(''); setUploadTranscript(''); setUploadDate(todayStr);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast('음성 파일이 저장되었습니다!');
    } catch (err) {
      alert(err instanceof Error ? err.message : '업로드 중 문제가 발생했습니다.');
    } finally { setIsUploading(false); }
  };

  // Toggle transcript expand/collapse with arrow button
  const toggleTranscript = (id: string, currentTranscript?: string) => {
    setExpandedTranscripts((prev) => {
      const isCurrentlyOpen = !!prev[id];
      const willOpen = !isCurrentlyOpen;
      // If opening and there's no transcript yet, auto enter edit mode
      if (willOpen && !currentTranscript) {
        setEditingTranscriptId(id);
        setTranscriptDraft('');
      }
      return { ...prev, [id]: willOpen };
    });
  };

  // Start editing transcript
  const handleStartEditTranscript = (item: AudioItem) => {
    setEditingTranscriptId(item.id);
    setTranscriptDraft(item.transcript || '');
    setExpandedTranscripts((prev) => ({ ...prev, [item.id]: true }));
  };

  // Cancel editing transcript
  const handleCancelEditTranscript = () => {
    setEditingTranscriptId(null);
    setTranscriptDraft('');
  };

  // Save transcript
  const handleSaveTranscript = async (id: string) => {
    if (!onUpdateTranscript) return;
    setIsSavingTranscript(true);
    try {
      await onUpdateTranscript(id, transcriptDraft);
      setEditingTranscriptId(null);
      showToast('대본이 성공적으로 저장되었습니다!');
    } catch (err) {
      console.error('Transcript save error:', err);
      alert('대본 저장에 실패했습니다.');
    } finally {
      setIsSavingTranscript(false);
    }
  };

  // Copy transcript to clipboard
  const handleCopyTranscript = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('대본이 클립보드에 복사되었습니다.');
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
  };

  // Stop and cleanup mic stream & audio context
  const cleanupAudio = () => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  // Start Recording
  const startRecording = async (id: string) => {
    cleanupAudio();
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
    }
    setRecordedBlob(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('현재 브라우저 환경에서 마이크 녹음 기능을 지원하지 않습니다.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 1 }, echoCancellation: true, noiseSuppression: true } });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      }

      const options: MediaRecorderOptions = { audioBitsPerSecond: 32000, ...(mimeType ? { mimeType } : {}) };
      const recorder = new MediaRecorder(stream, options);
      const usedMimeType = recorder.mimeType || mimeType || 'audio/webm';

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: usedMimeType });
        setRecordedBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setPreviewAudioUrl(url);
        cleanupAudio();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);

      // Real-time microphone volume detection
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;
        }
      } catch (audioErr) {
        console.warn('AudioContext meter error:', audioErr);
      }

      setActiveRecordingId(id);
      setIsRecordingNow(true);
    } catch (err: any) {
      console.error(err);
      cleanupAudio();
      alert('마이크 접근 권한을 허용해주세요. 주소창이나 브라우저 설정에서 마이크를 허용할 수 있습니다.');
    }
  };

  // Stop Recording
  const stopRecording = () => {
    const elapsed = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    setRecordedDuration(elapsed);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingNow(false);
  };

  // Save new recording to server & local storage
  const handleConfirmSaveRecording = async (id: string) => {
    if (!recordedBlob || isSavingRecording) return;
    setIsSavingRecording(true);
    try {
      const duration = recordedDuration || recordSeconds || 0;

      // 1. Convert to Base64 safely via Promise
      const item = audioItems.find(a => a.id === id);
      if (!item) throw new Error('학습 음성을 찾지 못했습니다.');
      const prepared = await prepareRecording(recordedBlob, recordingBudget(item));
      const base64 = await blobToBase64(prepared);

      // 2. Save locally to IndexedDB in background without blocking
      // Parent commits storage before reporting success. Keep preview on failure.

      // 3. Save via parent handler (optimistic state + localStorage + server + firestore)
      await onSaveRecording(id, base64, prepared.type, duration);

      showToast('새 녹음본이 안전하게 저장되었습니다!');
      cancelRecording();
    } catch (err: any) {
      console.error('Recording save error:', err);
      showToast('녹음 저장 중 문제가 발생했습니다.');
      alert(err instanceof Error ? err.message : '녹음 저장에 실패했습니다. 다시 시도하거나 파일을 내려받아 보관해 주세요.');
    } finally {
      setIsSavingRecording(false);
    }
  };

  // Cancel / Reset active recorder
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupAudio();
    setIsRecordingNow(false);
    setActiveRecordingId(null);
    setRecordedBlob(null);
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
    }
    setPreviewAudioUrl(null);
    setRecordSeconds(0);
    setRecordedDuration(0);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-16 sm:top-20 right-4 z-50 bg-slate-900 text-white text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. 음성 파일 업로드 카드 */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
            <Upload className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              학습 음성 파일 업로드
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              PC나 모바일에서 음성(MP3, M4A, WAV 등)을 올리면 모든 기기에서 공유됩니다.
            </p>
          </div>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-bold text-slate-700">학습 날짜</label>
              <div className="flex items-center gap-1.5 bg-slate-50/50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={uploadDate}
                  onChange={(e) => setUploadDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer w-full"
                />
              </div>
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-bold text-slate-700">음성 제목</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="예: 쉐도잉 훈련 1과, 미드 대사"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-bold text-slate-700">오디오 파일 선택</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer pt-1.5"
              />
            </div>
          </div>

          {/* 대본(스크립트) 입력 필드 (선택) */}
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 flex items-start gap-1 shrink-0">
                <FileText className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                <span className="flex flex-col leading-tight">
                  <span className="whitespace-nowrap">대본 / 스크립트</span>
                  <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">(선택)</span>
                </span>
              </label>
              <span className="text-[10px] text-slate-400 text-right leading-tight break-keep pt-0.5">
                업로드 후에도 언제든지 작성하거나 수정할 수 있습니다
              </span>
            </div>
            <textarea
              rows={2}
              value={uploadTranscript}
              onChange={(e) => setUploadTranscript(e.target.value)}
              placeholder="음성 파일의 대본이나 영어 스크립트가 있다면 입력해주세요 (선택 사항)"
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none resize-none font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              {selectedFile ? `선택됨: ${selectedFile.name}` : 'MP3, M4A, WAV 파일 지원'}
            </span>

            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? '업로드 중...' : '파일 업로드하기'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. 업로드된 음성 및 내 녹음 목록 (지정된 날짜만 표시) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Headphones className="w-4 h-4 text-indigo-600" />
            <span>음성 파일 목록 & 내 녹음 ({filteredAudioItems.length}개)</span>
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-500" />
              {activeDate}
            </span>
          </h3>

          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span>모든 날짜의 음성은</span>
            <span className="font-semibold text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100">
              모아보기
            </span>
            <span>탭에서 확인 가능합니다.</span>
          </div>
        </div>

        {filteredAudioItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-200 text-center space-y-1.5 text-slate-500">
            <FileAudio className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-700">{activeDate}에 등록된 음성 파일이 없습니다.</p>
            <p className="text-[11px] text-slate-400">
              상단 업로드 창에서 {activeDate} 학습할 음성 파일을 업로드해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAudioItems.map((item) => {
              const isThisRecording = activeRecordingId === item.id;
              const itemDate = item.date || (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : todayStr);
              const isExpanded = !!expandedTranscripts[item.id];
              const isEditingThis = editingTranscriptId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4"
                >
                  {/* Item Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                            {item.title}
                          </h4>
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-indigo-500" />
                            {itemDate}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.fileName}
                        </span>
                      </div>
                    </div>

                    {deletingId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteAudioItem(item.id);
                            setDeletingId(null);
                          }}
                          className="text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-2 py-0.5 rounded transition-all cursor-pointer shadow-xs"
                        >
                          정말 삭제
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="text-[11px] text-slate-400 hover:text-slate-600 px-1 py-0.5"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(item.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                    {/* 1) 원본 음성 플레이어 & 대본 영역 */}
                  <div className="bg-slate-50 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <span>🎧 1. 원본 음성 (원어민/모델)</span>
                      </span>
                      <span className="text-[10px] text-slate-400">반복 청취하며 쉐도잉</span>
                    </div>

                    <AudioPlayerWithSpeed
                      src={item.audioUrl}
                      itemId={item.id}
                      audioBase64={item.audioBase64}
                      onResolvedBase64={(b64) => onUpdateItemBase64?.(item.id, b64)}
                    />

                    {/* 대본(스크립트) 화살표 토글 버튼 바 */}
                    <div className="pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="font-bold text-slate-800 whitespace-nowrap">음성 대본(스크립트)</span>
                          {item.transcript ? (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md shrink-0">
                              작성됨
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium shrink-0">
                              (대본 없음)
                            </span>
                          )}
                        </div>

                        {/* 화살표 토글 버튼: 누르면 아래로 대본이 펼쳐짐 */}
                        <button
                          type="button"
                          onClick={() => toggleTranscript(item.id, item.transcript)}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-600 hover:text-indigo-700 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                          title={isExpanded ? '대본 닫기' : '대본 열기'}
                        >
                          <span>
                            {isExpanded
                              ? '대본 접기'
                              : item.transcript
                              ? '대본 보기'
                              : '대본 쓰기'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                        </button>
                      </div>

                      {/* 화살표 버튼 누르면 아래로 펼쳐지는 대본 공간 */}
                      {isExpanded && (
                        <div className="mt-2.5 pt-2.5 border-t border-indigo-100/80 space-y-2.5">
                          {isEditingThis ? (
                            /* 대본 작성 / 수정 모드 */
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-indigo-950 flex items-center gap-1">
                                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>대본 작성 및 편집</span>
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Ctrl + Enter 로 즉시 저장
                                </span>
                              </div>

                              <textarea
                                rows={4}
                                value={transcriptDraft}
                                onChange={(e) => setTranscriptDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveTranscript(item.id);
                                  }
                                }}
                                placeholder="음성 파일에서 들리는 영어 문장이나 대본을 입력하세요.&#10;예:&#10;Hi, how have you been?&#10;I have been working on my new project."
                                className="w-full p-3 text-xs sm:text-sm rounded-xl border border-indigo-200 bg-white focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none leading-relaxed text-slate-800 placeholder-slate-400 resize-y font-mono"
                                autoFocus
                              />

                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] text-slate-400">
                                  저장하면 클라우드 및 모든 기기에 동기화됩니다.
                                </span>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleCancelEditTranscript}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors"
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSavingTranscript}
                                    onClick={() => handleSaveTranscript(item.id)}
                                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{isSavingTranscript ? '저장 중...' : '대본 저장하기'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : item.transcript ? (
                            /* 대본 읽기 모드 (작성된 대본이 있을 때) */
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-700 flex items-center gap-1">
                                  <span>📄 원본 대본 내용</span>
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyTranscript(item.id, item.transcript || '')}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
                                    title="대본 복사하기"
                                  >
                                    {copiedId === item.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        <span className="text-emerald-600 font-bold">복사됨!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 text-slate-400" />
                                        <span>복사</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditTranscript(item)}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
                                    title="대본 수정하기"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>수정</span>
                                  </button>
                                </div>
                              </div>

                              <div className="bg-white rounded-xl p-3.5 border border-indigo-100 text-xs sm:text-sm text-slate-800 font-mono leading-relaxed whitespace-pre-wrap select-text shadow-2xs">
                                {item.transcript}
                              </div>
                            </div>
                          ) : (
                            /* 대본이 비어있을 때 바로 작성 유도 */
                            <div className="bg-white rounded-xl p-4 border border-dashed border-indigo-200 text-center space-y-2">
                              <p className="text-xs font-semibold text-slate-600">
                                아직 등록된 음성 대본이 없습니다.
                              </p>
                              <p className="text-[11px] text-slate-400">
                                들리는 영어 대사나 대본을 작성해두면 원본 음성을 들으며 스크립트를 함께 확인할 수 있습니다.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleStartEditTranscript(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>대본 작성하기</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2) 내 음성 녹음 플레이어 & 재녹음 영역 */}
                  <div className="bg-indigo-50/20 rounded-xl p-3 border border-indigo-100/60 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-950 flex items-center gap-1">
                        <span>🎙️ 2. 내 음성 녹음 (비교 & 체크)</span>
                      </span>

                      {(item.myRecordingUrl || item.myRecordingBase64) ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          저장됨
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">아직 녹음 없음</span>
                      )}
                    </div>

                    {/* If existing recording is saved and not currently re-recording */}
                    {(item.myRecordingUrl || item.myRecordingBase64) && !isThisRecording && (
                      <div className="space-y-2">
                        <div className="text-[11px] text-slate-500 font-semibold">내 녹음 듣기:</div>
                        <AudioPlayerWithSpeed
                          src={item.myRecordingUrl || ''}
                          itemId={`rec-${item.id}`}
                          audioBase64={item.myRecordingBase64}
                          fallbackDuration={item.myRecordingDuration || undefined}
                          hideLoop
                        />

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => startRecording(item.id)}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>다시 녹음하기 (재도전)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('내 녹음본을 삭제하시겠습니까?')) {
                                onDeleteRecording(item.id);
                              }
                            }}
                            className="text-[11px] text-slate-400 hover:text-rose-500"
                          >
                            녹음본 삭제
                          </button>
                        </div>
                      </div>
                    )}

                    {/* If no recording exists and not actively recording */}
                    {!item.myRecordingUrl && !item.myRecordingBase64 && !isThisRecording && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                          원본을 듣고 내 목소리로 소리 내어 녹음해보세요.
                        </p>
                        <button
                          type="button"
                          onClick={() => startRecording(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>내 목소리 녹음하기</span>
                        </button>
                      </div>
                    )}

                    {/* Active In-App Recorder Panel */}
                    {isThisRecording && (
                      <div className="bg-white rounded-xl p-3.5 border border-indigo-300 space-y-3 shadow-xs">
                        {/* Status bar */}
                        <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                          {isRecordingNow ? (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 text-rose-600 font-bold">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
                                </span>
                                <span className="text-sm font-semibold tracking-wide">
                                  녹음 진행 중...
                                </span>
                              </div>

                              {/* Real-time Voice Wave Meter (Zero-rerender DOM-level updates) */}
                              <MicWaveMeter analyser={analyserRef.current} />
                            </div>
                          ) : (
                            <div className="text-xs font-bold text-indigo-700">
                              🎧 녹음 완료 ({formatSeconds(recordedDuration || recordSeconds)})! 아래에서 미리 들어보세요.
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={isSavingRecording}
                            onClick={cancelRecording}
                            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            취소
                          </button>
                        </div>

                        {/* If actively recording */}
                        {isRecordingNow && (
                          <div className="flex flex-col items-center justify-center py-2 space-y-2">
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                            >
                              <Square className="w-4 h-4 fill-white" />
                              <span>녹음 완료하기 ({formatSeconds(recordSeconds)})</span>
                            </button>
                            <p className="text-[11px] text-slate-400 text-center">
                              음성에 맞는 작은 용량으로 녹음합니다. 완료 후 크기를 확인하고 필요하면 자동 압축해요.
                            </p>
                          </div>
                        )}

                        {/* If recorded and preview is ready */}
                        {previewAudioUrl && !isRecordingNow && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1.5">
                              <div className="text-[11px] text-slate-500 font-semibold">
                                방금 녹음한 음성 미리듣기:
                              </div>
                              <AudioPlayerWithSpeed
                                src={previewAudioUrl}
                                fallbackDuration={recordedDuration || recordSeconds}
                                hideLoop
                              />
                            </div>

                            {isSavingRecording ? (
                              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs font-semibold">
                                <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                                <span>녹음 파일을 안전하게 저장하고 있습니다. 화면을 끄거나 이동하지 마시고 잠시만 기다려주세요...</span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-indigo-900 bg-indigo-50 p-2 rounded-lg">
                                💡 <strong>이 녹음이 마음에 드시나요?</strong> 아래 '이 녹음으로 저장'을 누르면 저장됩니다. 마음에 들지 않으면 '다시 녹음'을 눌러 얼마든지 재도전하세요.
                              </p>
                            )}

                            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                              <a href={previewAudioUrl} download={`recording-${item.id}.${recordedBlob?.type.includes('mp4') ? 'm4a' : recordedBlob?.type.includes('aac') ? 'aac' : 'webm'}`} className="text-xs text-indigo-700 underline px-2 py-2">녹음 파일 내려받기</a>
                              <button
                                type="button"
                                disabled={isSavingRecording}
                                onClick={() => startRecording(item.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>다시 녹음</span>
                              </button>

                              <button
                                type="button"
                                disabled={isSavingRecording}
                                onClick={() => handleConfirmSaveRecording(item.id)}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                              >
                                {isSavingRecording ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>{isSavingRecording ? '저장 진행 중...' : '이 녹음으로 저장하기'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
