import React from 'react';
import {
  Laptop,
  Check,
  X,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';

export const PairingModal: React.FC = () => {
  const { pendingPairRequest, acceptPairing, rejectPairing } = useMesh();

  if (!pendingPairRequest) return null;

  const { peer, safetyCode } = pendingPairRequest;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#12141a] border border-white/15 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Pair Request</h2>
              <div className="text-xs text-zinc-400">{peer.name}</div>
            </div>
          </div>
          <button
            onClick={() => rejectPairing(peer.id)}
            className="text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Verification Code */}
        <div className="bg-zinc-900/80 border border-white/5 rounded-xl p-4 text-center">
          <div className="text-[11px] text-zinc-400 mb-1">Confirmation Code</div>
          <div className="text-2xl font-mono font-bold tracking-widest text-white tabular-nums">
            {safetyCode}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            Verify this code on {peer.name}
          </div>
        </div>

        {/* Peer Info */}
        <div className="text-xs text-zinc-400 flex justify-between px-1 font-mono">
          <span>{peer.ownerName}</span>
          <span>{peer.ip}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => rejectPairing(peer.id)}
            className="flex-1 py-1.5 px-3 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Decline
          </button>
          <button
            onClick={() => acceptPairing(peer.id)}
            className="flex-1 py-1.5 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};
