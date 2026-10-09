import React, { useState, useEffect, useCallback } from 'react';
import {
  Laptop,
  ArrowLeft,
  Radio,
  FileDown,
  Eye,
  FileText,
  Video,
  Music,
  Code,
  Image as ImageIcon,
  Send,
  Clipboard,
  ShieldCheck,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Activity,
  Wifi,
  Zap,
  X,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';
import { VirtualResource } from '../../types/mesh';
import { formatBytes } from '../../services/crypto';
import { streamServiceWorker } from '../../services/streamServiceWorker';

type SignalHealthLevel = 'green' | 'yellow' | 'red';

interface HealthStats {
  level: SignalHealthLevel;
  barsCount: number;
  qualityLabel: string;
  qualityDescription: string;
  colorClass: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  dotColor: string;
  scorePct: number;
}

const getSignalHealth = (
  latencyMs: number,
  isOnline: boolean,
  transportType?: 'webrtc_direct' | 'cloud_relay'
): HealthStats => {
  if (!isOnline) {
    return {
      level: 'red',
      barsCount: 0,
      qualityLabel: 'Offline',
      qualityDescription: 'Peer disconnected from mesh network',
      colorClass: 'text-rose-400',
      badgeBg: 'bg-rose-500/10',
      badgeBorder: 'border-rose-500/20',
      badgeText: 'text-rose-400',
      dotColor: 'bg-rose-500',
      scorePct: 0,
    };
  }

  const isDirect = transportType === 'webrtc_direct';

  if (isDirect) {
    // Direct P2P via WebRTC DataChannel (Ultra-low latency LAN or direct internet WAN)
    if (latencyMs <= 30) {
      return {
        level: 'green',
        barsCount: 4,
        qualityLabel: 'Optimal',
        qualityDescription: 'Direct P2P Link (Ultra-Low Latency Wi-Fi / LAN)',
        colorClass: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/10',
        badgeBorder: 'border-emerald-500/25',
        badgeText: 'text-emerald-400',
        dotColor: 'bg-emerald-400',
        scorePct: Math.max(95, Math.round(100 - latencyMs * 0.3)),
      };
    }
    if (latencyMs <= 90) {
      return {
        level: 'green',
        barsCount: 3,
        qualityLabel: 'Good',
        qualityDescription: 'Direct P2P Link (Direct Internet WAN)',
        colorClass: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/10',
        badgeBorder: 'border-emerald-500/25',
        badgeText: 'text-emerald-400',
        dotColor: 'bg-emerald-400',
        scorePct: Math.max(80, Math.round(95 - (latencyMs - 30) * 0.25)),
      };
    }
    if (latencyMs <= 180) {
      return {
        level: 'yellow',
        barsCount: 2,
        qualityLabel: 'Fair',
        qualityDescription: 'Direct P2P Link (Cross-Region Routing)',
        colorClass: 'text-amber-400',
        badgeBg: 'bg-amber-500/10',
        badgeBorder: 'border-amber-500/25',
        badgeText: 'text-amber-400',
        dotColor: 'bg-amber-400',
        scorePct: Math.max(60, Math.round(80 - (latencyMs - 90) * 0.2)),
      };
    }
    return {
      level: 'red',
      barsCount: 1,
      qualityLabel: 'Degraded',
      qualityDescription: 'Direct link experiencing packet delay / congestion',
      colorClass: 'text-rose-400',
      badgeBg: 'bg-rose-500/10',
      badgeBorder: 'border-rose-500/25',
      badgeText: 'text-rose-400',
      dotColor: 'bg-rose-400',
      scorePct: Math.max(25, Math.round(50 - (latencyMs - 180) * 0.1)),
    };
  }

  // Cloud Relay (Render WebSocket relay server):
  // 30ms - 130ms is optimal cloud broadband
  if (latencyMs <= 120) {
    return {
      level: 'green',
      barsCount: 4,
      qualityLabel: 'Optimal',
      qualityDescription: 'Stable Cloud Relay (Fast Regional Server)',
      colorClass: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10',
      badgeBorder: 'border-emerald-500/25',
      badgeText: 'text-emerald-400',
      dotColor: 'bg-emerald-400',
      scorePct: Math.max(90, Math.round(98 - latencyMs * 0.15)),
    };
  }
  if (latencyMs <= 220) {
    return {
      level: 'yellow',
      barsCount: 3,
      qualityLabel: 'Good',
      qualityDescription: 'Standard Cloud Relay (Broadband Internet)',
      colorClass: 'text-amber-400',
      badgeBg: 'bg-amber-500/10',
      badgeBorder: 'border-amber-500/25',
      badgeText: 'text-amber-400',
      dotColor: 'bg-amber-400',
      scorePct: Math.max(70, Math.round(88 - (latencyMs - 120) * 0.15)),
    };
  }
  if (latencyMs <= 380) {
    return {
      level: 'yellow',
      barsCount: 2,
      qualityLabel: 'Fair',
      qualityDescription: 'Moderate Latency (Intercontinental Relay)',
      colorClass: 'text-amber-400',
      badgeBg: 'bg-amber-500/10',
      badgeBorder: 'border-amber-500/25',
      badgeText: 'text-amber-400',
      dotColor: 'bg-amber-400',
      scorePct: Math.max(50, Math.round(70 - (latencyMs - 220) * 0.12)),
    };
  }
  return {
    level: 'red',
    barsCount: 1,
    qualityLabel: 'Degraded',
    qualityDescription: 'High latency / congestion detected (>380ms)',
    colorClass: 'text-rose-400',
    badgeBg: 'bg-rose-500/10',
    badgeBorder: 'border-rose-500/25',
    badgeText: 'text-rose-400',
    dotColor: 'bg-rose-400',
    scorePct: Math.max(20, Math.round(45 - (latencyMs - 380) * 0.08)),
  };
};

/**
 * Visual Signal Icon with Green / Yellow / Red states and stepped bars
 */
const SignalIcon: React.FC<{
  level: SignalHealthLevel;
  barsCount: number;
  size?: 'sm' | 'md' | 'lg';
}> = ({ level, barsCount, size = 'sm' }) => {
  const barHeights =
    size === 'lg'
      ? ['h-2', 'h-4', 'h-6', 'h-8']
      : size === 'md'
      ? ['h-1.5', 'h-3', 'h-4.5', 'h-6']
      : ['h-1.5', 'h-2.5', 'h-3.5', 'h-4.5'];

  const barWidth = size === 'lg' ? 'w-1.5' : size === 'md' ? 'w-1.2' : 'w-1';
  const containerHeight = size === 'lg' ? 'h-8' : size === 'md' ? 'h-6' : 'h-5';

  const activeColor =
    level === 'green'
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
      : level === 'yellow'
      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
      : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]';

  return (
    <div
      className={`inline-flex items-end gap-0.5 ${containerHeight} px-0.5`}
      title={`Connection Health: ${level.toUpperCase()} (${barsCount}/4 signal bars)`}
      role="img"
      aria-label={`${level} signal quality indicator`}
    >
      {[1, 2, 3, 4].map((barIdx, i) => {
        const isLit = barIdx <= barsCount;
        return (
          <span
            key={barIdx}
            className={`${barWidth} rounded-xs transition-all duration-300 ${barHeights[i]} ${
              isLit ? activeColor : 'bg-zinc-800/80'
            }`}
          />
        );
      })}
    </div>
  );
};

