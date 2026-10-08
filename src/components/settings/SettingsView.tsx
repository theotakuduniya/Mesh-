import React, { useState } from 'react';
import {
  Laptop,
  Radio,
  ShieldAlert,
  Check,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';

export const SettingsView: React.FC = () => {
  const {
    currentDevice,
    setCurrentDevice,
    emergencyStopActive,
    emergencyRevokeAll,
    resumeSharingAfterEmergency,
    logActivity,
    toggleSidebar,
    isSidebarCollapsed,
  } = useMesh();

  const [deviceName, setDeviceName] = useState(currentDevice.name);
  const [ownerName, setOwnerName] = useState(currentDevice.ownerName);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentDevice({
      ...currentDevice,
      name: deviceName.trim(),
      ownerName: ownerName.trim(),
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
    logActivity({
      type: 'security',
      level: 'info',
      title: 'Identity Updated',
      details: `Device name updated to "${deviceName.trim()}"`,
    });
  };

  const handleToggleBroadcast = () => {
    const nextState = !currentDevice.isBroadcasting;
    setCurrentDevice({
      ...currentDevice,
      isBroadcasting: nextState,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d11] overflow-hidden">
      {/* Centered Desktop Header Container */}
      <div className="w-full border-b border-white/[0.06] bg-[#0c0d12]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-display">Settings</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Device identity, network discovery, and sharing controls
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Centered Settings Container */}
      <div className="flex-1 flex justify-center overflow-y-auto w-full">
        <div className="max-w-3xl w-full p-6 space-y-6">
          {/* Section 1: Device Identity */}
          <section className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Device Identity
            </div>

            <form onSubmit={handleSaveIdentity} className="bg-[#12141a] border border-white/[0.06] rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Device Name</label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-md text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-md text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-zinc-900/50 rounded-lg text-xs font-mono text-zinc-400 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500">OS:</span>
                  <span className="text-zinc-200">{currentDevice.os}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Local IP:</span>
                  <span className="text-zinc-200">{currentDevice.ip}:{currentDevice.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Fingerprint:</span>
                  <span className="text-zinc-400 truncate max-w-xs">{currentDevice.fingerprint}</span>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {isSaved && <Check className="w-3.5 h-3.5" />}
                  <span>{isSaved ? 'Saved' : 'Save Identity'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Section 2: Discovery */}
          <section className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              LAN Discovery
            </div>

            <div className="bg-[#12141a] border border-white/[0.06] rounded-xl p-5 flex items-center justify-between text-xs">
              <div>
                <div className="text-zinc-200 font-medium">mDNS Local Broadcast</div>
                <div className="text-zinc-500 text-[11px] mt-0.5">
                  Advertise presence on local subnet ({currentDevice.mDnsName})
                </div>
              </div>
              <button
                onClick={handleToggleBroadcast}
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full transition-colors ${
                  currentDevice.isBroadcasting ? 'bg-blue-600' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${
                    currentDevice.isBroadcasting ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Section 3: Emergency */}
          <section className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Emergency Controls
            </div>

            <div className="bg-[#12141a] border border-white/[0.06] rounded-xl p-5 flex items-center justify-between text-xs">
              <div>
                <div className="text-rose-300 font-medium">Global Killswitch</div>
                <div className="text-zinc-500 text-[11px] mt-0.5">
                  Instantly abort all active transfers, streams, and revoke sharing
                </div>
              </div>

              {emergencyStopActive ? (
                <button
                  onClick={resumeSharingAfterEmergency}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                >
                  Resume Sharing
                </button>
              ) : (
                <button
                  onClick={emergencyRevokeAll}
                  className="px-3 py-1.5 text-xs font-medium bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-md transition-colors flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Trigger Stop</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
