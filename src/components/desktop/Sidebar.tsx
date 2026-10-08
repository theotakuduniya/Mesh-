import React from 'react';
import {
  Compass,
  Users2,
  FolderLock,
  Clock,
  Settings,
  Laptop,
  Radio,
  FileDown,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useMesh, ActiveNavTab } from '../../context/MeshContext';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    nearbyPeers,
    pairedPeers,
    sharedFolders,
    activeTransfers,
    activeStream,
    currentDevice,
    setSelectedPeerId,
    isSidebarCollapsed,
    toggleSidebar,
  } = useMesh();

  const activeTransferCount = activeTransfers.filter((t) => t.status === 'transferring').length;
  const totalResourceCount = sharedFolders.reduce((acc, f) => acc + f.resourceCount, 0);

  const navItems: { id: ActiveNavTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    {
      id: 'nearby',
      label: 'Nearby',
      icon: Compass,
      count: nearbyPeers.length,
    },
    {
      id: 'rooms',
      label: 'Rooms',
      icon: Users2,
    },
    {
      id: 'shared',
      label: 'Shared Space',
      icon: FolderLock,
      count: totalResourceCount,
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: Clock,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  if (isSidebarCollapsed) {
    // Collapsed Icon-Only Rail
    return (
      <aside className="w-13 bg-[#0c0d11] border-r border-white/[0.06] flex flex-col justify-between items-center py-2.5 shrink-0 select-none transition-all duration-150">
        <div className="space-y-3 flex flex-col items-center w-full px-1">
          {/* Collapse Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4 text-blue-400" />
          </button>

          <div className="w-6 h-px bg-white/5 my-1" />

          {/* Nav Icons */}
          <nav className="space-y-1.5 flex flex-col items-center w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id === 'nearby') setSelectedPeerId(null);
                  }}
                  className={`relative p-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                  {item.count !== undefined && item.count > 0 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Collapsed Bottom Device Icon */}
        <div className="p-1">
          <button
            onClick={() => setActiveTab('settings')}
            className="w-7 h-7 rounded bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            title={`${currentDevice.name} (${currentDevice.ip})`}
          >
            <Laptop className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  // Expanded Sidebar
  return (
    <aside className="w-56 bg-[#0c0d11] border-r border-white/[0.06] flex flex-col justify-between shrink-0 select-none transition-all duration-150">
      <div className="p-2.5">
        {/* Navigation Items */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id === 'nearby') setSelectedPeerId(null);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Paired Devices */}
        {pairedPeers.length > 0 && (
          <div className="mt-5 pt-3 border-t border-white/[0.04]">
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Paired
            </div>

            <div className="space-y-0.5">
              {pairedPeers.map((peer) => (
                <button
                  key={peer.id}
                  onClick={() => {
                    setSelectedPeerId(peer.id);
                    setActiveTab('peer_detail');
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="truncate">{peer.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                    {peer.latencyMs}ms
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Streaming or Transfer Widgets */}
        {(activeStream || activeTransferCount > 0) && (
          <div className="mt-4 p-2 rounded-lg bg-zinc-900/60 border border-white/5 space-y-1.5">
            {activeStream && (
              <div className="text-[11px] text-zinc-300">
                <div className="flex items-center gap-1.5 text-purple-400 font-medium truncate">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span className="truncate">{activeStream.resourceName}</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                  {(activeStream.speedKbps / 1000).toFixed(1)} Mbps direct
                </div>
              </div>
            )}

            {activeTransferCount > 0 && (
              <div className="text-[11px] text-zinc-300">
                <div className="flex items-center gap-1.5 text-blue-400 font-medium truncate">
                  <FileDown className="w-3 h-3" />
                  <span className="truncate">{activeTransfers[0].resourceName}</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                  {((activeTransfers[0].bytesTransferred / activeTransfers[0].fileSizeBytes) * 100).toFixed(0)}% · {activeTransfers[0].speedMbps} MB/s
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Local Device Identity Badge with Quick Collapse button */}
      <div className="p-2.5 border-t border-white/[0.04] bg-[#090b0e] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
            <Laptop className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-zinc-200 truncate font-display">
              {currentDevice.name}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono truncate tabular-nums">
              {currentDevice.ip}
            </div>
          </div>
        </div>

        <button
          onClick={toggleSidebar}
          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
