import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Repeat, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { resolvePlayableAudioUrl, revokeAudioBlobUrl, normalizeBase64DataUrl } from '../utils/audioStorage';

interface AudioPlayerWithSpeedProps {
  src: string;
  itemId?: string;
  audioBase64?: string | null;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  onResolvedBase64?: (base64: string) => void;
  fallbackDuration?: number;
  hideLoop?: boolean;
}

export const AudioPlayerWithSpeed: React.FC<AudioPlayerWithSpeedProps> = ({
  src,
  itemId,
  audioBase64,
  title,
  className = '',
  autoPlay = false,
  onResolvedBase64,
  fallbackDuration,
  hideLoop = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Synchronous initial source setup: if audioBase64 exists, prepare normalized data URL immediately
  // This allows instant mobile playback without waiting for async IndexedDB resolution
  const [playableSrc, setPlayableSrc] = useState<string>(() => {
    if (audioBase64 && audioBase64.length > 20) {
      return normalizeBase64DataUrl(audioBase64, src);
    }
    return src || '';
  });
  const [isLoadingSource, setIsLoadingSource] = useState<boolean>(!playableSrc);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fallbackAttemptedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const isSeekingRef = useRef(false);
  const [duration, setDuration] = useState<number>(() => {
    if (fallbackDuration && fallbackDuration > 0 && isFinite(fallbackDuration)) {
      return fallbackDuration;
    }
    return 0;
  });

  useEffect(() => {
    if (fallbackDuration && fallbackDuration > 0 && isFinite(fallbackDuration)) {
      setDuration((prev) => (prev <= 0 || !isFinite(prev) ? fallbackDuration : prev));
    }
  }, [fallbackDuration]);

  // Helper to handle duration detection even when browser returns Infinity (common with MediaRecorder blobs)
  const updateDurationIfValid = (d: number) => {
    if (isFinite(d) && !isNaN(d) && d > 0) {
      setDuration(d);
    } else if (d === Infinity && audioRef.current) {
      if (fallbackDuration && fallbackDuration > 0) {
        setDuration(fallbackDuration);
        return;
      }
      try {
        if (audioRef.current.seekable && audioRef.current.seekable.length > 0) {
          const seekableEnd = audioRef.current.seekable.end(audioRef.current.seekable.length - 1);
          if (isFinite(seekableEnd) && seekableEnd > 0) {
            setDuration(seekableEnd);
            return;
          }
        }
      } catch {}
      // Standard Chrome WebM duration trick
      const audio = audioRef.current;
      if (audio && audio.duration === Infinity) {
        const onTempSeeked = () => {
          audio.removeEventListener('seeked', onTempSeeked);
          if (isFinite(audio.currentTime) && audio.currentTime > 0) {
            setDuration(audio.currentTime);
          }
          audio.currentTime = 0;
        };
        audio.addEventListener('seeked', onTempSeeked, { once: true });
        audio.currentTime = 1e101;
      }
    }
  };
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // A-B Repeat state: 'off' | 'setting_b' | 'looping'
  const [loopState, setLoopState] = useState<'off' | 'setting_b' | 'looping'>('off');
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);

  // Keep onResolvedBase64 in ref to prevent resolveSource regeneration on every parent render
  const onResolvedBase64Ref = useRef(onResolvedBase64);
  useEffect(() => {
    onResolvedBase64Ref.current = onResolvedBase64;
  }, [onResolvedBase64]);

  // Resolve audio source (Blob URL / normalized Data URL / Stream URL)
  const resolveSource = useCallback(async () => {
    if (!src && !audioBase64) {
      setPlayableSrc('');
      setIsLoadingSource(false);
      return;
    }

    // If we already have audioBase64, ensure normalized base64 is set immediately
    if (audioBase64 && audioBase64.length > 20) {
      const normalized = normalizeBase64DataUrl(audioBase64, src);
      setPlayableSrc(normalized);
      setIsLoadingSource(false);
    }

    try {
      const resolved = await resolvePlayableAudioUrl(
        itemId || src,
        src,
        audioBase64,
        (b64) => onResolvedBase64Ref.current?.(b64)
      );

      if (resolved && resolved !== playableSrc) {
        setPlayableSrc(resolved);
      }
    } catch (err: any) {
      console.warn('Audio source resolve warning:', err);
      if (!playableSrc) {
        setPlayableSrc(src);
      }
    } finally {
      setIsLoadingSource(false);
    }
  }, [src, itemId, audioBase64]);

  useEffect(() => {
    fallbackAttemptedRef.current = false;
    resolveSource();
  }, [resolveSource]);

  // Sync playback rate to audio element whenever it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Reset states on src change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setSeekTime(0);
    setIsSeeking(false);
    isSeekingRef.current = false;
    setDuration(fallbackDuration && fallbackDuration > 0 && isFinite(fallbackDuration) ? fallbackDuration : 0);
    setLoopState('off');
    setLoopStart(null);
    setLoopEnd(null);
    setLoadError(null);

    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      if (autoPlay && playableSrc) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [playableSrc, autoPlay]);

  // Trigger audio element recovery if an error occurs
  const handlePlaybackFailure = async (audio: HTMLAudioElement) => {
    if (fallbackAttemptedRef.current) {
      setIsPlaying(false);
      setLoadError('음원 재생 실패. 네트워크 상태를 확인해주세요.');
      return;
    }

    fallbackAttemptedRef.current = true;
    console.warn('Attempting playback fallback for:', playableSrc);

    // Option A: If we have audioBase64, switch directly to normalized data URL
    if (audioBase64 && audioBase64.length > 20) {
      const directDataUrl = normalizeBase64DataUrl(audioBase64, src);
      setPlayableSrc(directDataUrl);
      audio.src = directDataUrl;
      audio.load();
      try {
        await audio.play();
        setIsPlaying(true);
        setLoadError(null);
        return;
      } catch (e) {
        console.warn('Data URL fallback failed:', e);
      }
    }

    // Option B: If it was an uploads URL, switch to RFC 206 streaming endpoint
    if (src && src.includes('/uploads/audio/')) {
      const fileName = src.split('/').pop();
      if (fileName) {
        const streamUrl = `/api/audio/stream/${encodeURIComponent(fileName)}`;
        setPlayableSrc(streamUrl);
        audio.src = streamUrl;
        audio.load();
        try {
          await audio.play();
          setIsPlaying(true);
          setLoadError(null);
          return;
        } catch (e) {
          console.warn('Stream fallback failed:', e);
        }
      }
    }

    // Option C: Fetch fresh base64 from server
    try {
      const fresh = await resolvePlayableAudioUrl(
        itemId || src,
        src,
        audioBase64,
        (b64) => onResolvedBase64Ref.current?.(b64)
      );
      if (fresh && fresh !== playableSrc) {
        setPlayableSrc(fresh);
        audio.src = fresh;
        audio.load();
        await audio.play();
        setIsPlaying(true);
        setLoadError(null);
        return;
      }
    } catch (retryErr) {
      console.warn('All audio fallback attempts exhausted:', retryErr);
    }

    setIsPlaying(false);
    setLoadError('재생을 시작할 수 없습니다. 다시 터치해주세요.');
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      setLoadError(null);

      // If looping and outside the range, reset to loopStart before playing
      if (loopState === 'looping' && loopStart !== null && loopEnd !== null) {
        if (audio.currentTime >= loopEnd || audio.currentTime < loopStart) {
          audio.currentTime = loopStart;
        }
      }

      audio.playbackRate = playbackRate;

      // Ensure src is set on element immediately within the user gesture handler
      if (!audio.src && playableSrc) {
        audio.src = playableSrc;
      }

      try {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      } catch (err: any) {
        console.warn('Audio play() rejected, attempting fallback:', err);
        await handlePlaybackFailure(audio);
      }
    }
  };

  const handleSpeedChange = (speed: number) => {
    const targetSpeed = playbackRate === speed ? 1.0 : speed;
    setPlaybackRate(targetSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = targetSpeed;
    }
  };

  // A-B Loop Toggle Handler (1st click: set A, 2nd click: set B & start loop, 3rd click: end loop)
  const handleLoopToggle = () => {
    const audio = audioRef.current;
    const current = audio ? audio.currentTime : currentTime;

    if (loopState === 'off') {
      // 1st click: Record point A
      setLoopStart(current);
      setLoopEnd(null);
      setLoopState('setting_b');
    } else if (loopState === 'setting_b') {
      // 2nd click: Record point B and start looping
      let start = loopStart !== null ? loopStart : 0;
      let end = current;

      if (end <= start) {
        if (start > end && end > 0) {
          const temp = start;
          start = end;
          end = temp;
        } else {
          end = Math.min(duration || start + 3, start + 2);
        }
      }

      setLoopStart(start);
      setLoopEnd(end);
      setLoopState('looping');

      // Immediately seek to point A and continue playing
      if (audio) {
        audio.currentTime = start;
        audio.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      // 3rd click: Turn off repeat
      setLoopState('off');
      setLoopStart(null);
      setLoopEnd(null);
    }
  };

  const handleSeekStart = () => {
    isSeekingRef.current = true;
    setIsSeeking(true);
    setSeekTime(currentTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setSeekTime(time);
    if (!isSeekingRef.current) {
      setCurrentTime(time);
      if (audioRef.current && isFinite(time)) {
        audioRef.current.currentTime = time;
      }
    }
  };

  const handleSeekEnd = () => {
    if (!isSeekingRef.current) return;
    isSeekingRef.current = false;
    setIsSeeking(false);
    const target = seekTime;
    setCurrentTime(target);
    if (audioRef.current && isFinite(target)) {
      audioRef.current.currentTime = target;
    }
  };

  const handleReplayFromStart = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (loopState === 'looping' && loopStart !== null) {
      audio.currentTime = loopStart;
    } else {
      audio.currentTime = 0;
    }
    setCurrentTime(audio.currentTime);
    audio.play().catch(() => {});
    setIsPlaying(true);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds) || timeInSeconds < 0) return '0:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayCurrentTime = isSeeking ? seekTime : currentTime;

  const effectiveDuration =
    duration > 0 && isFinite(duration)
      ? duration
      : fallbackDuration && fallbackDuration > 0 && isFinite(fallbackDuration)
      ? fallbackDuration
      : displayCurrentTime > 0
      ? Math.max(displayCurrentTime, 1)
      : 0;

  const progressPercent =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (displayCurrentTime / effectiveDuration) * 100)) : 0;

  return (
    <div
      className={`bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs space-y-2.5 transition-all overflow-hidden ${className}`}
    >
      {/* Native audio element optimized for mobile PWA and range/blob playback */}
      {playableSrc && (
        <audio
          ref={audioRef}
          src={playableSrc}
          preload="auto"
          playsInline
          onPlay={() => {
            setIsPlaying(true);
            setLoadError(null);
          }}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            console.warn('Native audio error event fired for:', playableSrc);
            if (audioRef.current && !fallbackAttemptedRef.current) {
              handlePlaybackFailure(audioRef.current);
            } else {
              setLoadError('음원 로딩 중 오류가 발생했습니다.');
              setIsPlaying(false);
            }
          }}
          onCanPlay={() => {
            if (audioRef.current) {
              updateDurationIfValid(audioRef.current.duration);
            }
          }}
          onEnded={() => {
            if (loopState === 'looping' && loopStart !== null) {
              if (audioRef.current) {
                audioRef.current.currentTime = loopStart;
                audioRef.current.play().catch(() => {});
                setIsPlaying(true);
              }
            } else if (loopState === 'setting_b' && loopStart !== null) {
              const end = effectiveDuration || currentTime;
              setLoopEnd(end);
              setLoopState('looping');
              if (audioRef.current) {
                audioRef.current.currentTime = loopStart;
                audioRef.current.play().catch(() => {});
                setIsPlaying(true);
              }
            } else {
              setIsPlaying(false);
              setCurrentTime(0);
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              const time = audioRef.current.currentTime;
              if (!isSeekingRef.current) {
                setCurrentTime(time);
              }

              // Update duration if it became available during playback or expand to max observed
              setDuration((prev) => {
                if (prev <= 0 || !isFinite(prev)) {
                  if (fallbackDuration && fallbackDuration > 0 && isFinite(fallbackDuration)) {
                    return fallbackDuration;
                  }
                  const d = audioRef.current ? audioRef.current.duration : 0;
                  if (isFinite(d) && !isNaN(d) && d > 0) return d;
                  return Math.max(time, 1);
                }
                return Math.max(prev, time);
              });

              // A-B loop check
              if (loopState === 'looping' && loopStart !== null && loopEnd !== null) {
                if (time >= loopEnd || time < loopStart - 0.25) {
                  audioRef.current.currentTime = loopStart;
                  if (audioRef.current.paused) {
                    audioRef.current.play().catch(() => {});
                  }
                }
              }
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              updateDurationIfValid(audioRef.current.duration);
              audioRef.current.playbackRate = playbackRate;
            }
          }}
          onDurationChange={() => {
            if (audioRef.current) {
              updateDurationIfValid(audioRef.current.duration);
            }
          }}
        />
      )}

      {title && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-700 truncate max-w-[200px]">{title}</span>
          {playbackRate !== 1.0 && (
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              {playbackRate}x 배속 재생 중
            </span>
          )}
        </div>
      )}

      {/* Error / Loading feedback banner */}
      {loadError && (
        <div className="flex items-center justify-between gap-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="truncate">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={resolveSource}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-800 bg-rose-100 hover:bg-rose-200 px-2 py-0.5 rounded cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            다시 시도
          </button>
        </div>
      )}

      {/* Main Controls: Buttons in ONE single row (compact sizes & aligned boxes) */}
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {/* Playback Buttons Group: [ x0.75 ]  [ ▶ / ❚❚ ]  [ x1.25 ] */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Left Speed Button: x0.75 */}
          <button
            type="button"
            onClick={() => handleSpeedChange(0.75)}
            title="0.75배속 (느리게 듣기)"
            className={`px-2 h-7.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center ${
              playbackRate === 0.75
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200/80'
            }`}
          >
            x0.75
          </button>

          {/* Center Play/Pause Button - Compact Size */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={isLoadingSource || !playableSrc}
            title={isPlaying ? '일시정지' : '재생'}
            className={`w-7.5 h-7.5 rounded-lg text-white flex items-center justify-center shadow-xs transition-all cursor-pointer select-none shrink-0 ${
              isLoadingSource || !playableSrc
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
            }`}
          >
            {isLoadingSource ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-white" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
            )}
          </button>

          {/* Right Speed Button: x1.25 */}
          <button
            type="button"
            onClick={() => handleSpeedChange(1.25)}
            title="1.25배속 (빠르게 듣기)"
            className={`px-2 h-7.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center ${
              playbackRate === 1.25
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200/80'
            }`}
          >
            x1.25
          </button>
        </div>

        {/* Action Buttons Group: (Optional Loop), Replay, Mute */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* A-B Repeat Button */}
          {!hideLoop && (
            <button
              type="button"
              onClick={handleLoopToggle}
              title={
                loopState === 'off'
                  ? '구간 반복 재생: 클릭 시 현재 위치를 시작점(A)으로 설정'
                  : loopState === 'setting_b'
                  ? `시작점 A(${formatTime(loopStart ?? 0)}) 설정됨. 원하는 위치에서 다시 클릭하면 끝점(B)으로 설정되어 반복 재생됩니다.`
                  : `현재 ${formatTime(loopStart ?? 0)} ~ ${formatTime(loopEnd ?? 0)} 구간 반복 재생 중. 클릭 시 해제됩니다.`
              }
              className={`flex items-center gap-1 px-2 h-7.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                loopState === 'off'
                  ? 'bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200/80'
                  : loopState === 'setting_b'
                  ? 'bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-2xs animate-pulse ring-1 ring-amber-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-2xs ring-1 ring-indigo-300'
              }`}
            >
              <Repeat className={`w-3 h-3 ${loopState === 'setting_b' ? 'animate-spin' : ''}`} />
              <span>
                {loopState === 'off' && 'A-B'}
                {loopState === 'setting_b' && `A→B`}
                {loopState === 'looping' && `${formatTime(loopStart ?? 0)}~${formatTime(loopEnd ?? 0)}`}
              </span>
              {loopState === 'looping' && (
                <span className="text-[9px] bg-white/25 px-1 py-0.2 rounded font-medium ml-0.5">
                  해제
                </span>
              )}
            </button>
          )}

          {/* Replay button */}
          <button
            type="button"
            onClick={handleReplayFromStart}
            title={loopState === 'looping' ? 'A 지점부터 다시 듣기' : '처음부터 다시 듣기'}
            className="w-7.5 h-7.5 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200/80 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Mute button */}
          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? '음소거 해제' : '음소거'}
            className="w-7.5 h-7.5 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200/80 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Progress Bar & Time Display in dedicated line underneath */}
      <div className="flex items-center gap-2 pt-0.5 select-none">
        <span className="text-[11px] font-mono font-medium text-slate-500 shrink-0 text-left min-w-[30px]">
          {formatTime(displayCurrentTime)}
        </span>

        <div className="relative flex-1 flex items-center group py-2 touch-none">
          {/* Custom styled progress rail */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70 pointer-events-none relative">
            {/* Loop region visual highlight */}
            {loopStart !== null && effectiveDuration > 0 && (
              <div
                className={`absolute top-0 bottom-0 z-5 ${
                  loopState === 'looping'
                    ? 'bg-amber-300/60 border-x border-amber-600'
                    : 'bg-amber-400/40 border-l-2 border-amber-500'
                }`}
                style={{
                  left: `${(loopStart / effectiveDuration) * 100}%`,
                  width:
                    loopEnd !== null
                      ? `${Math.max(2, ((loopEnd - loopStart) / effectiveDuration) * 100)}%`
                      : '4px',
                }}
              />
            )}

            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-75 relative z-10"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Draggable thumb visual indicator */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow pointer-events-none transition-transform z-20 ${
              isSeeking ? 'scale-125 ring-2 ring-indigo-300' : 'group-hover:scale-110'
            }`}
            style={{ left: `${progressPercent}%` }}
          />

          {/* Transparent native range slider over rail */}
          <input
            type="range"
            min={0}
            max={effectiveDuration > 0 ? effectiveDuration : 100}
            step={0.1}
            value={displayCurrentTime}
            onPointerDown={handleSeekStart}
            onPointerUp={handleSeekEnd}
            onPointerCancel={handleSeekEnd}
            onMouseDown={handleSeekStart}
            onMouseUp={handleSeekEnd}
            onTouchStart={handleSeekStart}
            onTouchEnd={handleSeekEnd}
            onChange={handleSeekChange}
            disabled={!playableSrc || (effectiveDuration <= 0 && displayCurrentTime === 0)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-30"
          />
        </div>

        <span className="text-[11px] font-mono font-medium text-slate-500 shrink-0 text-right min-w-[30px]">
          {formatTime(effectiveDuration)}
        </span>
      </div>
    </div>
  );
};
