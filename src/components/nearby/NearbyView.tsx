import React, { useState } from 'react';
import {
  Laptop,
  Activity,
  ArrowRight,
  Search,
  Radio,
  ShieldCheck,
  Clock,
  Share2,
  Copy,
  Check,
  Plus,
  Network,
  X,
  ExternalLink,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';

export const NearbyView: React.FC = () => {
  const {
    currentDevice,
    nearbyPeers,
    pingPeer,
    requestPairing,
    setSelectedPeerId,
    setActiveTab,
    revokePeer,
  } = useMesh();

  const [filter, setFilter] = useState<'all' | 'paired'>('all');
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [recentlyPingedId, setRecentlyPingedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPingingAll, setIsPingingAll] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isManualPairOpen, setIsManualPairOpen] = useState(false);
  const [manualPeerInput, setManualPeerInput] = useState('');

  const handlePing = async (peerId: string) => {
    setPingingId(peerId);
    try {
      await pingPeer(peerId);
      setRecentlyPingedId(peerId);
      setTimeout(() => {
        setRecentlyPingedId((curr) => (curr === peerId ? null : curr));
      }, 1500);
    } finally {
      setPingingId(null);
    }
  };

  const handlePingAll = async () => {
    if (isPingingAll || nearbyPeers.length === 0) return;
    setIsPingingAll(true);
    try {
      for (const peer of nearbyPeers) {
        setPingingId(peer.id);
        await pingPeer(peer.id);
        setRecentlyPingedId(peer.id);
        await new Promise((r) => setTimeout(r, 180));
      }
      setTimeout(() => setRecentlyPingedId(null), 1000);
    } finally {
      setPingingId(null);
      setIsPingingAll(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}?pair=${currentDevice.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleManualPairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPeerInput.trim()) return;
    requestPairing(manualPeerInput.trim());
    setManualPeerInput('');
    setIsManualPairOpen(false);
  };

  const filteredPeers = nearbyPeers.filter((peer) => {
    const matchesFilter = filter === 'all' || peer.status === 'paired';
    const matchesSearch =
      peer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      peer.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      peer.ip.includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d11] overflow-hidden">
      {/* Header Container */}
      <div className="w-full border-b border-white/[0.06] bg-[#0c0d12]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-display">Nearby Devices</h1>
                <span className="text-zinc-600">·</span>
                <span className="text-xs text-zinc-400 font-mono tabular-nums">
                  {nearbyPeers.length} online
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Zero-cloud peer-to-peer discovery on local network & WebSocket mesh
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-zinc-900 border border-white/5 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-36 sm:w-44"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center p-0.5 bg-zinc-900 border border-white/5 rounded-lg text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filter === 'all' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('paired')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filter === 'paired' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Paired
              </button>
            </div>

            {/* Copy Invite Link */}
            <button
              onClick={handleCopyInviteLink}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-300 transition-colors flex items-center gap-1.5 shadow-xs"
              title="Copy direct invite link to connect another device"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Share Link</span>
                </>
              )}
            </button>

            {/* Manual Pair by Node ID */}
            <button
              onClick={() => setIsManualPairOpen(true)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 shadow-xs"
              title="Connect manually using Peer ID or Code"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect by ID</span>
            </button>

            {/* Ping All */}
            {nearbyPeers.length > 0 && (
              <button
                onClick={handlePingAll}
                disabled={isPingingAll}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-300 transition-colors flex items-center gap-1.5"
                title="Ping all discovered devices"
              >
                <Activity className={`w-3.5 h-3.5 text-emerald-400 ${isPingingAll ? 'animate-spin' : ''}`} />
                <span>Ping All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex justify-center overflow-y-auto w-full">
        <div className="max-w-5xl w-full p-6 space-y-6">
          {filteredPeers.length === 0 ? (
            /* Clean, Informative Production Empty State */
            <div className="space-y-6">
              <div className="py-14 px-6 text-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 flex flex-col items-center justify-center space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Radio className="w-8 h-8 animate-pulse text-blue-400" />
                  </div>
                  <div className="absolute inset-0 rounded-full border border-blue-500/30 animate-ping opacity-25" />
                </div>

                <div className="max-w-md space-y-1">
                  <h3 className="text-base font-semibold text-white">Listening for Nearby Devices</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    No other computers or phones detected on your network yet. Mesh uses local-first discovery without storing your files in any cloud.
                  </p>
                </div>

                {/* Instructions & Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full text-left pt-2">
                  <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Network className="w-4 h-4 text-emerald-400" />
                      <span>Option 1: Open on 2nd Device</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Open this exact application URL in another browser window, laptop, or mobile phone on the same Wi-Fi. It will appear automatically!
                    </p>
                    <button
                      onClick={handleCopyInviteLink}
                      className="w-full py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-white/5 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                      <span>{copiedLink ? 'Copied URL!' : 'Copy Direct Pairing Link'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      <span>Option 2: Direct Peer ID</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Enter the Peer Node ID of another machine to establish a direct cryptographic handshake and unlock shared folders.
                    </p>
                    <button
                      onClick={() => setIsManualPairOpen(true)}
                      className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Enter Peer Node ID</span>
                    </button>
                  </div>
                </div>

                {/* This Device's Active Identity Pill */}
                <div className="pt-2 text-xs text-zinc-500 flex items-center gap-2 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>This Device: <strong className="text-zinc-300 font-sans">{currentDevice.name}</strong> ({currentDevice.id})</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredPeers.map((peer) => {
                const isPaired = peer.status === 'paired';
                const isPending = peer.status === 'pairing_requested';
                const isPinging = pingingId === peer.id;
                const wasPinged = recentlyPingedId === peer.id;

                return (
                  <div
                    key={peer.id}
                    className={`bg-[#12141a] border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 ${
                      wasPinged
                        ? 'border-emerald-500/40 bg-zinc-900/60'
                        : 'border-white/[0.06] hover:border-white/15'
                    }`}
                  >
                    {/* Card Top: Identity */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-white truncate max-w-[140px]">
                                {peer.name}
                              </span>
                              {isPaired && (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {peer.ownerName} · {peer.os}
                            </div>
                          </div>
                        </div>

                        {/* Ping / Latency Pill */}
                        <button
                          onClick={() => handlePing(peer.id)}
                          disabled={isPinging}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono transition-all flex items-center gap-1 shrink-0 ${
                            wasPinged
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isPinging
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-white/5'
                          }`}
                          title="Click to send small wire ping packet and measure network round-trip time"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              wasPinged
                                ? 'bg-emerald-400 animate-ping'
                                : (peer.transportType === 'webrtc_direct' ? peer.latencyMs <= 60 : peer.latencyMs <= 180)
                                ? 'bg-emerald-400'
                                : peer.latencyMs <= 380
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            }`}
                          />
                          <span>{isPinging ? '...' : `${peer.latencyMs} ms`}</span>
                        </button>
                      </div>

                      {/* Technical Specs */}
                      <div className="mt-3.5 pt-3 border-t border-white/[0.04] grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                        <div>
                          <span className="text-zinc-600 block text-[9px] uppercase tracking-wider font-sans">IP Address</span>
                          <span className="text-zinc-300">{peer.ip}:{peer.port}</span>
                        </div>
                        <div>
                          <span className="text-zinc-600 block text-[9px] uppercase tracking-wider font-sans">mDNS Host</span>
                          <span className="text-zinc-300 truncate block">{peer.mDnsName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between gap-2">
                      {isPaired ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedPeerId(peer.id);
                              setActiveTab('peer_detail');
                            }}
                            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-1 shadow-xs"
                          >
                            <span>Open Space</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => revokePeer(peer.id)}
                            className="py-1.5 px-2.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-900/30 transition-colors"
                            title="Revoke peer connection"
                          >
                            Revoke
                          </button>
                        </>
                      ) : isPending ? (
                        <div className="w-full py-1.5 px-3 rounded-lg text-xs bg-amber-950/30 text-amber-300 border border-amber-800/30 text-center flex items-center justify-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>Pairing Requested...</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => requestPairing(peer.id)}
                          className="w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/5 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                          <span>Request Pairing</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Manual Pair Modal */}
      {isManualPairOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#12141a] border border-white/15 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-display">Connect to Peer</h3>
              <button
                onClick={() => setIsManualPairOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Enter the Peer Node ID (e.g. <code className="text-blue-400 font-mono">node_abc123</code>) from the other computer to initiate pairing:
            </p>

            <form onSubmit={handleManualPairSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="node_xxxxxxxx"
                value={manualPeerInput}
                onChange={(e) => setManualPeerInput(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsManualPairOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualPeerInput.trim()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                >
                  Send Handshake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
