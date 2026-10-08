import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Radio,
  RotateCcw,
  RotateCw,
  Maximize,
  Loader2,
  HardDrive,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';
import { formatBytes } from '../../services/crypto';

export const DirectStreamModal: React.FC = () => {
  const { activeStream, pauseStream, resumeStream, seekStream, closeStream } = useMesh();
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isPlaying = activeStream?.status === 'streaming';
  const isVideo = Boolean(activeStream?.mimeType.startsWith('video/'));
  const isAudio = Boolean(activeStream?.mimeType.startsWith('audio/'));
  const hasRealMediaUrl = Boolean(activeStream?.mediaUrl);

  // Sync real video/audio element with stream state
  useEffect(() => {
    if (!activeStream || !hasRealMediaUrl) return;
    const el = videoRef.current || audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isPlaying, hasRealMediaUrl, activeStream?.id]);

  useEffect(() => {
    const el = videoRef.current || audioRef.current;
    if (!el) return;
    el.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, hasRealMediaUrl]);

  if (!activeStream) return null;

  const progressRatio = activeStream.durationSeconds > 0
    ? activeStream.currentPositionSeconds / activeStream.durationSeconds
    : 0;
  const bufferRatio = activeStream.totalSizeBytes > 0
    ? Math.min(1, activeStream.bufferedBytes / activeStream.totalSizeBytes)
    : 0;
  const bufferPercent = Math.min(100, Math.round(bufferRatio * 100));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = Math.floor(ratio * (activeStream.durationSeconds || 1));
    seekStream(targetSeconds);

    const el = videoRef.current || audioRef.current;
    if (el) {
      el.currentTime = targetSeconds;
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const el = e.currentTarget;
    if (el.duration && !isNaN(el.duration)) {
      seekStream(Math.floor(el.currentTime));
    }
  };

  const toggleFullscreen = () => {
    const el = videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#101217] border border-white/15 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        {/* Stream Header */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-zinc-950/90 border-b border-white/[0.06] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-xs font-display">
              {activeStream.resourceName}
            </span>
            <span className="text-zinc-600 hidden sm:inline">·</span>
            <span className="text-xs text-zinc-400 truncate hidden sm:inline">
              {activeStream.peerName}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/20 font-mono shrink-0">
              {hasRealMediaUrl ? 'Direct P2P Stream' : 'Buffering P2P Stream'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-emerald-400 tabular-nums">
              {(activeStream.speedKbps / 1000).toFixed(1)} Mbps
            </span>
            <button
              onClick={closeStream}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close Stream"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video / Visualizer / Buffering Stage */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden min-h-[220px]">
          {hasRealMediaUrl && isVideo ? (
            /* HTML5 Native Video Player */
            <video
              ref={videoRef}
              src={activeStream.mediaUrl}
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full object-contain max-h-[60vh] bg-black"
              controls
              autoPlay
              playsInline
            />
          ) : hasRealMediaUrl && isAudio ? (
            /* Real Audio from PC with visualizer */
            <div className="text-center space-y-3 z-10 w-full px-6">
              <audio
                ref={audioRef}
                src={activeStream.mediaUrl}
                onTimeUpdate={handleTimeUpdate}
                autoPlay
              />
              <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 mx-auto flex items-center justify-center text-purple-400 shadow-lg">
                {isPlaying ? <Radio className="w-6 h-6 animate-pulse" /> : <Pause className="w-6 h-6" />}
              </div>
              <div className="flex items-center justify-center gap-1.5 h-8">
                {[30, 65, 90, 55, 80, 100, 75, 45, 95, 65, 85, 50, 70, 40].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-emerald-400/80 rounded-full transition-all duration-300"
                    style={{
                      height: isPlaying ? `${Math.max(15, (h * Math.sin((activeStream.currentPositionSeconds + i) * 1.5) + 60))}%` : '20%',
                      opacity: isPlaying ? 0.9 : 0.3,
                    }}
                  />
                ))}
              </div>
              <div className="text-xs text-zinc-400 font-mono">
                P2P Audio Stream · 48kHz Stereo Lossless
              </div>
            </div>
          ) : (
            /* Buffering Over P2P WebRTC */
            <div className="text-center space-y-3.5 z-10 max-w-sm px-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-950/70 border border-purple-500/30 mx-auto flex items-center justify-center text-purple-400 shadow-xl">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold text-white font-display">
                  Buffering P2P Stream...
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                  {formatBytes(activeStream.bufferedBytes)} of {formatBytes(activeStream.totalSizeBytes)} ({bufferPercent}%)
                </div>
              </div>

              {/* Buffer Bar */}
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full transition-all duration-150"
                  style={{ width: `${Math.max(5, bufferPercent)}%` }}
                />
              </div>

              <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>WebRTC DataChannel · Zero Cloud LAN</span>
              </div>
            </div>
          )}
        </div>

        {/* Custom Transport Controls Bar */}
        <div className="p-3 sm:p-3.5 bg-zinc-950/90 space-y-2.5 border-t border-white/[0.06]">
          {/* Progress / Buffer Bar */}
          <div className="space-y-1">
            <div
              onClick={handleSeek}
              className="relative h-2 bg-zinc-800 rounded-full cursor-pointer overflow-hidden"
              title="Click to seek"
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-purple-900/60"
                style={{ width: `${bufferRatio * 100}%` }}
              />
              <div
                className="absolute left-0 top-0 bottom-0 bg-purple-500"
                style={{ width: `${progressRatio * 100}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono tabular-nums text-zinc-400">
              <span>{formatTime(activeStream.currentPositionSeconds)}</span>
              <span className="text-zinc-500">
                {formatBytes(activeStream.bufferedBytes)} buffered ({bufferPercent}%)
              </span>
              <span>{formatTime(activeStream.durationSeconds)}</span>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between pt-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  const target = Math.max(0, activeStream.currentPositionSeconds - 10);
                  seekStream(target);
                  const el = videoRef.current || audioRef.current;
                  if (el) el.currentTime = target;
                }}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Rewind 10s"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={isPlaying ? pauseStream : resumeStream}
                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors shadow-md"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  const target = Math.min(activeStream.durationSeconds, activeStream.currentPositionSeconds + 10);
                  seekStream(target);
                  const el = videoRef.current || audioRef.current;
                  if (el) el.currentTime = target;
                }}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Forward 10s"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 text-zinc-400 hover:text-white"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    if (isMuted) setIsMuted(false);
                  }}
                  className="w-14 sm:w-20 h-1 accent-purple-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isVideo && (
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                  title="Fullscreen"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                P2P WebRTC Direct
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
