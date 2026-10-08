import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Radio,
  FileDown,
  MessageSquare,
  FolderOpen,
  Info,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';
import { ActivityEvent } from '../../types/mesh';

export const ActivityView: React.FC = () => {
  const { activityLog, toggleSidebar, isSidebarCollapsed } = useMesh();
  const [filterType, setFilterType] = useState<string>('all');

  const filteredLogs = activityLog.filter((log) => {
    if (filterType === 'all') return true;
    return log.type === filterType;
  });

  const getEventIcon = (event: ActivityEvent) => {
    switch (event.type) {
      case 'pairing':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case 'stream':
        return <Radio className="w-3.5 h-3.5 text-purple-400" />;
      case 'transfer':
        return <FileDown className="w-3.5 h-3.5 text-blue-400" />;
      case 'security':
        return event.level === 'alert' ? (
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
        ) : (
          <Info className="w-3.5 h-3.5 text-zinc-400" />
        );
      case 'resource':
        return <FolderOpen className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d11] overflow-hidden">
      {/* Centered Desktop Header Container */}
      <div className="w-full border-b border-white/[0.06] bg-[#0c0d12]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-display">Activity</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Audit history of pairings, transfers, and streams on LAN
              </p>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center p-0.5 bg-zinc-900 border border-white/5 rounded-lg text-xs">
            {['all', 'pairing', 'stream', 'transfer'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 font-medium capitalize rounded-md transition-colors ${
                  filterType === type ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Centered Log Feed Container */}
      <div className="flex-1 flex justify-center overflow-y-auto w-full">
        <div className="max-w-4xl w-full p-6 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="p-16 text-center text-zinc-500 text-xs bg-[#12141a] border border-white/[0.04] rounded-xl">
              No activity events recorded.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-[#12141a] border border-white/[0.04] hover:border-white/10 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0">
                    {getEventIcon(log)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {log.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {log.details}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-zinc-500 shrink-0 tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
