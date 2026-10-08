import React, { useState } from 'react';
import {
  Terminal,
  X,
  Trash2,
  Filter,
  CheckCircle2,
  ArrowRight,
  Radio,
  FileDown,
  Shield,
  Layers,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';
import { ProtocolPacket } from '../../types/mesh';

export const ProtocolInspectorModal: React.FC = () => {
  const { isProtocolInspectorOpen, setIsProtocolInspectorOpen, recentPackets } = useMesh();
  const [selectedPacket, setSelectedPacket] = useState<ProtocolPacket | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');

  if (!isProtocolInspectorOpen) return null;

  const filteredPackets = recentPackets.filter((p) => {
    if (filterAction === 'all') return true;
    return p.action === filterAction;
  });

  const getActionColor = (action: ProtocolPacket['action']) => {
    switch (action) {
      case 'STREAM_REQUEST':
        return 'text-purple-400 bg-purple-950/60 border-purple-500/30';
      case 'DOWNLOAD_REQUEST':
      case 'READ_CHUNK':
        return 'text-blue-400 bg-blue-950/60 border-blue-500/30';
      case 'PAIR_REQUEST':
      case 'PAIR_ACCEPT':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30';
      case 'REVOKE_ACCESS':
        return 'text-rose-400 bg-rose-950/60 border-rose-500/30';
      case 'DISCOVER':
      case 'PING':
        return 'text-zinc-300 bg-zinc-800 border-zinc-700';
      default:
        return 'text-amber-400 bg-amber-950/60 border-amber-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#101319] border border-white/20 rounded-2xl max-w-4xl w-full h-[620px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-black/50 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-mono">
              MESH Application Protocol Wire Inspector
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">
              ({recentPackets.length} LAN packets captured)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-2 py-1 text-xs bg-zinc-900 border border-white/10 rounded-md text-zinc-300 font-mono"
            >
              <option value="all">All Actions</option>
              <option value="DISCOVER">DISCOVER</option>
              <option value="PING">PING</option>
              <option value="PONG">PONG</option>
              <option value="PAIR_REQUEST">PAIR_REQUEST</option>
              <option value="PAIR_ACCEPT">PAIR_ACCEPT</option>
              <option value="STREAM_REQUEST">STREAM_REQUEST</option>
              <option value="DOWNLOAD_REQUEST">DOWNLOAD_REQUEST</option>
              <option value="READ_CHUNK">READ_CHUNK</option>
              <option value="REVOKE_ACCESS">REVOKE_ACCESS</option>
            </select>

            <button
              onClick={() => setIsProtocolInspectorOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content: Packet List Left, JSON Inspector Right */}
        <div className="flex-1 flex overflow-hidden">
          {/* Packet Table */}
          <div className="w-1/2 border-r border-white/[0.08] overflow-y-auto divide-y divide-white/[0.04]">
            {filteredPackets.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                No packets captured yet. Initiate ping, pair, stream, or transfer to observe live wire traffic.
              </div>
            ) : (
              filteredPackets.map((pkt) => {
                const isSelected = selectedPacket?.id === pkt.id;
                return (
                  <button
                    key={pkt.id}
                    onClick={() => setSelectedPacket(pkt)}
                    className={`w-full text-left p-3 hover:bg-white/[0.02] transition-colors ${
                      isSelected ? 'bg-blue-600/15' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getActionColor(pkt.action)}`}>
                        {pkt.action}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500 tabular-nums">
                        {new Date(pkt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-zinc-300 mt-1 font-mono truncate">
                      <span className="text-zinc-400">{pkt.senderName}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                      <span className="text-zinc-400">{pkt.targetId === 'all' ? 'LAN BROADCAST' : pkt.targetId}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* JSON Payload Inspector */}
          <div className="w-1/2 p-4 bg-zinc-950 overflow-y-auto font-mono text-xs">
            {selectedPacket ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-emerald-400 font-bold">{selectedPacket.action} Packet</span>
                  <span className="text-zinc-500 text-[10px]">{selectedPacket.id}</span>
                </div>

                <div className="text-[11px] text-zinc-400 space-y-1">
                  <div>Sender: <span className="text-white">{selectedPacket.senderName} ({selectedPacket.senderId})</span></div>
                  <div>Target: <span className="text-white">{selectedPacket.targetId}</span></div>
                  <div>Timestamp: <span className="text-white">{selectedPacket.timestamp}</span></div>
                </div>

                <div>
                  <div className="text-zinc-500 text-[11px] mb-1 font-semibold uppercase tracking-wider">
                    Wire Payload:
                  </div>
                  <pre className="p-3 bg-black/60 rounded-lg border border-white/5 text-zinc-300 text-[11px] overflow-x-auto leading-relaxed">
                    {JSON.stringify(selectedPacket.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                Select a packet from the stream to inspect raw payload structure.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
