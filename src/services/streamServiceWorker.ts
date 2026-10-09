/**
 * Client-Side Service Worker Manager & HTTP 206 Range Request Broker
 * Connects the Service Worker's intercepted fetch requests for /virtual-stream/...
 * directly to the peer WebRTC data channels or local blobs.
 */

import { wakeLock } from './wakeLock';

export interface SwRangeRequestPayload {
  requestId: string;
  peerId: string;
  resourceId: string;
  filename: string;
  start: number;
  end: number | null;
  rangeHeader: string | null;
}

export interface SwRangeResponsePayload {
  buffer: ArrayBuffer;
  totalSize: number;
  mimeType: string;
  start?: number;
  end?: number;
}

type RangeRequestHandler = (req: SwRangeRequestPayload) => Promise<SwRangeResponsePayload | null>;

class StreamServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private channel: BroadcastChannel | null = null;
  private handler: RangeRequestHandler | null = null;
  private isReady = false;
  private wakeLockIdleTimer: any = null;
  private handledRequests = new Set<string>();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('mesh-virtual-stream-channel');
      this.channel.onmessage = this.handleIncomingMessage.bind(this);
    }

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleIncomingMessage(event);
      });
    }
  }

  public async register(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      this.isReady = true;
      return true;
    } catch (err) {
      console.warn('[SW Manager] Service worker registration attempt 1 failed, retrying in 1s...', err);
      try {
        await new Promise((r) => setTimeout(r, 1000));
        this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        this.isReady = true;
        return true;
      } catch (retryErr) {
        console.warn('[SW Manager] Service worker registration retry failed:', retryErr);
        this.isReady = false;
        return false;
      }
    }
  }

  public isAvailable(): boolean {
    return this.isReady || (typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller));
  }

  public setRangeRequestHandler(handler: RangeRequestHandler): void {
    this.handler = handler;
  }

  public getVirtualStreamUrl(peerId: string, resourceId: string, filename: string): string {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'video.mp4';
    return `/virtual-stream/${encodeURIComponent(peerId)}/${encodeURIComponent(resourceId)}/${encodeURIComponent(cleanFilename)}`;
  }

  private async handleIncomingMessage(event: MessageEvent): Promise<void> {
    const data = event.data;
    if (!data || !data.requestId) return;
    const isRequest = data.type === 'RANGE_REQUEST' || data.type === 'READ_CHUNK' || data.action === 'READ_CHUNK';
    if (!isRequest) return;

    if (this.handledRequests.has(data.requestId)) return;
    this.handledRequests.add(data.requestId);
    if (this.handledRequests.size > 200) {
      const oldest = this.handledRequests.values().next().value;
      if (oldest) this.handledRequests.delete(oldest);
    }

    if (!this.handler) {
      this.sendError(data.requestId, 'No client range handler registered');
      return;
    }

    // Keep screen awake while chunks are actively being streamed
    wakeLock.acquire('stream_service');
    if (this.wakeLockIdleTimer) {
      clearTimeout(this.wakeLockIdleTimer);
    }
    this.wakeLockIdleTimer = setTimeout(() => {
      wakeLock.release('stream_service');
    }, 15000);

    try {
      let response = await this.handler(data);
      if (!response) {
        await new Promise((r) => setTimeout(r, 250));
        response = await this.handler(data);
      }
      if (!response) {
        this.sendError(data.requestId, 'Range not found');
        return;
      }

      const msg = {
        type: 'READ_CHUNK_RESPONSE',
        rangeType: 'RANGE_RESPONSE',
        requestId: data.requestId,
        buffer: response.buffer,
        totalSize: response.totalSize,
        mimeType: response.mimeType,
        start: response.start !== undefined ? response.start : data.start,
        end: response.end !== undefined ? response.end : data.start + response.buffer.byteLength - 1,
      };

      if (this.channel) {
        this.channel.postMessage(msg);
        this.channel.postMessage({ ...msg, type: 'RANGE_RESPONSE' });
      }
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
        navigator.serviceWorker.controller.postMessage({ ...msg, type: 'RANGE_RESPONSE' });
      }
    } catch (err: any) {
      this.sendError(data.requestId, err?.message || 'Range handler failed');
    }
  }

  private sendError(requestId: string, error: string): void {
    const msg = {
      type: 'READ_CHUNK_ERROR',
      rangeType: 'RANGE_ERROR',
      requestId,
      error,
    };
    if (this.channel) {
      this.channel.postMessage(msg);
      this.channel.postMessage({ ...msg, type: 'RANGE_ERROR' });
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage(msg);
      navigator.serviceWorker.controller.postMessage({ ...msg, type: 'RANGE_ERROR' });
    }
  }

  public async acquireWakeLock(reason = 'streaming'): Promise<boolean> {
    return wakeLock.acquire(reason);
  }

  public releaseWakeLock(reason = 'streaming'): void {
    wakeLock.release(reason);
  }

  public isWakeLockActive(): boolean {
    return wakeLock.isLocked();
  }
}

export const streamServiceWorker = new StreamServiceWorkerManager();
