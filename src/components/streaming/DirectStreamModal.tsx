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
  HardDrive,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';
import { formatBytes } from '../../services/crypto';

export const DirectStreamModal: React.FC = () => {
  const { activeStream, pauseStream, resumeStream, seekStream, closeStream } = useMesh();
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isPlaying = activeStream?.status === 'streaming';
  const isVideo = Boolean(activeStream?.mimeType.startsWith('video/'));
  const isAudio = Boolean(activeStream?.mimeType.startsWith('audio/'));
  const hasRealMediaUrl = Boolean(activeStream?.mediaUrl);

  // Sync real video/audio element with stream state
  useEffect(() => {
    if (!activeStream) return;
    const el = videoRef.current || audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isPlaying, activeStream]);

  useEffect(() => {
    if (!activeStream) return;
    const el = videoRef.current || audioRef.current;
    if (!el) return;
    el.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, activeStream]);

  if (!activeStream) return null;

  const progressRatio = activeStream.durationSeconds > 0
    ? activeStream.currentPositionSeconds / activeStream.durationSeconds
    : 0;
  const bufferRatio = activeStream.totalSizeBytes > 0
    ? Math.min(1, activeStream.bufferedBytes / activeStream.totalSizeBytes)
    : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = Math.floor(ratio * activeStream.durationSeconds);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#101217] border border-white/15 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Stream Header */}
        <div className="px-4 py-3 bg-zinc-950/80 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span className="text-xs font-semibold text-white truncate max-w-xs font-display">
              {activeStream.resourceName}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-xs text-zinc-400 truncate">
              {activeStream.peerName}
            </span>
            {hasRealMediaUrl && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 font-mono">
                Direct PC Playback
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-emerald-400 tabular-nums">
              {(activeStream.speedKbps / 1000).toFixed(1)} Mbps
            </span>
            <button
              onClick={closeStream}
              className="p-1 rounded text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video / Visualizer Stage */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {hasRealMediaUrl && isVideo ? (
            /* Real Video from PC */
            <video
              ref={videoRef}
              src={activeStream.mediaUrl}
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full object-contain"
              playsInline
            />
          ) : hasRealMediaUrl && isAudio ? (
            /* Real Audio from PC with visualizer */
            <div className="text-center space-y-3 z-10 w-full px-6">
              <audio
                ref={audioRef}
                src={activeStream.mediaUrl}
                onTimeUpdate={handleTimeUpdate}
              />
              <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 mx-auto flex items-center justify-center text-purple-400">
                {isPlaying ? <Radio className="w-6 h-6 animate-pulse" /> : <Pause className="w-6 h-6" />}
              </div>
              <div className="flex items-center justify-center gap-1 h-6">
                {[40, 70, 90, 60, 80, 100, 75, 45, 95, 65, 85, 50].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-emerald-400/80 rounded-full transition-all duration-300"
                    style={{
                      height: isPlaying ? `${Math.max(15, (h * Math.sin((activeStream.currentPositionSeconds + i) * 1.5) + 60))}%` : '20%',
                      opacity: isPlaying ? 0.9 : 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Progressive Chunk Visualizer */
            <div className="text-center space-y-3 z-10">
              <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 mx-auto flex items-center justify-center text-purple-400">
                {isPlaying ? (
                  <Radio className="w-6 h-6 animate-pulse" />
                ) : (
                  <Pause className="w-6 h-6" />
                )}
              </div>

              <div className="flex items-center justify-center gap-1 h-6">
                {[40, 70, 90, 60, 80, 100, 75, 45, 95, 65, 85, 50].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-purple-400/80 rounded-full transition-all duration-300"
                    style={{
                      height: isPlaying ? `${Math.max(15, (h * Math.sin((activeStream.currentPositionSeconds + i) * 1.5) + 60))}%` : '20%',
                      opacity: isPlaying ? 0.9 : 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-3.5 bg-zinc-950/80 space-y-2.5 border-t border-white/[0.04]">
          {/* Progress / Buffer Bar */}
          <div className="space-y-1">
            <div
              onClick={handleSeek}
              className="relative h-1.5 bg-zinc-800 rounded-full cursor-pointer overflow-hidden"
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
              <span className="text-zinc-600">
                {formatBytes(activeStream.bufferedBytes)} buffered
              </span>
              <span>{formatTime(activeStream.durationSeconds)}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const target = Math.max(0, activeStream.currentPositionSeconds - 10);
                  seekStream(target);
                  const el = videoRef.current || audioRef.current;
                  if (el) el.currentTime = target;
                }}
                className="p-1 rounded text-zinc-400 hover:text-white"
                title="Rewind 10s"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={isPlaying ? pauseStream : resumeStream}
                className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  const target = Math.min(activeStream.durationSeconds, activeStream.currentPositionSeconds + 10);
                  seekStream(target);
                  const el = videoRef.current || audioRef.current;
                  if (el) el.currentTime = target;
                }}
                className="p-1 rounded text-zinc-400 hover:text-white"
                title="Forward 10s"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1 text-zinc-400 hover:text-white"
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
                  className="w-16 h-1 accent-purple-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="text-[10px] font-mono text-zinc-500">
              P2P WebRTC Direct Range
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
