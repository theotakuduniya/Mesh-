import React, { useState } from 'react';
import {
  FileDown,
  Pause,
  Play,
  X,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  Sun,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';
import { formatBytes } from '../../services/crypto';

export const TransferManager: React.FC = () => {
  const {
    activeTransfers,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    isTransfersDrawerOpen,
    setIsTransfersDrawerOpen,
  } = useMesh();
  const [isExpanded, setIsExpanded] = useState(true);

  if (activeTransfers.length === 0 || !isTransfersDrawerOpen) return null;

  const activeCount = activeTransfers.filter((t) => t.status === 'transferring').length;

  return (
    <div className="fixed bottom-16 sm:bottom-4 right-2 sm:right-4 left-2 sm:left-auto max-w-md w-auto sm:w-full z-40 bg-[#12151c] border border-white/20 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-zinc-900 border-b border-white/[0.08] flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <FileDown className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-white tracking-tight">
            LAN Transfers
          </span>
          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-500/30">
            {activeTransfers.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <>
              <span className="text-[11px] font-mono text-emerald-400 tabular-nums flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {activeCount} active
              </span>
              <span
                className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded hidden sm:flex items-center gap-1"
                title="Screen Wake Lock is active to prevent mobile OS sleep and throttling"
              >
                <Sun className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                Screen Awake
              </span>
            </>
          )}
          <button
            type="button"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {/* Close X Button to dismiss LAN transfers div */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsTransfersDrawerOpen(false);
            }}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            title="Close LAN transfers"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded List */}
      {isExpanded && (
        <div className="p-3 max-h-72 overflow-y-auto space-y-2.5 divide-y divide-white/[0.06]">
          {activeTransfers.map((xfer) => {
            const progress = xfer.fileSizeBytes > 0
              ? Math.min(100, Math.round((xfer.bytesTransferred / xfer.fileSizeBytes) * 100))
              : 0;
            const isCompleted = xfer.status === 'completed';
            const isPaused = xfer.status === 'paused';
            const isCancelled = xfer.status === 'cancelled';

            return (
              <div key={xfer.id} className="pt-2 first:pt-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100 truncate">
                      {xfer.resourceName}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      From {xfer.peerName} · Chunked WebRTC Stream
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!isCompleted && !isCancelled && (
                      <button
                        onClick={() => (isPaused ? resumeTransfer(xfer.id) : pauseTransfer(xfer.id))}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        title={isPaused ? 'Resume transfer' : 'Pause transfer'}
                      >
                        {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {!isCompleted && (
                      <button
                        onClick={() => cancelTransfer(xfer.id)}
                        className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                        title="Cancel transfer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      isCompleted
                        ? 'bg-emerald-500'
                        : isCancelled
                        ? 'bg-rose-500'
                        : isPaused
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Metadata & Speed */}
                <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-zinc-400">
                  <span>
                    {formatBytes(xfer.bytesTransferred)} / {formatBytes(xfer.fileSizeBytes)} ({progress}%)
                  </span>

                  {isCompleted ? (
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <ShieldCheck className="w-3 h-3" />
                        SHA-256 Verified
                      </span>
                      {xfer.downloadUrl && (
                        <a
                          href={xfer.downloadUrl}
                          download={xfer.resourceName}
                          className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Save downloaded file to your local computer"
                        >
                          <FileDown className="w-2.5 h-2.5" />
                          <span>Save File</span>
                        </a>
                      )}
                    </div>
                  ) : isCancelled ? (
                    <span className="text-rose-400">Cancelled</span>
                  ) : isPaused ? (
                    <span className="text-amber-400">Paused</span>
                  ) : (
                    <span className="text-zinc-300">
                      {xfer.speedMbps} MB/s · Chunk {xfer.currentChunk}/{xfer.totalChunks}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
