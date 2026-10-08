/**
 * Mesh P2P Networking & Transport Engine
 * 
 * Supports:
 * - Real WebSocket relay across different machines/browsers on LAN & Internet
 * - HTTP long-poll fallback for restricted proxies
 * - Multi-tab local BroadcastChannel for same-device communication
 * - Progressive chunked file transfers (256KB slices) with real Blobs
 * - 14 Application-Level Protocol Messages
 * - P2P wire pings with real measured RTT latency
 */

import {
  ProtocolPacket,
  ProtocolAction,
  DeviceIdentity,
  PeerDevice,
  VirtualResource,
} from '../types/mesh';
import { generateRandomId } from './crypto';

type PacketHandler = (packet: ProtocolPacket) => void;
type FileBlobProvider = (resourceId: string) => Promise<Blob | File | null> | Blob | File | null;

class MeshNetworkEngine {
  private broadcastChannel: BroadcastChannel | null = null;
  private localListeners: Set<PacketHandler> = new Set();
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectTimer: any = null;
  private pollInterval: any = null;
  private currentDevice: DeviceIdentity | null = null;
  private fileBlobProviders: Map<string, FileBlobProvider> = new Map();
  private isPollingActive = false;
  private lastPollTimestamp = 0;

  constructor() {
    this.initBroadcastTransport();
    this.initServerTransport();
  }

  public setIdentity(device: DeviceIdentity) {
    this.currentDevice = device;
    // Announce presence once identity is set
    this.announcePresence();
  }

  /**
   * Register a provider to retrieve local files when peers request chunks
   */
  public registerFileProvider(key: string, provider: FileBlobProvider) {
    this.fileBlobProviders.set(key, provider);
  }

  public unregisterFileProvider(key: string) {
    this.fileBlobProviders.delete(key);
  }

  public async getLocalBlob(resourceId: string): Promise<Blob | File | null> {
    for (const provider of this.fileBlobProviders.values()) {
      try {
        const result = await provider(resourceId);
        if (result) return result;
      } catch (e) {
        console.warn(`Error resolving blob for ${resourceId}:`, e);
      }
    }
    return null;
  }

  /**
   * Same-machine multi-tab transport via BroadcastChannel
   */
  private initBroadcastTransport() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('mesh_lan_p2p_channel_prod');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.action) {
            this.notifyListeners(event.data as ProtocolPacket, false);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization failed:', err);
      }
    }
  }

  /**
   * Cross-machine transport via WebSocket with auto-reconnect
   */
  private initServerTransport() {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/mesh/ws`;

    const connect = () => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.wsConnected = true;
          this.stopPolling();
          if (this.currentDevice) {
            this.announcePresence();
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const packet = JSON.parse(event.data);
            if (packet && packet.action) {
              this.notifyListeners(packet as ProtocolPacket, false);
            }
          } catch (e) {
            console.warn('[Mesh WS] Parse error:', e);
          }
        };

        this.ws.onclose = () => {
          this.wsConnected = false;
          this.startPollingFallback();
          // Schedule reconnect
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              connect();
            }, 3000);
          }
        };

        this.ws.onerror = () => {
          this.wsConnected = false;
          this.startPollingFallback();
        };
      } catch (err) {
        console.warn('[Mesh WS] Connection attempt failed, using HTTP polling fallback:', err);
        this.startPollingFallback();
      }
    };

    connect();
  }

  /**
   * HTTP Polling fallback if WebSocket is unavailable
   */
  private startPollingFallback() {
    if (this.isPollingActive || typeof window === 'undefined') return;
    this.isPollingActive = true;

    const poll = async () => {
      if (!this.currentDevice) return;
      try {
        const res = await fetch(`/api/mesh/poll?peerId=${encodeURIComponent(this.currentDevice.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.packets && Array.isArray(data.packets)) {
            for (const pkt of data.packets) {
              this.notifyListeners(pkt, false);
            }
          }
        }
      } catch (e) {
        // Silently continue polling
      }
    };

    this.pollInterval = setInterval(poll, 2500);
    poll();
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPollingActive = false;
  }

  public subscribe(handler: PacketHandler): () => void {
    this.localListeners.add(handler);
    return () => {
      this.localListeners.delete(handler);
    };
  }

  private notifyListeners(packet: ProtocolPacket, isOutboundLocal = false) {
    // If incoming, check if it's our own packet and not meant for self-loop
    if (!isOutboundLocal && this.currentDevice && packet.senderId === this.currentDevice.id && packet.targetId !== this.currentDevice.id) {
      return;
    }

    this.localListeners.forEach((fn) => {
      try {
        fn(packet);
      } catch (e) {
        console.error('Error in packet listener:', e);
      }
    });
  }

  /**
   * Broadcasts / Sends a protocol packet across all transports
   */
  public sendPacket(packet: ProtocolPacket): void {
    // Deliver locally
    this.notifyListeners(packet, true);

    // Deliver via BroadcastChannel (multi-tab)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch (e) {
        console.warn('BroadcastChannel postMessage failed:', e);
      }
    }

    // Deliver via WebSocket (cross-machine)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(packet));
        return;
      } catch (e) {
        console.warn('WS send failed, falling back to HTTP POST:', e);
      }
    }

    // HTTP POST fallback
    if (typeof window !== 'undefined') {
      fetch('/api/mesh/packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet),
      }).catch(() => {});
    }
  }

  public announcePresence(): void {
    if (!this.currentDevice || !this.currentDevice.isBroadcasting) return;

    const pkt = this.createPacket('DISCOVER', this.currentDevice, 'all', {
      id: this.currentDevice.id,
      name: this.currentDevice.name,
      ownerName: this.currentDevice.ownerName,
      os: this.currentDevice.os,
      ip: this.currentDevice.ip,
      port: this.currentDevice.port,
      fingerprint: this.currentDevice.fingerprint,
      publicKey: this.currentDevice.publicKey,
      mDnsName: this.currentDevice.mDnsName,
      isOnline: true,
    });

    this.sendPacket(pkt);
  }

  public createPacket(
    action: ProtocolAction,
    sender: DeviceIdentity,
    targetId: string,
    payload: any
  ): ProtocolPacket {
    return {
      id: generateRandomId('pkt'),
      action,
      senderId: sender.id,
      senderName: sender.name,
      targetId,
      timestamp: Date.now(),
      payload,
    };
  }

  public isNetworkConnected(): boolean {
    return this.wsConnected || this.isPollingActive;
  }
}

export const meshNetwork = new MeshNetworkEngine();
