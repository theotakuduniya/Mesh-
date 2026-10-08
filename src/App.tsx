/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MeshProvider, useMesh } from './context/MeshContext';
import { TitleBar } from './components/desktop/TitleBar';
import { Sidebar } from './components/desktop/Sidebar';
import { NearbyView } from './components/nearby/NearbyView';
import { PeerDetailView } from './components/peers/PeerDetailView';
import { SharedSpaceView } from './components/shared/SharedSpaceView';
import { RoomsView } from './components/rooms/RoomsView';
import { ActivityView } from './components/activity/ActivityView';
import { SettingsView } from './components/settings/SettingsView';
import { PairingModal } from './components/nearby/PairingModal';
import { DirectStreamModal } from './components/streaming/DirectStreamModal';
import { TransferManager } from './components/transfers/TransferManager';
import { ProtocolInspectorModal } from './components/desktop/ProtocolInspectorModal';
import { DualNodeSplitView } from './components/desktop/DualNodeSplitView';
import { OnboardingModal } from './components/desktop/OnboardingModal';

const MeshAppContent: React.FC = () => {
  const { activeTab } = useMesh();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'nearby':
        return <NearbyView />;
      case 'peer_detail':
        return <PeerDetailView />;
      case 'shared':
        return <SharedSpaceView />;
      case 'rooms':
        return <RoomsView />;
      case 'activity':
        return <ActivityView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <NearbyView />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090b0e] text-zinc-100 font-sans">
      {/* Native Desktop TitleBar */}
      <TitleBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Viewport */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {renderActiveView()}
        </main>
      </div>

      {/* Overlays & Modals */}
      <PairingModal />
      <DirectStreamModal />
      <TransferManager />
      <ProtocolInspectorModal />
      {/* <DualNodeSplitView /> - Dual Node Lab commented out for production */}
      <OnboardingModal />
    </div>
  );
};

export default function App() {
  return (
    <MeshProvider>
      <MeshAppContent />
    </MeshProvider>
  );
}
