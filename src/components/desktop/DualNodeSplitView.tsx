import React, { useState } from 'react';
import {
  Split,
  X,
  Laptop,
  Radio,
  FileDown,
  ArrowRight,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';
import { formatBytes } from '../../services/crypto';

export const DualNodeSplitView: React.FC = () => {
  const { isDualModeOpen, setIsDualModeOpen, startDirectStream, startDownload, getPeerFolders, getPeerResources } = useMesh();

  const [chatAtoB, setChatAtoB] = useState('');
  const [chatBtoA, setChatBtoA] = useState('');
  const [splitMessages, setSplitMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'Laptop-Pro', text: 'Connected on subnet 192.168.1.104', time: '15:42' },
    { sender: 'Workstation-Alpha', text: 'Direct P2P WebRTC data channel active.', time: '15:43' },
  ]);

  if (!isDualModeOpen) return null;

  const pcAFolders = getPeerFolders('node_alpha');
  const pcAResources = getPeerResources('node_alpha');

  const handleSendA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatAtoB.trim()) return;
    setSplitMessages((prev) => [
      ...prev,
      {
        sender: 'Workstation-Alpha',
        text: chatAtoB.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatAtoB('');
  };

  const handleSendB = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatBtoA.trim()) return;
    setSplitMessages((prev) => [
      ...prev,
      {
        sender: 'Laptop-Pro',
        text: chatBtoA.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatBtoA('');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#090b0e] text-zinc-200">
      {/* Top Header */}
      <div className="h-10 bg-[#0c0d12] border-b border-white/[0.06] flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <Split className="w-3.5 h-3.5 text-blue-400" />
          <span>Dual Node Simulation Lab</span>
          <span className="text-zinc-500 font-normal">· PC A & PC B</span>
        </div>

        <button
          onClick={() => setIsDualModeOpen(false)}
          className="text-zinc-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Split Grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
        {/* Node A (Workstation-Alpha) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0c10]">
          <div className="px-4 py-3 bg-[#0d0f14] border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-white">PC A: Workstation-Alpha</span>
              <span className="text-[10px] text-zinc-500 font-mono">192.168.1.104</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">Host</span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="text-xs text-zinc-400 flex items-center justify-between">
              <span>Shared Virtual Folders:</span>
              <span className="font-mono text-zinc-500 text-[11px]">{pcAFolders.length} mounts</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              {pcAFolders.map((folder) => (
                <div key={folder.id} className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/5 flex justify-between items-center">
                  <div>
                    <span className="text-white font-medium">{folder.virtualRoot}</span>
                    <span className="text-[10px] text-zinc-500 ml-2">({folder.label})</span>
                  </div>
                  <span className="text-zinc-400">{folder.resourceCount} files · {formatBytes(folder.totalSizeBytes)}</span>
                </div>
              ))}
            </div>

            {/* Chat Box */}
            <div className="p-3 rounded-lg bg-zinc-900/40 border border-white/5 space-y-2">
              <div className="text-xs text-zinc-400">P2P Channel to PC B:</div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
                {splitMessages.map((msg, i) => (
                  <div key={i} className="text-zinc-300">
                    <span className="text-zinc-500 text-[10px]">{msg.sender}:</span> {msg.text}
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendA} className="flex gap-2 pt-1 border-t border-white/5">
                <input
                  type="text"
                  placeholder="Send from PC A..."
                  value={chatAtoB}
                  onChange={(e) => setChatAtoB(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs bg-zinc-900 border border-white/5 rounded text-white"
                />
                <button type="submit" className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded">
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Node B (Laptop-Pro) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0c10]">
          <div className="px-4 py-3 bg-[#0d0f14] border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">PC B: Laptop-Pro</span>
              <span className="text-[10px] text-zinc-500 font-mono">192.168.1.108</span>
            </div>
            <span className="text-[10px] text-blue-400 font-mono">Peer</span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="text-xs text-zinc-400 flex items-center justify-between">
              <span>Accessing PC A's Space:</span>
              <span className="font-mono text-zinc-500 text-[11px]">{pcAResources.length} files available</span>
            </div>

            <div className="space-y-2">
              {pcAResources.length === 0 ? (
                <div className="text-xs text-zinc-500 py-4 text-center bg-zinc-900/30 rounded-lg">
                  No files shared on PC A yet
                </div>
              ) : (
                pcAResources.map((res) => (
                  <div
                    key={res.id}
                    className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{res.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500 truncate">{res.virtualPath} · {formatBytes(res.sizeBytes)}</div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {res.isStreamable && (
                        <button
                          onClick={() => startDirectStream('node_alpha', res)}
                          className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded flex items-center gap-1 cursor-pointer"
                        >
                          <Radio className="w-3 h-3" />
                          <span>Stream</span>
                        </button>
                      )}
                      <button
                        onClick={() => startDownload('node_alpha', res)}
                        className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded flex items-center gap-1 cursor-pointer"
                      >
                        <FileDown className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Box */}
            <div className="p-3 rounded-lg bg-zinc-900/40 border border-white/5 space-y-2">
              <div className="text-xs text-zinc-400">Send to PC A:</div>
              <form onSubmit={handleSendB} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Send from PC B..."
                  value={chatBtoA}
                  onChange={(e) => setChatBtoA(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs bg-zinc-900 border border-white/5 rounded text-white"
                />
                <button type="submit" className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded">
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
