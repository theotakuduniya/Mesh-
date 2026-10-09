/**
 * Client-Side Service Worker Manager & HTTP 206 Range Request Broker
 * Connects the Service Worker's intercepted fetch requests for /virtual-stream/...
 * directly to the peer WebRTC data channels or local blobs.
 */

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
    if (!data || data.type !== 'RANGE_REQUEST' || !data.requestId) return;

    if (!this.handler) {
      this.sendError(data.requestId, 'No client range handler registered');
      return;
    }

    try {
      const response = await this.handler(data);
      if (!response) {
        this.sendError(data.requestId, 'Range not found');
        return;
      }

      const msg = {
        type: 'RANGE_RESPONSE',
        requestId: data.requestId,
        buffer: response.buffer,
        totalSize: response.totalSize,
        mimeType: response.mimeType,
        start: response.start !== undefined ? response.start : data.start,
        end: response.end !== undefined ? response.end : data.start + response.buffer.byteLength - 1,
      };

      if (this.channel) {
        this.channel.postMessage(msg);
      } else if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
      }
    } catch (err: any) {
      this.sendError(data.requestId, err?.message || 'Range handler failed');
    }
  }

  private sendError(requestId: string, error: string): void {
    const msg = {
      type: 'RANGE_ERROR',
      requestId,
      error,
    };
    if (this.channel) {
      this.channel.postMessage(msg);
    } else if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage(msg);
    }
  }
}

export const streamServiceWorker = new StreamServiceWorkerManager();
