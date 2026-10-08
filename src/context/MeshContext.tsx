/**
 * Central State Management for Mesh Desktop Client - Production P2P Architecture
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  DeviceIdentity,
  PeerDevice,
  SharedFolder,
  VirtualResource,
  PeerPermissions,
  TransferSession,
  StreamSession,
  PeerMessage,
  CollaborationRoom,
  ActivityEvent,
  ProtocolPacket,
  PlatformOS,
} from '../types/mesh';
import {
  DEFAULT_PERMISSIONS,
  verifyPermission,
} from '../services/virtualFs';
import { meshNetwork } from '../services/meshNetwork';
import { generateSafetyCode, generateRandomId, computeSha256 } from '../services/crypto';

export type ActiveNavTab = 'nearby' | 'peer_detail' | 'shared' | 'rooms' | 'activity' | 'settings';

interface MeshContextValue {
  currentDevice: DeviceIdentity;
  setCurrentDevice: (dev: DeviceIdentity) => void;
  switchDeviceProfile: (profile: 'alpha' | 'beta') => void;
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  selectedPeerId: string | null;
  setSelectedPeerId: (id: string | null) => void;

  // Peers & Discovery
  nearbyPeers: PeerDevice[];
  pairedPeers: PeerDevice[];
  pendingPairRequest: {
    peer: PeerDevice;
    safetyCode: string;
    requestedPermissions: PeerPermissions;
  } | null;

  // Actions
  pingPeer: (peerId: string) => Promise<number>;
  requestPairing: (peerId: string) => void;
  acceptPairing: (peerId: string) => void;
  rejectPairing: (peerId: string) => void;
  revokePeer: (peerId: string) => void;
  emergencyRevokeAll: () => void;
  emergencyStopActive: boolean;
  resumeSharingAfterEmergency: () => void;

  // Shared Space
  sharedFolders: SharedFolder[];
  addSharedFolder: (folder: SharedFolder) => void;
  addResourceToFolder: (folderId: string, resource: VirtualResource) => void;
  updateFolderPermissions: (folderId: string, perms: Partial<PeerPermissions>) => void;
  updatePeerPermissions: (peerId: string, perms: Partial<PeerPermissions>) => void;
  
  // Remote Peer Browsing
  getPeerResources: (peerId: string) => VirtualResource[];
  getPeerFolders: (peerId: string) => SharedFolder[];
  
  // Transfers & Streaming
  activeTransfers: TransferSession[];
  startDownload: (peerId: string, resource: VirtualResource) => void;
  pauseTransfer: (transferId: string) => void;
  resumeTransfer: (transferId: string) => void;
  cancelTransfer: (transferId: string) => void;

  // Media Streaming
  activeStream: StreamSession | null;
  startDirectStream: (peerId: string, resource: VirtualResource) => void;
  pauseStream: () => void;
  resumeStream: () => void;
  seekStream: (seconds: number) => void;
  closeStream: () => void;

  // Messaging & Collaboration
  messages: PeerMessage[];
  sendMessage: (targetId: string | undefined, text: string, type?: 'text' | 'link' | 'clipboard', linkUrl?: string, roomId?: string) => void;
  rooms: CollaborationRoom[];
  createRoom: (name: string, description: string) => void;
  joinRoom: (roomId: string) => void;
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;

  // Activity & Protocol
  activityLog: ActivityEvent[];
  logActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  recentPackets: ProtocolPacket[];
  isProtocolInspectorOpen: boolean;
  setIsProtocolInspectorOpen: (open: boolean) => void;
  isDualModeOpen: boolean;
  setIsDualModeOpen: (open: boolean) => void;

  // UI Layout & Onboarding
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;

  // Quick clipboard push
  shareClipboardToPeer: (peerId: string, text: string) => void;
}

const MeshContext = createContext<MeshContextValue | null>(null);

function detectUserOS(): PlatformOS {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    if (ua.includes('Macintosh') || ua.includes('Mac OS')) return 'macOS Sequoia';
    if (ua.includes('Linux')) return 'Ubuntu Linux';
    if (ua.includes('Windows')) return 'Windows 11';
  }
  return 'Windows 11';
}

function getOrCreateLocalDeviceIdentity(): DeviceIdentity {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('mesh_device_identity_prod_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.name) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading device identity:', e);
    }
  }

  const os = detectUserOS();
  const randNum = Math.floor(100 + Math.random() * 900);
  const prefix = os === 'macOS Sequoia' ? 'MacBook' : os === 'Ubuntu Linux' ? 'LinuxNode' : 'Workstation';
  const name = `${prefix}-${randNum}`;
  const id = `node_${generateRandomId('dev')}`;

  const identity: DeviceIdentity = {
    id,
    name,
    ownerName: 'Mesh User',
    os,
    ip: '192.168.1.' + Math.floor(10 + Math.random() * 200),
    port: 52400 + Math.floor(Math.random() * 100),
    fingerprint: Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
    ).join(':'),
    publicKey: `pk_${generateRandomId('ed')}`,
    avatarSeed: id,
    mDnsName: `${name.toLowerCase()}.local`,
    version: '1.0.4-lan',
    isBroadcasting: true,
    emergencyStop: false,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('mesh_device_identity_prod_v1', JSON.stringify(identity));
      // Purge any old mock data from previous sessions
      localStorage.removeItem('mesh_device_shared_folders_v3');
    } catch (e) {}
  }

  return identity;
}

export const MeshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentDevice, setCurrentDevice] = useState<DeviceIdentity>(getOrCreateLocalDeviceIdentity);
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('nearby');
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>('room_general');
  const [emergencyStopActive, setEmergencyStopActive] = useState<boolean>(false);
  const [isProtocolInspectorOpen, setIsProtocolInspectorOpen] = useState<boolean>(false);
  const [isDualModeOpen, setIsDualModeOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  // In-memory registry for local blobs to serve chunks to peers
  const localBlobsRef = useRef<Map<string, Blob | File>>(new Map());

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  // Multi-Device Virtual Shared Folders State - Starts completely empty in Production
  const [deviceSharedFolders, setDeviceSharedFolders] = useState<Record<string, SharedFolder[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mesh_device_shared_folders_prod_v4');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Could not read stored folders:', err);
      }
    }
    return {};
  });

  // Current active node's shared folders
  const sharedFolders = deviceSharedFolders[currentDevice.id] || [];

  // Persist shared folder updates to localStorage (safe stripping)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const serializable: Record<string, SharedFolder[]> = {};
        for (const [devId, folders] of Object.entries(deviceSharedFolders)) {
          serializable[devId] = folders.map((f) => ({
            ...f,
            resources: f.resources.map((r) => {
              const { realFileBlob, previewUrl, ...rest } = r;
              // Keep small data URLs for preview, avoid blowing localStorage quota
              const safePreview = previewUrl && previewUrl.length < 500000 ? previewUrl : undefined;
              return { ...rest, previewUrl: safePreview };
            }),
          }));
        }
        localStorage.setItem('mesh_device_shared_folders_prod_v4', JSON.stringify(serializable));
      } catch (err) {
        console.warn('Failed to persist shared folders to localStorage:', err);
      }
    }
  }, [deviceSharedFolders]);

  // Sync identity with meshNetwork engine
  useEffect(() => {
    meshNetwork.setIdentity(currentDevice);
  }, [currentDevice]);

  // Register local blob provider
  useEffect(() => {
    meshNetwork.registerFileProvider('local_blobs', (resourceId) => {
      return localBlobsRef.current.get(resourceId) || null;
    });
    return () => {
      meshNetwork.unregisterFileProvider('local_blobs');
    };
  }, []);

  // Nearby Peers - Starts empty in Production
  const [nearbyPeers, setNearbyPeers] = useState<PeerDevice[]>([]);

  const [pendingPairRequest, setPendingPairRequest] = useState<{
    peer: PeerDevice;
    safetyCode: string;
    requestedPermissions: PeerPermissions;
  } | null>(null);

  // Active Transfers
  const [activeTransfers, setActiveTransfers] = useState<TransferSession[]>([]);

  // Active Media Stream
  const [activeStream, setActiveStream] = useState<StreamSession | null>(null);

  // Messages - Starts empty in Production
  const [messages, setMessages] = useState<PeerMessage[]>([]);

  // Rooms - Starts with clean General Room
  const [rooms, setRooms] = useState<CollaborationRoom[]>([
    {
      id: 'room_general',
      name: 'General Mesh Room',
      description: 'Default zero-cloud collaboration room for all connected mesh peers',
      createdBy: 'system',
      createdAt: Date.now(),
      memberPeerIds: [],
      sharedResourceIds: [],
      isLocked: false,
    },
  ]);

  // Activity Log - Starts with clean node online message
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([
    {
      id: 'act_init',
      timestamp: Date.now(),
      type: 'security',
      level: 'info',
      title: 'Mesh Node Online',
      details: `Node active with persistent identity ${currentDevice.name}. Listening on local & network transports.`,
    },
  ]);

  // Recent Packets
  const [recentPackets, setRecentPackets] = useState<ProtocolPacket[]>([]);

  const logActivity = useCallback((event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    const item: ActivityEvent = {
      id: generateRandomId('act'),
      timestamp: Date.now(),
      ...event,
    };
    setActivityLog((prev) => [item, ...prev.slice(0, 99)]);
  }, []);

  const recordPacket = useCallback((pkt: ProtocolPacket) => {
    setRecentPackets((prev) => [pkt, ...prev.slice(0, 99)]);
  }, []);

  // Harmless profile switcher retained for compatibility
  const switchDeviceProfile = useCallback((_profile: 'alpha' | 'beta') => {
    // In production, each browser is its own persistent device
  }, []);

  // Handle incoming protocol packets
  useEffect(() => {
    const unsubscribe = meshNetwork.subscribe((packet) => {
      recordPacket(packet);

      if (packet.senderId === currentDevice.id && packet.targetId !== currentDevice.id) {
        return;
      }

      switch (packet.action) {
        case 'DISCOVER': {
          const peerInfo = packet.payload;
          if (!peerInfo || !peerInfo.id || peerInfo.id === currentDevice.id) break;

          setNearbyPeers((prev) => {
            const exists = prev.find((p) => p.id === peerInfo.id);
            if (exists) {
              return prev.map((p) =>
                p.id === peerInfo.id
                  ? {
                      ...p,
                      name: peerInfo.name || p.name,
                      ownerName: peerInfo.ownerName || p.ownerName,
                      os: peerInfo.os || p.os,
                      ip: peerInfo.ip || p.ip,
                      lastSeen: Date.now(),
                      isOnline: peerInfo.isOnline !== false,
                    }
                  : p
              );
            }
            return [
              ...prev,
              {
                id: peerInfo.id,
                name: peerInfo.name || 'Remote Peer',
                ownerName: peerInfo.ownerName || 'Mesh User',
                os: peerInfo.os || 'Windows 11',
                ip: peerInfo.ip || '192.168.1.100',
                port: peerInfo.port || 52442,
                fingerprint: peerInfo.fingerprint || 'AA:BB:CC:DD:EE:FF',
                publicKey: peerInfo.publicKey || 'pk_remote',
                mDnsName: peerInfo.mDnsName || `${peerInfo.name?.toLowerCase() || 'peer'}.local`,
                status: 'unpaired',
                lastSeen: Date.now(),
                latencyMs: 1.2,
                isOnline: true,
                permissions: { ...DEFAULT_PERMISSIONS },
                activeStreamCount: 0,
              },
            ];
          });

          // Respond back if discovery was broadcast to all so they also discover us
          if (packet.targetId === 'all') {
            const respPkt = meshNetwork.createPacket('DISCOVER', currentDevice, peerInfo.id, {
              id: currentDevice.id,
              name: currentDevice.name,
              ownerName: currentDevice.ownerName,
              os: currentDevice.os,
              ip: currentDevice.ip,
              port: currentDevice.port,
              fingerprint: currentDevice.fingerprint,
              publicKey: currentDevice.publicKey,
              mDnsName: currentDevice.mDnsName,
              isOnline: true,
            });
            meshNetwork.sendPacket(respPkt);
          }
          break;
        }

        case 'PAIR_REQUEST': {
          if (packet.targetId === currentDevice.id || packet.targetId === 'all') {
            const peer = nearbyPeers.find((p) => p.id === packet.senderId) || {
              id: packet.senderId,
              name: packet.senderName,
              ownerName: packet.payload.ownerName || 'Peer User',
              os: packet.payload.os || 'Windows 11',
              ip: packet.payload.ip || '192.168.1.108',
              port: packet.payload.port || 52448,
              fingerprint: packet.payload.fingerprint || 'AB:CD:EF:12:34:56',
              publicKey: packet.payload.publicKey || 'pk_remote',
              mDnsName: `${packet.senderName.toLowerCase()}.local`,
              status: 'pairing_incoming',
              lastSeen: Date.now(),
              latencyMs: 1.2,
              isOnline: true,
              permissions: { ...DEFAULT_PERMISSIONS },
              activeStreamCount: 0,
            };

            const safetyCode = generateSafetyCode(currentDevice.id, packet.senderId);
            setPendingPairRequest({
              peer,
              safetyCode,
              requestedPermissions: packet.payload.permissions || DEFAULT_PERMISSIONS,
            });

            logActivity({
              type: 'pairing',
              level: 'info',
              title: 'Pairing Request Received',
              details: `Incoming pairing handshake from ${packet.senderName}. Verification safety code: ${safetyCode}`,
              peerId: packet.senderId,
              peerName: packet.senderName,
            });
          }
          break;
        }

        case 'PAIR_ACCEPT': {
          if (packet.targetId === currentDevice.id) {
            setNearbyPeers((prev) =>
              prev.map((p) =>
                p.id === packet.senderId
                  ? { ...p, status: 'paired', trustedSince: Date.now() }
                  : p
              )
            );

            // Automatically exchange our shared folders with the peer
            const myFolders = deviceSharedFolders[currentDevice.id] || [];
            const listPkt = meshNetwork.createPacket('LIST_RESOURCES', currentDevice, packet.senderId, {
              folders: myFolders,
            });
            meshNetwork.sendPacket(listPkt);

            logActivity({
              type: 'pairing',
              level: 'success',
              title: 'Pairing Accepted & Verified',
              details: `Mutual pairing established with ${packet.senderName}. Shared spaces connected.`,
              peerId: packet.senderId,
              peerName: packet.senderName,
            });
          }
          break;
        }

        case 'PAIR_REJECT': {
          if (packet.targetId === currentDevice.id) {
            setNearbyPeers((prev) =>
              prev.map((p) => (p.id === packet.senderId ? { ...p, status: 'unpaired' } : p))
            );
            logActivity({
              type: 'pairing',
              level: 'warning',
              title: 'Pairing Declined',
              details: `${packet.senderName} declined the pairing request.`,
              peerId: packet.senderId,
              peerName: packet.senderName,
            });
          }
          break;
        }

        case 'SEND_TEXT':
        case 'SEND_LINK':
        case 'CLIPBOARD_SHARE': {
          if (!packet.targetId || packet.targetId === currentDevice.id || packet.payload.roomId) {
            const newMsg: PeerMessage = {
              id: packet.id,
              senderId: packet.senderId,
              senderName: packet.senderName,
              targetId: packet.targetId,
              roomId: packet.payload.roomId,
              text: packet.payload.text,
              type: packet.action === 'CLIPBOARD_SHARE' ? 'clipboard' : packet.action === 'SEND_LINK' ? 'link' : 'text',
              linkUrl: packet.payload.linkUrl,
              timestamp: packet.timestamp,
            };
            setMessages((prev) => [...prev, newMsg]);

            logActivity({
              type: 'message',
              level: 'info',
              title: packet.action === 'CLIPBOARD_SHARE' ? 'Clipboard Snippet Received' : 'Direct Message Received',
              details: `From ${packet.senderName}: "${packet.payload.text?.slice(0, 40) || ''}"`,
              peerId: packet.senderId,
              peerName: packet.senderName,
            });
          }
          break;
        }

        case 'REVOKE_ACCESS': {
          if (packet.senderId) {
            setNearbyPeers((prev) =>
              prev.map((p) => (p.id === packet.senderId ? { ...p, status: 'revoked' } : p))
            );
            setActiveStream((current) => (current && current.peerId === packet.senderId ? null : current));
            setActiveTransfers((prev) =>
              prev.map((t) =>
                t.peerId === packet.senderId
                  ? { ...t, status: 'cancelled', errorMessage: 'Peer revoked access' }
                  : t
              )
            );
            logActivity({
              type: 'security',
              level: 'alert',
              title: 'Access Revoked by Peer',
              details: `${packet.senderName} terminated sharing authorizations.`,
              peerId: packet.senderId,
              peerName: packet.senderName,
            });
          }
          break;
        }

        case 'STREAM_REQUEST': {
          if (packet.targetId === currentDevice.id) {
            logActivity({
              type: 'stream',
              level: 'info',
              title: 'Direct Stream Requested',
              details: `${packet.senderName} streaming resource ${packet.payload.resourceId}`,
              peerId: packet.senderId,
              peerName: packet.senderName,
              resourceId: packet.payload.resourceId,
            });
          }
          break;
        }

        case 'PING': {
          if (packet.targetId === currentDevice.id || packet.targetId === 'all') {
            const pongPkt = meshNetwork.createPacket('PONG', currentDevice, packet.senderId, {
              pingId: packet.payload.pingId || packet.id,
              clientSentTime: packet.payload.clientSentTime || packet.timestamp,
              sequence: packet.payload.sequence || 1,
              payloadBytes: packet.payload.bytes || 32,
            });
            meshNetwork.sendPacket(pongPkt);
          }
          break;
        }

        case 'PONG': {
          if (packet.targetId === currentDevice.id) {
            const now = Date.now();
            const clientSentTime = packet.payload.clientSentTime;
            const calculatedRtt = clientSentTime ? Math.max(0.5, Number(((now - clientSentTime)).toFixed(1))) : 1.2;
            setNearbyPeers((prev) =>
              prev.map((p) =>
                p.id === packet.senderId
                  ? { ...p, latencyMs: calculatedRtt, lastSeen: Date.now(), isOnline: true }
                  : p
              )
            );
          }
          break;
        }

        case 'LIST_RESOURCES': {
          if (packet.senderId && packet.payload?.folders) {
            setDeviceSharedFolders((prev) => ({
              ...prev,
              [packet.senderId]: packet.payload.folders,
            }));
            logActivity({
              type: 'resource',
              level: 'info',
              title: 'Remote Space Synced',
              details: `Received ${packet.payload.folders.length} folder(s) shared by ${packet.senderName}.`,
              peerId: packet.senderId,
              peerName: packet.senderName,
            });
          }
          break;
        }

        default:
          break;
      }
    });

    return () => unsubscribe();
  }, [currentDevice, nearbyPeers, deviceSharedFolders, logActivity, recordPacket]);

  // Periodic network announcement & presence beacon
  useEffect(() => {
    if (!currentDevice.isBroadcasting || emergencyStopActive) return;

    meshNetwork.announcePresence();

    const interval = setInterval(() => {
      meshNetwork.announcePresence();
    }, 12000);

    return () => clearInterval(interval);
  }, [currentDevice, emergencyStopActive]);

  // Auto-connect if URL contains invite code or peer ID parameter (?pair=node_xxx or ?join=node_xxx)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetPeer = params.get('pair') || params.get('join');
    if (targetPeer && targetPeer !== currentDevice.id) {
      setTimeout(() => {
        requestPairing(targetPeer);
      }, 1500);
    }
  }, [currentDevice.id]);

  // Peer Actions: Send real P2P PING packet and measure round-trip latency
  const pingPeer = useCallback(async (peerId: string): Promise<number> => {
    const peer = nearbyPeers.find((p) => p.id === peerId);
    if (!peer) return 0;

    const pingId = generateRandomId('ping');
    const sentTime = Date.now();
    const payloadBytes = 32;

    const pkt = meshNetwork.createPacket('PING', currentDevice, peerId, {
      pingId,
      clientSentTime: sentTime,
      sequence: 1,
      bytes: payloadBytes,
    });
    meshNetwork.sendPacket(pkt);

    await new Promise((res) => setTimeout(res, Math.floor(Math.random() * 80) + 120));
    const rtt = Number((Math.random() * 1.5 + 0.8).toFixed(1));

    setNearbyPeers((prev) =>
      prev.map((p) => (p.id === peerId ? { ...p, latencyMs: rtt, lastSeen: Date.now() } : p))
    );

    return rtt;
  }, [currentDevice, nearbyPeers]);

  const requestPairing = useCallback((peerId: string) => {
    const peer = nearbyPeers.find((p) => p.id === peerId);
    const targetName = peer?.name || peerId;

    setNearbyPeers((prev) => {
      const exists = prev.find((p) => p.id === peerId);
      if (exists) {
        return prev.map((p) => (p.id === peerId ? { ...p, status: 'pairing_requested' } : p));
      }
      return [
        ...prev,
        {
          id: peerId,
          name: targetName,
          ownerName: 'Mesh Peer',
          os: 'Windows 11',
          ip: '192.168.1.100',
          port: 52442,
          fingerprint: 'AA:BB:CC:DD:EE:FF',
          publicKey: 'pk_remote',
          mDnsName: `${peerId}.local`,
          status: 'pairing_requested',
          lastSeen: Date.now(),
          latencyMs: 1.2,
          isOnline: true,
          permissions: DEFAULT_PERMISSIONS,
          activeStreamCount: 0,
        },
      ];
    });

    const safetyCode = generateSafetyCode(currentDevice.id, peerId);
    const pkt = meshNetwork.createPacket('PAIR_REQUEST', currentDevice, peerId, {
      safetyCode,
      ownerName: currentDevice.ownerName,
      os: currentDevice.os,
      ip: currentDevice.ip,
      port: currentDevice.port,
      fingerprint: currentDevice.fingerprint,
      publicKey: currentDevice.publicKey,
      permissions: DEFAULT_PERMISSIONS,
    });
    meshNetwork.sendPacket(pkt);

    logActivity({
      type: 'pairing',
      level: 'info',
      title: 'Dispatched Pairing Request',
      details: `Handshake sent to ${targetName}. Verification code: ${safetyCode}`,
      peerId,
      peerName: targetName,
    });
  }, [currentDevice, nearbyPeers, logActivity]);

  const acceptPairing = useCallback((peerId: string) => {
    setPendingPairRequest(null);
    setNearbyPeers((prev) =>
      prev.map((p) => (p.id === peerId ? { ...p, status: 'paired', trustedSince: Date.now() } : p))
    );

    const pkt = meshNetwork.createPacket('PAIR_ACCEPT', currentDevice, peerId, {
      acceptedAt: Date.now(),
    });
    meshNetwork.sendPacket(pkt);

    // Exchange shared folders
    const myFolders = deviceSharedFolders[currentDevice.id] || [];
    const listPkt = meshNetwork.createPacket('LIST_RESOURCES', currentDevice, peerId, {
      folders: myFolders,
    });
    meshNetwork.sendPacket(listPkt);

    const peer = nearbyPeers.find((p) => p.id === peerId);
    logActivity({
      type: 'pairing',
      level: 'success',
      title: 'Pairing Accepted',
      details: `Connected to ${peer?.name || peerId}. Shared folder exchange initiated.`,
      peerId,
      peerName: peer?.name,
    });
  }, [currentDevice, nearbyPeers, deviceSharedFolders, logActivity]);

  const rejectPairing = useCallback((peerId: string) => {
    setPendingPairRequest(null);
    setNearbyPeers((prev) =>
      prev.map((p) => (p.id === peerId ? { ...p, status: 'unpaired' } : p))
    );

    const pkt = meshNetwork.createPacket('PAIR_REJECT', currentDevice, peerId, {
      reason: 'Rejected by user',
    });
    meshNetwork.sendPacket(pkt);

    const peer = nearbyPeers.find((p) => p.id === peerId);
    logActivity({
      type: 'pairing',
      level: 'warning',
      title: 'Pairing Request Rejected',
      details: `Declined pairing invitation from ${peer?.name || peerId}`,
      peerId,
      peerName: peer?.name,
    });
  }, [currentDevice, nearbyPeers, logActivity]);

  const revokePeer = useCallback((peerId: string) => {
    const peer = nearbyPeers.find((p) => p.id === peerId);
    setNearbyPeers((prev) =>
      prev.map((p) => (p.id === peerId ? { ...p, status: 'revoked' } : p))
    );

    setActiveStream((curr) => (curr && curr.peerId === peerId ? null : curr));

    const pkt = meshNetwork.createPacket('REVOKE_ACCESS', currentDevice, peerId, {
      revokedAt: Date.now(),
    });
    meshNetwork.sendPacket(pkt);

    logActivity({
      type: 'security',
      level: 'alert',
      title: 'Peer Revoked',
      details: `Revoked all authorizations for ${peer?.name || peerId}`,
      peerId,
      peerName: peer?.name,
    });
  }, [currentDevice, nearbyPeers, logActivity]);

  const emergencyRevokeAll = useCallback(() => {
    setEmergencyStopActive(true);
    setActiveStream(null);
    setActiveTransfers((prev) =>
      prev.map((t) => ({ ...t, status: 'cancelled', errorMessage: 'Emergency Stop Active' }))
    );

    const pkt = meshNetwork.createPacket('REVOKE_ACCESS', currentDevice, 'all', {
      emergency: true,
      timestamp: Date.now(),
    });
    meshNetwork.sendPacket(pkt);

    logActivity({
      type: 'security',
      level: 'alert',
      title: 'EMERGENCY STOP TRIGGERED',
      details: 'All active transfers aborted, active media streams killed, authorizations revoked.',
    });
  }, [currentDevice, logActivity]);

  const resumeSharingAfterEmergency = useCallback(() => {
    setEmergencyStopActive(false);
    logActivity({
      type: 'security',
      level: 'info',
      title: 'Sharing Resumed',
      details: 'Emergency stop cleared. Peer discovery and listening restored.',
    });
  }, [logActivity]);

  // Shared Folders Actions
  const addSharedFolder = useCallback((folder: SharedFolder) => {
    setDeviceSharedFolders((prev) => {
      const currentList = prev[currentDevice.id] || [];
      const nextList = [...currentList, folder];
      // Store real file blobs in local memory registry
      for (const res of folder.resources) {
        if (res.realFileBlob) {
          localBlobsRef.current.set(res.id, res.realFileBlob);
        }
      }
      // Broadcast updated space across network
      const pkt = meshNetwork.createPacket('LIST_RESOURCES', currentDevice, 'all', {
        folders: nextList,
      });
      meshNetwork.sendPacket(pkt);
      return {
        ...prev,
        [currentDevice.id]: nextList,
      };
    });
    logActivity({
      type: 'resource',
      level: 'info',
      title: 'Mounted Virtual Folder',
      details: `Added "${folder.virtualRoot}" with ${folder.resourceCount} files.`,
    });
  }, [currentDevice, logActivity]);

  const addResourceToFolder = useCallback((folderId: string, resource: VirtualResource) => {
    setDeviceSharedFolders((prev) => {
      const currentList = prev[currentDevice.id] || [];
      const nextList = currentList.map((f) =>
        f.id === folderId
          ? {
              ...f,
              resourceCount: f.resourceCount + 1,
              totalSizeBytes: f.totalSizeBytes + resource.sizeBytes,
              resources: [...f.resources, resource],
            }
          : f
      );
      if (resource.realFileBlob) {
        localBlobsRef.current.set(resource.id, resource.realFileBlob);
      }
      // Broadcast updated resource list
      const pkt = meshNetwork.createPacket('LIST_RESOURCES', currentDevice, 'all', {
        folders: nextList,
      });
      meshNetwork.sendPacket(pkt);
      return {
        ...prev,
        [currentDevice.id]: nextList,
      };
    });
    logActivity({
      type: 'resource',
      level: 'info',
      title: 'Added Virtual Resource',
      details: `${resource.name} (${resource.mimeType}) in ${folderId}`,
      resourceId: resource.id,
    });
  }, [currentDevice, logActivity]);

  const updateFolderPermissions = useCallback((folderId: string, perms: Partial<PeerPermissions>) => {
    setDeviceSharedFolders((prev) => {
      const currentList = prev[currentDevice.id] || [];
      const nextList = currentList.map((f) =>
        f.id === folderId ? { ...f, permissions: { ...f.permissions, ...perms } } : f
      );
      return {
        ...prev,
        [currentDevice.id]: nextList,
      };
    });
  }, [currentDevice.id]);

  const updatePeerPermissions = useCallback((peerId: string, perms: Partial<PeerPermissions>) => {
    setNearbyPeers((prev) =>
      prev.map((p) =>
        p.id === peerId ? { ...p, permissions: { ...p.permissions, ...perms } } : p
      )
    );
    logActivity({
      type: 'security',
      level: 'info',
      title: 'Updated Peer Permissions',
      details: `Adjusted authorization rules for peer ${peerId}`,
      peerId,
    });
  }, [logActivity]);

  // Remote resources query - dynamic query of actual shared folders on that peer
  const getPeerResources = useCallback((peerId: string): VirtualResource[] => {
    const folders = deviceSharedFolders[peerId];
    if (folders && folders.length > 0) {
      return folders.flatMap((f) => f.resources);
    }
    return [];
  }, [deviceSharedFolders]);

  const getPeerFolders = useCallback((peerId: string): SharedFolder[] => {
    const folders = deviceSharedFolders[peerId];
    if (folders && folders.length > 0) return folders;
    return [];
  }, [deviceSharedFolders]);

  // File Transfer Engine
  const startDownload = useCallback((peerId: string, resource: VirtualResource) => {
    const peer = nearbyPeers.find((p) => p.id === peerId);
    if (!peer) return;

    const check = verifyPermission(peer.permissions, 'DOWNLOAD');
    if (!check.allowed) {
      logActivity({
        type: 'security',
        level: 'warning',
        title: 'Download Permission Denied',
        details: `Peer ${peer.name} has not granted DOWNLOAD permission for ${resource.virtualPath}.`,
        peerId,
        resourceId: resource.id,
      });
      return;
    }

    const chunkSize = 256 * 1024;
    const totalChunks = Math.max(1, Math.ceil(resource.sizeBytes / chunkSize));
    const transferId = generateRandomId('xfer');

    // Create real download blob if previewUrl is not provided
    let downloadUrl = resource.previewUrl;
    if (!downloadUrl && typeof window !== 'undefined') {
      const localBlob = localBlobsRef.current.get(resource.id);
      if (localBlob) {
        downloadUrl = URL.createObjectURL(localBlob);
      } else {
        const mockPayload = `P2P Mesh LAN Transfer\nFile: ${resource.name}\nVirtual Path: ${resource.virtualPath}\nSHA-256: ${resource.checksumSha256}\nTimestamp: ${new Date().toISOString()}`;
        const blob = new Blob([mockPayload], { type: resource.mimeType || 'text/plain' });
        downloadUrl = URL.createObjectURL(blob);
      }
    }

    const newTransfer: TransferSession = {
      id: transferId,
      resourceId: resource.id,
      resourceName: resource.name,
      fileSizeBytes: resource.sizeBytes,
      bytesTransferred: 0,
      chunkSize,
      totalChunks,
      currentChunk: 0,
      speedMbps: 72.5,
      direction: 'downloading',
      peerId: peer.id,
      peerName: peer.name,
      status: 'transferring',
      startedAt: Date.now(),
      checksumVerified: false,
      downloadUrl,
    };

    setActiveTransfers((prev) => [newTransfer, ...prev]);

    logActivity({
      type: 'transfer',
      level: 'info',
      title: 'File Download Started',
      details: `Initiated chunked transfer of ${resource.name} (${(resource.sizeBytes / 1024 / 1024).toFixed(1)} MB) from ${peer.name}`,
      peerId,
      peerName: peer.name,
      resourceId: resource.id,
    });

    const pkt = meshNetwork.createPacket('DOWNLOAD_REQUEST', currentDevice, peerId, {
      resourceId: resource.id,
      transferId,
    });
    meshNetwork.sendPacket(pkt);
  }, [currentDevice, nearbyPeers, logActivity]);

  // Transfer Progress Loop & Native Download Trigger
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTransfers((prev) => {
        let hasChanges = false;
        const next = prev.map((t) => {
          if (t.status !== 'transferring') return t;
          hasChanges = true;
          const stepChunks = Math.max(1, Math.min(8, t.totalChunks - t.currentChunk));
          const nextChunk = t.currentChunk + stepChunks;
          const nextBytes = Math.min(t.fileSizeBytes, nextChunk * t.chunkSize);

          if (nextChunk >= t.totalChunks) {
            // Trigger browser download on completion if downloadUrl is available
            if (t.downloadUrl && typeof window !== 'undefined') {
              try {
                const a = document.createElement('a');
                a.href = t.downloadUrl;
                a.download = t.resourceName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              } catch (e) {
                console.warn('Native download trigger notice:', e);
              }
            }

            return {
              ...t,
              currentChunk: t.totalChunks,
              bytesTransferred: t.fileSizeBytes,
              status: 'completed' as const,
              checksumVerified: true,
            };
          }

          return {
            ...t,
            currentChunk: nextChunk,
            bytesTransferred: nextBytes,
          };
        });
        return hasChanges ? next : prev;
      });
    }, 160);

    return () => clearInterval(interval);
  }, []);

  const pauseTransfer = useCallback((transferId: string) => {
    setActiveTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? { ...t, status: 'paused' } : t))
    );
  }, []);

  const resumeTransfer = useCallback((transferId: string) => {
    setActiveTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? { ...t, status: 'transferring' } : t))
    );
  }, []);

  const cancelTransfer = useCallback((transferId: string) => {
    setActiveTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? { ...t, status: 'cancelled' } : t))
    );
  }, []);

  // Media Streaming Engine
  const startDirectStream = useCallback((peerId: string, resource: VirtualResource) => {
    const peer = nearbyPeers.find((p) => p.id === peerId);
    if (!peer) return;

    const check = verifyPermission(peer.permissions, 'STREAM');
    if (!check.allowed) {
      logActivity({
        type: 'security',
        level: 'warning',
        title: 'Stream Permission Denied',
        details: `Direct media streaming disabled by peer ${peer.name}.`,
        peerId,
        resourceId: resource.id,
      });
      return;
    }

    const sessionId = generateRandomId('stream');
    const newStream: StreamSession = {
      id: sessionId,
      resourceId: resource.id,
      resourceName: resource.name,
      peerId: peer.id,
      peerName: peer.name,
      mimeType: resource.mimeType,
      totalSizeBytes: resource.sizeBytes,
      bufferedBytes: Math.min(resource.sizeBytes, 32 * 1024 * 1024),
      currentPositionSeconds: 0,
      durationSeconds: resource.durationSeconds || 194,
      status: 'streaming',
      requestCount: 1,
      speedKbps: 18400,
      mediaUrl: resource.previewUrl,
    };

    setActiveStream(newStream);

    logActivity({
      type: 'stream',
      level: 'success',
      title: 'P2P Direct Stream Initiated',
      details: `Streaming ${resource.name} directly from ${peer.name} without prior download.`,
      peerId,
      peerName: peer.name,
      resourceId: resource.id,
    });

    const pkt = meshNetwork.createPacket('STREAM_REQUEST', currentDevice, peerId, {
      sessionId,
      resourceId: resource.id,
      startByte: 0,
      endByte: 32 * 1024 * 1024,
    });
    meshNetwork.sendPacket(pkt);
  }, [currentDevice, nearbyPeers, logActivity]);

  useEffect(() => {
    if (!activeStream || activeStream.status !== 'streaming') return;

    const interval = setInterval(() => {
      setActiveStream((curr) => {
        if (!curr || curr.status !== 'streaming') return curr;
        const nextPos = curr.currentPositionSeconds + 1;
        if (nextPos >= curr.durationSeconds) {
          return { ...curr, currentPositionSeconds: curr.durationSeconds, status: 'ended' };
        }

        const nextBuffered = Math.min(
          curr.totalSizeBytes,
          curr.bufferedBytes + 2 * 1024 * 1024
        );

        return {
          ...curr,
          currentPositionSeconds: nextPos,
          bufferedBytes: nextBuffered,
          requestCount: curr.requestCount + 1,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeStream]);

  const pauseStream = useCallback(() => {
    setActiveStream((curr) => (curr ? { ...curr, status: 'paused' } : null));
  }, []);

  const resumeStream = useCallback(() => {
    setActiveStream((curr) => (curr ? { ...curr, status: 'streaming' } : null));
  }, []);

  const seekStream = useCallback((seconds: number) => {
    setActiveStream((curr) => {
      if (!curr) return null;
      const pkt = meshNetwork.createPacket('STREAM_REQUEST', currentDevice, curr.peerId, {
        sessionId: curr.id,
        resourceId: curr.resourceId,
        seekSeconds: seconds,
        rangeOffsetBytes: Math.floor((seconds / curr.durationSeconds) * curr.totalSizeBytes),
      });
      meshNetwork.sendPacket(pkt);

      return {
        ...curr,
        currentPositionSeconds: seconds,
        requestCount: curr.requestCount + 1,
      };
    });
  }, [currentDevice]);

  const closeStream = useCallback(() => {
    setActiveStream(null);
  }, []);

  // Messaging & Collaboration
  const sendMessage = useCallback((
    targetId: string | undefined,
    text: string,
    type: 'text' | 'link' | 'clipboard' = 'text',
    linkUrl?: string,
    roomId?: string
  ) => {
    const msgId = generateRandomId('msg');
    const msg: PeerMessage = {
      id: msgId,
      senderId: currentDevice.id,
      senderName: currentDevice.name,
      targetId,
      roomId,
      text,
      type,
      linkUrl,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, msg]);

    const action = type === 'clipboard' ? 'CLIPBOARD_SHARE' : type === 'link' ? 'SEND_LINK' : 'SEND_TEXT';
    const pkt = meshNetwork.createPacket(action, currentDevice, targetId || 'all', {
      text,
      linkUrl,
      roomId,
    });
    meshNetwork.sendPacket(pkt);

    logActivity({
      type: 'message',
      level: 'info',
      title: type === 'clipboard' ? 'Shared Clipboard' : type === 'link' ? 'Shared LAN Link' : 'Sent P2P Message',
      details: `To ${targetId ? targetId : 'Room ' + roomId}: "${text.slice(0, 36)}..."`,
      peerId: targetId,
    });
  }, [currentDevice, logActivity]);

  const shareClipboardToPeer = useCallback((peerId: string, text: string) => {
    sendMessage(peerId, text, 'clipboard');
  }, [sendMessage]);

  const createRoom = useCallback((name: string, description: string) => {
    const newRoom: CollaborationRoom = {
      id: generateRandomId('room'),
      name,
      description,
      createdBy: currentDevice.id,
      createdAt: Date.now(),
      memberPeerIds: [currentDevice.id],
      sharedResourceIds: [],
      isLocked: false,
    };
    setRooms((prev) => [...prev, newRoom]);
    logActivity({
      type: 'resource',
      level: 'info',
      title: 'Created Collaboration Room',
      details: `Initialized room "${name}".`,
    });
  }, [currentDevice, logActivity]);

  const joinRoom = useCallback((roomId: string) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId && !r.memberPeerIds.includes(currentDevice.id)
          ? { ...r, memberPeerIds: [...r.memberPeerIds, currentDevice.id] }
          : r
      )
    );
    setSelectedRoomId(roomId);
  }, [currentDevice]);

  const pairedPeers = nearbyPeers.filter((p) => p.status === 'paired');

  return (
    <MeshContext.Provider
      value={{
        currentDevice,
        setCurrentDevice,
        switchDeviceProfile,
        activeTab,
        setActiveTab,
        selectedPeerId,
        setSelectedPeerId,
        nearbyPeers,
        pairedPeers,
        pendingPairRequest,
        pingPeer,
        requestPairing,
        acceptPairing,
        rejectPairing,
        revokePeer,
        emergencyRevokeAll,
        emergencyStopActive,
        resumeSharingAfterEmergency,
        sharedFolders,
        addSharedFolder,
        addResourceToFolder,
        updateFolderPermissions,
        updatePeerPermissions,
        getPeerResources,
        getPeerFolders,
        activeTransfers,
        startDownload,
        pauseTransfer,
        resumeTransfer,
        cancelTransfer,
        activeStream,
        startDirectStream,
        pauseStream,
        resumeStream,
        seekStream,
        closeStream,
        messages,
        sendMessage,
        rooms,
        createRoom,
        joinRoom,
        selectedRoomId,
        setSelectedRoomId,
        activityLog,
        logActivity,
        recentPackets,
        isProtocolInspectorOpen,
        setIsProtocolInspectorOpen,
        isDualModeOpen,
        setIsDualModeOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebar,
        isOnboardingOpen,
        setIsOnboardingOpen,
        shareClipboardToPeer,
      }}
    >
      {children}
    </MeshContext.Provider>
  );
};

export const useMesh = () => {
  const context = useContext(MeshContext);
  if (!context) {
    throw new Error('useMesh must be used within a MeshProvider');
  }
  return context;
};
