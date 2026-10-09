/**
 * Service Worker: HTTP 206 Range Proxy for P2P Video & Media Streaming
 * Intercepts /virtual-stream/video.mp4 and /virtual-stream/:peerId/:resourceId/:filename
 * requests sent by HTML5 <video> / <audio> tags, translates HTTP Range headers
 * into WebRTC READ_CHUNK requests to the active peer, and responds with standard
 * HTTP 206 Partial Content responses to enable instant seeking and progressive chunked streaming.
 */

const SW_VERSION = 'v1.2.1';
const VIRTUAL_STREAM_KEYWORD = '/virtual-stream';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Broadcast communication channel with the main window WebRTC engine
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('mesh-virtual-stream-channel')
  : null;

// Map of pending chunk requests: requestId -> { resolve, reject, timer }
const pendingRequests = new Map();

function handleIncomingWorkerMessage(data) {
  if (!data || !data.requestId) return;

  const isResponse =
    data.type === 'READ_CHUNK_RESPONSE' ||
    data.type === 'RANGE_RESPONSE' ||
    data.type === 'READ_CHUNK_DATA' ||
    data.type === 'READ_CHUNK_SUCCESS';

  const isError =
    data.type === 'READ_CHUNK_ERROR' ||
    data.type === 'RANGE_ERROR';

  if (isResponse) {
    const pending = pendingRequests.get(data.requestId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(data.requestId);
      pending.resolve(data);
    }
  } else if (isError) {
    const pending = pendingRequests.get(data.requestId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(data.requestId);
      pending.reject(new Error(data.error || 'WebRTC READ_CHUNK failed'));
    }
  }
}

if (channel) {
  channel.onmessage = (event) => {
    handleIncomingWorkerMessage(event.data);
  };
}

self.addEventListener('message', (event) => {
  handleIncomingWorkerMessage(event.data);
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept /virtual-stream/video.mp4 and all /virtual-stream/... paths
  if (url.pathname.includes(VIRTUAL_STREAM_KEYWORD)) {
    event.respondWith(handleVirtualStreamRangeRequest(event));
  }
});

async function handleVirtualStreamRangeRequest(event) {
  const request = event.request;
  const url = new URL(request.url);

  // Parse path and query parameters
  // Supports:
  // 1. /virtual-stream/video.mp4?peerId=...&resourceId=...
  // 2. /virtual-stream/:peerId/:resourceId/:filename
  // 3. /virtual-stream/video.mp4
  // 4. /virtual-stream/:filename
  let peerId = url.searchParams.get('peerId') || '';
  let resourceId = url.searchParams.get('resourceId') || '';
  let filename = url.searchParams.get('filename') || 'video.mp4';

  const prefixIndex = url.pathname.indexOf(VIRTUAL_STREAM_KEYWORD);
  const subPath = url.pathname.slice(prefixIndex + VIRTUAL_STREAM_KEYWORD.length).replace(/^\/+/, '');
  const parts = subPath ? subPath.split('/') : [];

  if (parts.length >= 3 && !peerId && !resourceId) {
    peerId = decodeURIComponent(parts[0] || '');
    resourceId = decodeURIComponent(parts[1] || '');
    filename = decodeURIComponent(parts.slice(2).join('/') || 'video.mp4');
  } else if (parts.length === 2 && !peerId && !resourceId) {
    peerId = decodeURIComponent(parts[0] || '');
    resourceId = decodeURIComponent(parts[1] || '');
    filename = resourceId;
  } else if (parts.length === 1 && !resourceId) {
    filename = decodeURIComponent(parts[0] || 'video.mp4');
    resourceId = filename;
  }

  // Parse standard HTTP Range header: e.g. "bytes=0-65535" or "bytes=1048576-"
  const rangeHeader = request.headers.get('range');
  let start = 0;
  let end = null;
  let isRangeRequest = false;

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    isRangeRequest = true;
    const cleanRange = rangeHeader.replace('bytes=', '').trim();
    const rangeParts = cleanRange.split('-');
    if (rangeParts[0]) {
      start = parseInt(rangeParts[0], 10) || 0;
    }
    if (rangeParts[1]) {
      end = parseInt(rangeParts[1], 10);
    }
  }

  const requestId = 'chunk_' + Math.random().toString(36).slice(2) + '_' + Date.now();

  try {
    let responseData;
    try {
      responseData = await requestChunkFromPeerClient({
        requestId,
        peerId,
        resourceId,
        filename,
        start,
        end,
        rangeHeader,
      }, event.clientId);
    } catch (firstErr) {
      // Retry once after 350ms in case peer connection or blob discovery was briefly busy
      await new Promise((r) => setTimeout(r, 350));
      const retryId = 'retry_' + requestId;
      responseData = await requestChunkFromPeerClient({
        requestId: retryId,
        peerId,
        resourceId,
        filename,
        start,
        end,
        rangeHeader,
      }, event.clientId);
    }

    // Normalize buffer to ArrayBuffer
    let chunkBuffer = responseData.buffer;
    if (chunkBuffer instanceof Uint8Array) {
      chunkBuffer = chunkBuffer.buffer.slice(chunkBuffer.byteOffset, chunkBuffer.byteOffset + chunkBuffer.byteLength);
    } else if (chunkBuffer && chunkBuffer.buffer instanceof ArrayBuffer) {
      chunkBuffer = chunkBuffer.buffer;
    }

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
      status: isRangeRequest ? 206 : 200,
      statusText: isRangeRequest ? 'Partial Content' : 'OK',
      headers,
    });
  } catch (err) {
    console.warn('[SW Virtual Stream] WebRTC READ_CHUNK failed:', err);
    return new Response('P2P Virtual Stream Chunk Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
      },
    });
  }
}

function requestChunkFromPeerClient(payload, clientId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(payload.requestId);
      reject(new Error(`READ_CHUNK request timeout for ${payload.filename} (range: ${payload.start}-${payload.end})`));
    }, 16000);

    pendingRequests.set(payload.requestId, { resolve, reject, timer });

    const message = {
      type: 'READ_CHUNK',
      action: 'READ_CHUNK',
      rangeType: 'RANGE_REQUEST',
      ...payload,
    };

    // 1. Post to BroadcastChannel if supported
    if (channel) {
      channel.postMessage(message);
    }

    // 2. Broadcast to client windows to guarantee receipt in all contexts
    if (clientId && self.clients) {
      self.clients.get(clientId).then((client) => {
        if (client) client.postMessage(message);
      }).catch(() => {});
    }
    if (self.clients) {
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((c) => {
          if (c.id !== clientId) c.postMessage(message);
        });
      }).catch(() => {});
    }
  });
}
