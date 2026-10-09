/**
 * Service Worker: HTTP 206 Range Proxy for P2P Video & Media Streaming
 * Intercepts /virtual-stream/:peerId/:resourceId/:filename requests from HTML5 <video> / <audio> tags,
 * parses Range headers (e.g. Range: bytes=0-65535 or Range: bytes=1048576-),
 * requests the exact byte slice from the active WebRTC peer connection,
 * and streams back standard HTTP 206 Partial Content responses with Accept-Ranges.
 * 
 * Result:
 * - Instant progressive playback without waiting for whole video download.
 * - Automatic moov atom discovery (even if at end of phone recording!).
 * - Fast seeking on 10GB+ videos with ZERO RAM buildup.
 */

const SW_VERSION = 'v1.1.0';
const VIRTUAL_STREAM_PREFIX = '/virtual-stream/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Setup broadcast communication with main window
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('mesh-virtual-stream-channel')
  : null;

// Map of pending range requests: requestId -> { resolve, reject, timer }
const pendingRequests = new Map();

if (channel) {
  channel.onmessage = (event) => {
    const data = event.data;
    if (!data || !data.requestId) return;

    if (data.type === 'RANGE_RESPONSE') {
      const pending = pendingRequests.get(data.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(data.requestId);
        pending.resolve(data);
      }
    } else if (data.type === 'RANGE_ERROR') {
      const pending = pendingRequests.get(data.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(data.requestId);
        pending.reject(new Error(data.error || 'Range fetch error'));
      }
    }
  };
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith(VIRTUAL_STREAM_PREFIX)) {
    event.respondWith(handleVirtualStreamRangeRequest(event));
  }
});

async function handleVirtualStreamRangeRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  // Pattern: /virtual-stream/:peerId/:resourceId/:filename
  const parts = url.pathname.slice(VIRTUAL_STREAM_PREFIX.length).split('/');
  const peerId = decodeURIComponent(parts[0] || '');
  const resourceId = decodeURIComponent(parts[1] || '');
  const filename = decodeURIComponent(parts.slice(2).join('/') || 'media.mp4');

  const rangeHeader = request.headers.get('range');
  let start = 0;
  let end = null;

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const rangeParts = rangeHeader.replace('bytes=', '').split('-');
    start = parseInt(rangeParts[0], 10) || 0;
    if (rangeParts[1]) {
      end = parseInt(rangeParts[1], 10);
    }
  }

  const requestId = 'req_' + Math.random().toString(36).slice(2) + '_' + Date.now();

  try {
    const responseData = await requestRangeFromClient({
      requestId,
      peerId,
      resourceId,
      filename,
      start,
      end,
      rangeHeader,
    }, event.clientId);

    const chunkBuffer = responseData.buffer;
    const totalSize = responseData.totalSize || chunkBuffer.byteLength;
    const mimeType = responseData.mimeType || 'video/mp4';
    const actualStart = responseData.start !== undefined ? responseData.start : start;
    const actualEnd = responseData.end !== undefined
      ? responseData.end
      : actualStart + chunkBuffer.byteLength - 1;

    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Range', `bytes ${actualStart}-${actualEnd}/${totalSize}`);
    headers.set('Content-Length', String(chunkBuffer.byteLength));
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(chunkBuffer, {
      status: 206,
      statusText: 'Partial Content',
      headers,
    });
  } catch (err) {
    console.warn('[SW Stream Proxy] Range fetch failed:', err);
    return new Response('P2P Range stream unavailable', { status: 503 });
  }
}

function requestRangeFromClient(requestPayload, clientId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestPayload.requestId);
      reject(new Error('P2P Range request timeout after 12s'));
    }, 12000);

    pendingRequests.set(requestPayload.requestId, { resolve, reject, timer });

    // Send via BroadcastChannel
    if (channel) {
      channel.postMessage({
        type: 'RANGE_REQUEST',
        ...requestPayload,
      });
    }

    // Also send via Client.postMessage if available
    if (clientId && self.clients) {
      self.clients.get(clientId).then((client) => {
        if (client) {
          client.postMessage({
            type: 'RANGE_REQUEST',
            ...requestPayload,
          });
        }
      }).catch(() => {});
    }
  });
}