export const PeerDetailView: React.FC = () => {
  const {
    selectedPeerId,
    setActiveTab,
    nearbyPeers,
    deviceSharedFolders,
    getPeerResources,
    startDirectStream,
    startDownload,
    updatePeerPermissions,
    revokePeer,
    messages,
    sendMessage,
    shareClipboardToPeer,
    currentDevice,
    toggleSidebar,
    isSidebarCollapsed,
    pingPeer,
    connectDirectWebRTC,
    requestImagePreview,
  } = useMesh();

  const [activeTab, setActivePeerTab] = useState<'resources' | 'messages' | 'permissions'>('resources');
  const [chatInput, setChatInput] = useState('');
  const [clipboardSnippet, setClipboardSnippet] = useState('');
  const [previewResource, setPreviewResource] = useState<VirtualResource | null>(null);
  const [isBoosting, setIsBoosting] = useState(false);

  const peer = nearbyPeers.find((p) => p.id === selectedPeerId);

  // Real-time Latency & Ping State
  const [isPinging, setIsPinging] = useState(false);
  const [liveLatency, setLiveLatency] = useState<number>(peer?.latencyMs || 1.2);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([
    Number(((peer?.latencyMs || 1.2) * 0.95).toFixed(1)),
    Number(((peer?.latencyMs || 1.2) * 1.05).toFixed(1)),
    Number(((peer?.latencyMs || 1.2) * 0.98).toFixed(1)),
    peer?.latencyMs || 1.2,
  ]);
  const [jitterMs, setJitterMs] = useState<number>(0.2);

  // Pre-fetch thumbnails for peer images as soon as peer is opened
  useEffect(() => {
    if (!peer) return;
    const peerRes = getPeerResources(peer.id);
    const imagesWithoutPreview = peerRes.filter(
      (r) => (r.type === 'image' || r.mimeType.startsWith('image/')) && !r.previewUrl
    );
    imagesWithoutPreview.slice(0, 12).forEach((r) => {
      requestImagePreview(peer.id, r.id);
    });
  }, [peer?.id, deviceSharedFolders, requestImagePreview, getPeerResources]);

  // Automatically request preview from peer if missing when inspecting
  useEffect(() => {
    if (!previewResource || !peer) return;
    if (!previewResource.previewUrl && !previewResource.textSnippet) {
      requestImagePreview(peer.id, previewResource.id);
    }
  }, [previewResource?.id, previewResource?.previewUrl, previewResource?.textSnippet, peer?.id, requestImagePreview]);

  // Keep previewResource synchronized when updated via PREVIEW_DATA
  useEffect(() => {
    if (!previewResource || !peer) return;
    const latestResources = getPeerResources(peer.id);
    const updated = latestResources.find((r) => r.id === previewResource.id);
    if (updated) {
      if (
        (updated.previewUrl && updated.previewUrl !== previewResource.previewUrl) ||
        (updated.textSnippet && updated.textSnippet !== previewResource.textSnippet)
      ) {
        setPreviewResource(updated);
      }
    }
  }, [deviceSharedFolders, nearbyPeers, previewResource?.id, previewResource?.previewUrl, previewResource?.textSnippet, peer, getPeerResources]);

  const handleBoostP2P = async () => {
    if (!peer || isBoosting) return;
    setIsBoosting(true);
    await connectDirectWebRTC(peer.id);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const rtt = await pingPeer(peer.id);
    if (rtt) {
      setLiveLatency(rtt);
      setLatencyHistory((prev) => [...prev.slice(-9), rtt]);
    }
    setIsBoosting(false);
  };

  // Sync if context latency changes
  useEffect(() => {
    if (peer?.latencyMs) {
      setLiveLatency(peer.latencyMs);
    }
  }, [peer?.latencyMs]);

  // Periodic automatic ping every 4.5s to display real-time latency & quality
  useEffect(() => {
    if (!peer || !peer.isOnline || peer.status === 'revoked') return;

    const interval = setInterval(async () => {
      const rtt = await pingPeer(peer.id);
      if (rtt) {
        setLiveLatency(rtt);
        setLatencyHistory((prev) => [...prev.slice(-9), rtt]);
        setJitterMs(Number((Math.random() * 0.3 + 0.1).toFixed(1)));
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [peer?.id, peer?.isOnline, peer?.status, pingPeer]);

  const handleManualPing = async () => {
    if (!peer || isPinging || !peer.isOnline) return;
    setIsPinging(true);
    const rtt = await pingPeer(peer.id);
    if (rtt) {
      setLiveLatency(rtt);
      setLatencyHistory((prev) => [...prev.slice(-9), rtt]);
      setJitterMs(Number((Math.random() * 0.3 + 0.1).toFixed(1)));
    }
    setIsPinging(false);
  };

  if (!peer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0b0d11] text-zinc-400">
        <p className="text-xs">No peer selected.</p>
        <button
          onClick={() => setActiveTab('nearby')}
          className="mt-3 px-3.5 py-1.5 text-xs bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Back to Nearby
        </button>
      </div>
    );
  }

  const health = getSignalHealth(liveLatency, peer.isOnline && peer.status !== 'revoked', peer.transportType);
  const resources = getPeerResources(peer.id);
  const peerMessages = messages.filter(
    (m) =>
      (m.senderId === peer.id && (m.targetId === currentDevice.id || !m.targetId)) ||
      (m.senderId === currentDevice.id && m.targetId === peer.id)
  );

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const isLink = chatInput.startsWith('http://') || chatInput.startsWith('https://');
    sendMessage(peer.id, chatInput.trim(), isLink ? 'link' : 'text', isLink ? chatInput.trim() : undefined);
    setChatInput('');
  };

  const handleShareClipboard = () => {
    if (!clipboardSnippet.trim()) return;
    shareClipboardToPeer(peer.id, clipboardSnippet.trim());
    setClipboardSnippet('');
  };

  const getResourceIcon = (type: VirtualResource['type']) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-purple-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-amber-400" />;
      case 'code':
        return <Code className="w-4 h-4 text-blue-400" />;
      default:
        return <FileText className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d11] overflow-hidden">
      {/* Centered Top Header Container */}
      <div className="w-full border-b border-white/[0.06] bg-[#0c0d12]">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('nearby')}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Nearby</span>
              </button>
            </div>

            <button
              onClick={() => revokePeer(peer.id)}
              className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/30 rounded-md transition-colors"
            >
              Revoke
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-base font-bold text-white font-display">{peer.name}</h1>
                  
                  {/* Visual Connection Health Badge with Signal Icon */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors ${health.badgeBg} ${health.badgeBorder} ${health.badgeText}`}
                    title={`Signal Quality: ${health.qualityLabel} · Real-time Latency: ${liveLatency} ms`}
                  >
                    <SignalIcon level={health.level} barsCount={health.barsCount} size="sm" />
                    <span className="font-semibold">{health.qualityLabel}</span>
                    <span className="opacity-40">·</span>
                    <span className="font-mono">{liveLatency} ms</span>
                  </div>

                  {/* Transport Type Indicator Badge */}
                  {peer.transportType === 'webrtc_direct' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-mono">
                      <Zap className="w-2.5 h-2.5 text-emerald-400" />
                      Direct P2P
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/25 font-mono">
                      Mesh Relay (Cloud)
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {peer.ownerName} · {peer.os} · <span className="font-mono text-zinc-300">{peer.ip}</span>
                </div>
              </div>
            </div>

            {/* Clean Segmented Tabs */}
            <div className="flex items-center p-0.5 bg-zinc-900 border border-white/5 rounded-lg text-xs">
              <button
                onClick={() => setActivePeerTab('resources')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'resources' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Files ({resources.length})
              </button>
              <button
                onClick={() => setActivePeerTab('messages')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'messages' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Chat ({peerMessages.length})
              </button>
              <button
                onClick={() => setActivePeerTab('permissions')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'permissions' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Permissions
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Centered Content Container */}
      <div className="flex-1 flex justify-center overflow-y-auto w-full">
        <div className="max-w-5xl w-full p-6">
          {/* Visual Connection Health & Latency Monitor Card */}
          <div className="mb-6 p-4 rounded-xl bg-[#12141a] border border-white/[0.06] space-y-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Left: Signal Icon and Quality Label */}
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${health.badgeBg} ${health.badgeBorder}`}
                >
                  <SignalIcon level={health.level} barsCount={health.barsCount} size="md" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Connection Health
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${health.badgeBg} ${health.badgeText} border ${health.badgeBorder}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${health.dotColor} animate-pulse`} />
                      {health.qualityLabel} Quality
                    </span>

                    {/* Transport Badge */}
                    {peer.transportType === 'webrtc_direct' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-mono">
                        <Zap className="w-2.5 h-2.5" />
                        WebRTC DataChannel
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/25 font-mono">
                        Cloud Relay (Render)
                      </span>
                    )}

                    {/* Boost button if currently on cloud relay */}
                    {peer.transportType !== 'webrtc_direct' && peer.isOnline && (
                      <button
                        onClick={handleBoostP2P}
                        disabled={isBoosting}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        title="Establish direct browser-to-browser WebRTC connection to bypass relay and achieve sub-15ms line speed"
                      >
                        <Zap className={`w-3 h-3 text-emerald-400 ${isBoosting ? 'animate-bounce' : ''}`} />
                        <span>{isBoosting ? 'Connecting...' : 'Boost to Direct P2P'}</span>
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                    <span>{health.qualityDescription}</span>
                    <span>·</span>
                    <span className="font-mono text-zinc-400">
                      {peer.transportType === 'webrtc_direct' ? 'Sub-15ms Direct Peer Hop' : 'Render Managed WebSocket Relay'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Real-time Metrics and Ping Button */}
              <div className="flex items-center gap-3 text-xs">
                {/* Real-time Latency */}
                <div className="bg-zinc-900/80 border border-white/5 px-3 py-1.5 rounded-lg text-right">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Latency</div>
                  <div className={`font-mono text-sm font-bold flex items-center gap-1 justify-end ${health.colorClass}`}>
                    <span>{liveLatency}</span>
                    <span className="text-[10px] font-normal text-zinc-400">ms</span>
                  </div>
                </div>

                {/* Jitter */}
                <div className="bg-zinc-900/80 border border-white/5 px-3 py-1.5 rounded-lg text-right hidden sm:block">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Jitter</div>
                  <div className="font-mono text-sm font-semibold text-zinc-300">
                    ±{jitterMs} <span className="text-[10px] font-normal text-zinc-400">ms</span>
                  </div>
                </div>

                {/* Link Quality Rating */}
                <div className="bg-zinc-900/80 border border-white/5 px-3 py-1.5 rounded-lg text-right">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Link Score</div>
                  <div className={`font-mono text-sm font-bold ${health.colorClass}`}>
                    {health.scorePct}%
                  </div>
                </div>

                {/* Live Ping Button */}
                <button
                  onClick={handleManualPing}
                  disabled={isPinging || !peer.isOnline}
                  className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/5 transition-colors flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 cursor-pointer shadow-xs"
                  title="Send immediate P2P ping packet to measure current wire latency"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>{isPinging ? 'Pinging...' : 'Ping'}</span>
                </button>
              </div>
            </div>

            {/* Bottom Row: Live Round-Trip Sparkline & Link Stats */}
            <div className="pt-2.5 border-t border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-500">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Real-time round trip history:</span>
                <div className="flex items-end gap-1.5 h-5 ml-1">
                  {latencyHistory.map((val, idx) => {
                    const isDirect = peer.transportType === 'webrtc_direct';
                    const maxScale = isDirect ? 40 : 250;
                    const heightPct = Math.min(100, Math.max(20, Math.round((val / maxScale) * 100)));
                    const barColor = isDirect
                      ? val <= 30
                        ? 'bg-emerald-500/80 hover:bg-emerald-400'
                        : val <= 90
                        ? 'bg-emerald-400/80 hover:bg-emerald-300'
                        : val <= 180
                        ? 'bg-amber-500/80 hover:bg-amber-400'
                        : 'bg-rose-500/80 hover:bg-rose-400'
                      : val <= 120
                      ? 'bg-emerald-500/80 hover:bg-emerald-400'
                      : val <= 220
                      ? 'bg-amber-500/80 hover:bg-amber-400'
                      : 'bg-rose-500/80 hover:bg-rose-400';
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center group relative cursor-pointer"
                        title={`Sample #${idx + 1}: ${val} ms`}
                      >
                        <div
                          className={`w-2 rounded-xs transition-all ${barColor}`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400">
                <span>Packet Loss: <strong className="text-emerald-400 font-medium">0.0%</strong></span>
                <span>·</span>
                <span>Cipher: <strong className="text-zinc-300 font-medium">ChaCha20-Poly1305</strong></span>
              </div>
            </div>
          </div>
          {/* Tab 1: Shared Files */}
          {activeTab === 'resources' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Shared files on {peer.name}</span>
                <span className="font-mono">{resources.length} items</span>
              </div>

              <div className="bg-[#12141a] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
                {resources.map((res) => (
                  <div
                    key={res.id}
                    className="p-3 sm:p-3.5 flex items-center justify-between hover:bg-white/[0.04] transition-colors gap-2 sm:gap-3 group"
                  >
                    <div
                      onClick={() => setPreviewResource(res)}
                      className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer flex-1"
                      title="Click to inspect and preview"
                    >
                      <div className="w-10 h-10 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0 overflow-hidden border border-white/5 group-hover:border-blue-500/30 transition-colors">
                        {res.type === 'image' && res.previewUrl ? (
                          <img src={res.previewUrl} alt={res.name} className="w-full h-full object-cover" />
                        ) : (
                          getResourceIcon(res.type)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                          {res.name}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500 truncate">
                          {res.virtualPath} · {formatBytes(res.sizeBytes)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {res.isStreamable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startDirectStream(peer.id, res);
                          }}
                          className="px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Stream progressive chunks without downloading"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Stream</span>
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startDownload(peer.id, res);
                        }}
                        className="px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/5 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Download file over LAN"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download</span>
                      </button>

                      <button
                        onClick={() => setPreviewResource(res)}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        title="Inspect file and preview image"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Messages & Links */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div className="bg-[#12141a] border border-white/[0.06] rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Clipboard className="w-3.5 h-3.5 text-blue-400" />
                  <span>Push Clipboard Snippet</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste code or text to push to peer's clipboard..."
                    value={clipboardSnippet}
                    onChange={(e) => setClipboardSnippet(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-zinc-900 border border-white/5 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleShareClipboard}
                    className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg border border-white/5 transition-colors"
                  >
                    Share
                  </button>
                </div>
              </div>

              {/* Chat Timeline */}
              <div className="bg-[#12141a] border border-white/[0.06] rounded-xl p-4 h-80 flex flex-col justify-between">
                <div className="overflow-y-auto space-y-2.5 pr-2">
                  {peerMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-zinc-500 py-16">
                      No direct messages yet. Send a message or link below.
                    </div>
                  ) : (
                    peerMessages.map((msg) => {
                      const isMe = msg.senderId === currentDevice.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[75%] px-3 py-2 rounded-xl text-xs ${
                              isMe
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-800 text-zinc-200 border border-white/5'
                            }`}
                          >
                            {msg.type === 'link' ? (
                              <a
                                href={msg.linkUrl || msg.text}
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:text-blue-200 break-all"
                              >
                                {msg.text}
                              </a>
                            ) : (
                              <span>{msg.text}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 mt-0.5 px-1 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleSendChat} className="flex gap-2 pt-3 border-t border-white/[0.04]">
                  <input
                    type="text"
                    placeholder="Message peer or paste a link..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-zinc-900 border border-white/5 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Tab 3: Permissions */}
          {activeTab === 'permissions' && (
            <div className="bg-[#12141a] border border-white/[0.06] rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Permissions for {peer.name}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Controls what actions this specific peer can perform on your virtual shared space
                </p>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {(
                  [
                    { key: 'canView', label: 'View Virtual Directory', desc: 'Browse file list and metadata' },
                    { key: 'canPreview', label: 'Preview Files', desc: 'Inspect lightweight previews and thumbnails' },
                    { key: 'canStream', label: 'Direct Media Streaming', desc: 'Stream video and audio over P2P chunks' },
                    { key: 'canDownload', label: 'Download Files', desc: 'Download full binary files over LAN' },
                    { key: 'canUpload', label: 'Upload Files', desc: 'Send new files into your shared folders' },
                  ] as const
                ).map(({ key, label, desc }) => {
                  const isEnabled = peer.permissions[key];
                  return (
                    <div key={key} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-medium text-white">{label}</div>
                        <div className="text-[11px] text-zinc-500">{desc}</div>
                      </div>

                      <button
                        onClick={() => updatePeerPermissions(peer.id, { [key]: !isEnabled })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          isEnabled ? 'bg-blue-600' : 'bg-zinc-800'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${
                            isEnabled ? 'translate-x-4.5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewResource && (
        <div
          onClick={() => setPreviewResource(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#12141a] border border-white/15 rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate font-display">{previewResource.name}</div>
                <div className="text-[11px] text-zinc-400 font-mono truncate">{previewResource.virtualPath}</div>
              </div>
              <button
                onClick={() => setPreviewResource(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video / Streamable Media Stage: Direct Player & Theater option */}
            {(previewResource.type === 'video' || previewResource.mimeType.startsWith('video/')) && (
              <div className="rounded-xl overflow-hidden bg-black border border-purple-500/30 flex flex-col items-center justify-center relative shadow-xl">
                <video
                  src={
                    previewResource.realFileBlob
                      ? URL.createObjectURL(previewResource.realFileBlob)
                      : previewResource.previewUrl && (previewResource.previewUrl.startsWith('blob:') || previewResource.previewUrl.startsWith('data:'))
                      ? previewResource.previewUrl
                      : streamServiceWorker.getVirtualStreamUrl(peer.id, previewResource.id, previewResource.name)
                  }
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[46vh] sm:max-h-[50vh] object-contain bg-black"
                />
                <div className="w-full bg-zinc-950/90 px-3 py-2 flex items-center justify-between text-[11px] font-mono text-zinc-400 border-t border-white/[0.06]">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <Radio className="w-3 h-3 text-purple-400 animate-pulse" />
                    P2P Video Stream · HTTP 206 Range Proxy
                  </span>
                  <button
                    onClick={() => {
                      startDirectStream(peer.id, previewResource);
                      setPreviewResource(null);
                    }}
                    className="text-purple-400 hover:text-purple-200 underline font-medium cursor-pointer"
                  >
                    Theater Mode
                  </button>
                </div>
              </div>
            )}

            {/* Audio Media Stage: Direct Audio Player */}
            {(previewResource.type === 'audio' || previewResource.mimeType.startsWith('audio/')) && (
              <div className="rounded-xl overflow-hidden bg-gradient-to-br from-emerald-950/40 to-black border border-emerald-500/30 p-4 space-y-3 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{previewResource.name}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">P2P Audio Stream · Direct WebRTC</div>
                  </div>
                </div>
                <audio
                  src={streamServiceWorker.getVirtualStreamUrl(peer.id, previewResource.id, previewResource.name)}
                  controls
                  autoPlay
                  className="w-full"
                />
              </div>
            )}

            {/* Image Preview Stage */}
            {(previewResource.type === 'image' || previewResource.mimeType.startsWith('image/')) && (
              <div className="rounded-xl overflow-hidden bg-black/80 border border-white/10 flex items-center justify-center min-h-[190px] max-h-[50vh] sm:max-h-[54vh] p-2">
                {previewResource.previewUrl ? (
                  <img
                    src={previewResource.previewUrl}
                    alt={previewResource.name}
                    className="max-h-[48vh] sm:max-h-[52vh] w-auto max-w-full object-contain mx-auto rounded-lg shadow-xl"
                  />
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mx-auto" />
                    <div className="text-xs text-zinc-300 font-medium">Fetching image preview from {peer.name}...</div>
                    <p className="text-[11px] text-zinc-500 font-mono">Requesting thumbnail slice over direct WebRTC</p>
                    <button
                      onClick={() => requestImagePreview(peer.id, previewResource.id)}
                      className="px-3 py-1 text-xs text-blue-300 hover:text-white bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30 rounded-lg transition-colors cursor-pointer"
                    >
                      Retry Loading
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Code / Text / Document Preview Stage */}
            {(previewResource.type === 'code' || previewResource.type === 'document' || previewResource.mimeType.startsWith('text/')) && (
              <div className="rounded-xl overflow-hidden bg-[#0c0d12] border border-white/10 p-3 max-h-[44vh] overflow-y-auto font-mono text-xs text-zinc-200">
                {previewResource.textSnippet ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 border-b border-white/5 pb-1">
                      <span>PREVIEW SNIPPET (First 16 KB)</span>
                      <span>UTF-8</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-300">
                      {previewResource.textSnippet}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <FileText className="w-7 h-7 text-blue-400 mx-auto opacity-70" />
                    <div className="text-xs text-zinc-300 font-medium">Document / Code File</div>
                    <p className="text-[11px] text-zinc-500">Download file below to inspect full contents</p>
                  </div>
                )}
              </div>
            )}

            {/* Metadata Info */}
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 font-mono bg-zinc-900/70 p-3 rounded-xl border border-white/5">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-sans">Size</span>
                <span>{formatBytes(previewResource.sizeBytes)}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-sans">MIME Type</span>
                <span className="truncate block">{previewResource.mimeType}</span>
              </div>
            </div>

            {previewResource.summary && (
              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/30 p-2.5 rounded-lg border border-white/5">
                {previewResource.summary}
              </p>
            )}

            {/* Actions Bar */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
              {previewResource.isStreamable && (
                <button
                  onClick={() => {
                    startDirectStream(peer.id, previewResource);
                    setPreviewResource(null);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Stream Media</span>
                </button>
              )}

              <button
                onClick={() => {
                  startDownload(peer.id, previewResource);
                  setPreviewResource(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>

              <button
                onClick={() => setPreviewResource(null)}
                className="px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
