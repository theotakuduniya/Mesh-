import React from 'react';
import {
  ShieldAlert,
  Radio,
  Split,
  Terminal,
  Activity,
  CheckCircle2,
  PanelLeft,
  PanelLeftClose,
  HelpCircle,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';

export const TitleBar: React.FC = () => {
  const {
    currentDevice,
    switchDeviceProfile,
    emergencyStopActive,
    emergencyRevokeAll,
    resumeSharingAfterEmergency,
    setIsProtocolInspectorOpen,
    recentPackets,
    isDualModeOpen,
    setIsDualModeOpen,
    activeStream,
    activeTransfers,
    setIsTransfersDrawerOpen,
    isSidebarCollapsed,
    toggleSidebar,
    setIsOnboardingOpen,
  } = useMesh();

  const isAlpha = currentDevice.id === 'node_alpha';
  const activeTransferCount = activeTransfers.filter((t) => t.status === 'transferring').length;

  return (
    <header className="h-10 bg-[#090b0e] border-b border-white/[0.06] flex items-center justify-between px-3 text-xs select-none z-50">
      {/* Left: Window Controls, Sidebar Toggle, & App Mark */}
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors cursor-pointer" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors cursor-pointer" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors cursor-pointer" />
        </div>

        <div className="hidden sm:block h-3.5 w-px bg-white/10" />

        {/* Menu Icon to Toggle Sidebar (Desktop rail only) */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <PanelLeft className="w-4 h-4 text-blue-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-100 tracking-tight text-xs font-display">Mesh</span>
          <span className="text-zinc-600">·</span>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{currentDevice.ip}</span>
          </div>
        </div>
      </div>

      {/* Center: Live Status Indicators (only if active) */}
      <div className="hidden md:flex items-center gap-2 text-xs">
        {activeStream && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-950/50 border border-purple-500/30 text-purple-300 text-[11px]">
            <Radio className="w-3 h-3 text-purple-400 animate-pulse" />
            <span>Streaming {activeStream.resourceName}</span>
          </div>
        )}

        {activeTransferCount > 0 && (
          <button
            onClick={() => setIsTransfersDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-950/50 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 text-[11px] transition-colors cursor-pointer"
            title="Open LAN Transfers"
          >
            <Activity className="w-3 h-3 text-blue-400 animate-spin" />
            <span>{activeTransferCount} transfer active</span>
          </button>
        )}
      </div>

      {/* Right: Controls & Onboarding Guide Trigger */}
      <div className="flex items-center gap-1.5">
        {/* Onboarding Guide / Tour */}
        <button
          onClick={() => setIsOnboardingOpen(true)}
          className="px-2 py-1 rounded text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/5 transition-colors flex items-center gap-1.5"
          title="App Guide & Feature Walkthrough"
        >
          <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Guide</span>
        </button>

        {/* Dual Mode Lab & PC Switcher commented out for production
        <div className="flex items-center bg-zinc-900 border border-white/5 rounded-md p-0.5 text-[11px]">
          <button onClick={() => switchDeviceProfile('alpha')} className={`px-2 py-0.5 rounded transition-colors ${isAlpha ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'}`}>PC A</button>
          <button onClick={() => switchDeviceProfile('beta')} className={`px-2 py-0.5 rounded transition-colors ${!isAlpha ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'}`}>PC B</button>
        </div>
        <button onClick={() => setIsDualModeOpen(!isDualModeOpen)} className="px-2 py-1 rounded text-[11px] bg-zinc-900 text-zinc-300">Dual Lab</button>
        */}

        {/* Real Mesh Network Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900/80 border border-white/5 text-[11px] text-zinc-300 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-zinc-400">P2P Relay:</span>
          <span className="text-emerald-400 font-semibold">Active</span>
        </div>

        {/* Protocol Inspector */}
        <button
          onClick={() => setIsProtocolInspectorOpen(true)}
          className="px-2 py-1 rounded text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/5 transition-colors flex items-center gap-1"
          title="Protocol wire packets"
        >
          <Terminal className="w-3 h-3 text-zinc-400" />
          <span className="font-mono text-[10px] text-zinc-400">{recentPackets.length}</span>
        </button>

        {/* Emergency Killswitch */}
        {emergencyStopActive ? (
          <button
            onClick={resumeSharingAfterEmergency}
            className="px-2 py-1 rounded text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1 font-medium"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Resume</span>
          </button>
        ) : (
          <button
            onClick={emergencyRevokeAll}
            className="px-2 py-1 rounded text-[11px] bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/30 transition-colors flex items-center gap-1"
            title="Emergency: stop all active sharing"
          >
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span className="hidden sm:inline">Killswitch</span>
          </button>
        )}
      </div>
    </header>
  );
};
