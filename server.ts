import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
// Dist bundle is when running the compiled dist/server.js file directly
const isRunningFromDist = __dirname.endsWith('dist') || __filename.includes('/dist/') || __filename.endsWith('/dist/server.js');
const isProd = process.env.NODE_ENV === 'production' || isRunningFromDist;

const FALLBACK_SW_CODE = `
const SW_VERSION = 'v1.1.0';
const VIRTUAL_STREAM_PREFIX = '/virtual-stream/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('mesh-virtual-stream-channel')
  : null;

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
    headers.set('Content-Range', \`bytes \${actualStart}-\${actualEnd}/\${totalSize}\`);
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

    if (channel) {
      channel.postMessage({
        type: 'RANGE_REQUEST',
        ...requestPayload,
      });
    }

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
`;

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '100mb' }));

  // In-memory mesh network state for relay & presence
  interface ConnectedPeer {
    id: string;
    name: string;
    ws?: WebSocket;
    lastSeen: number;
    metadata?: any;
  }

  const peers = new Map<string, ConnectedPeer>();
  const packetQueues = new Map<string, any[]>(); // targetPeerId -> packets[]
  const longPollWaiters = new Map<string, (packets: any[]) => void>(); // targetPeerId -> waiter callback
  const MAX_QUEUE_SIZE = 500;
  const WS_MAX_BUFFERED = 4 * 1024 * 1024; // 4 MB socket backpressure limit

  // Helper to push into queue with priority signaling preservation
  const enqueuePacket = (targetId: string, packet: any) => {
    // If there is an active HTTP long-poll waiter for this peer, deliver immediately!
    const waiter = longPollWaiters.get(targetId);
    if (waiter) {
      longPollWaiters.delete(targetId);
      waiter([packet]);
      return;
    }

    if (!packetQueues.has(targetId)) {
      packetQueues.set(targetId, []);
    }
    const queue = packetQueues.get(targetId)!;
    queue.push(packet);

    if (queue.length > MAX_QUEUE_SIZE) {
      // Find oldest non-signaling / non-pairing packet to evict
      const evictIndex = queue.findIndex(
        (p) =>
          p.action !== 'SIGNAL_OFFER' &&
          p.action !== 'SIGNAL_ANSWER' &&
          p.action !== 'SIGNAL_ICE' &&
          !p.action?.startsWith('PAIR_')
      );
      if (evictIndex !== -1) {
        queue.splice(evictIndex, 1);
      } else {
        queue.shift();
      }
    }
  };

  // Real-time WebSocket signaling server with 100MB payload support & Render keepalive
  const wss = new WebSocketServer({
    server,
    path: '/api/mesh/ws',
    maxPayload: 100 * 1024 * 1024,
  });

  // Render reverse proxy 25-second keepalive interval (prevents 55-sec proxy idle disconnects)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((wsClient: any) => {
      if (wsClient.isAlive === false) {
        return wsClient.terminate();
      }
      wsClient.isAlive = false;
      try {
        wsClient.ping();
      } catch (e) {}
    });
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: any, req: http.IncomingMessage) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    let peerId: string | null = null;

    // Fast-path: extract peerId from URL search param immediately on connection
    try {
      const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const queryPeerId = parsedUrl.searchParams.get('peerId');
      if (queryPeerId) {
        peerId = queryPeerId;
        const existing = peers.get(queryPeerId);
        peers.set(queryPeerId, {
          id: queryPeerId,
          name: existing?.name || 'Mesh Peer',
          ws,
          lastSeen: Date.now(),
          metadata: existing?.metadata || { id: queryPeerId },
        });

        // Instantly flush any packets that arrived before WebSocket handshake completed
        const queued = packetQueues.get(queryPeerId) || [];
        if (queued.length > 0) {
          packetQueues.set(queryPeerId, []);
          for (const pkt of queued) {
            try {
              ws.send(JSON.stringify(pkt));
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    ws.on('message', (raw: any, isBinary: boolean) => {
      try {
        // High-performance binary frame passthrough:
        // First 36 bytes can represent target UUID (or 'all' padded).
        if (isBinary && Buffer.isBuffer(raw)) {
          if (raw.length >= 36) {
            const targetIdHeader = raw.subarray(0, 36).toString('utf8').replace(/\0/g, '').trim();
            if (targetIdHeader && targetIdHeader !== 'all') {
              const target = peers.get(targetIdHeader);
              if (target?.ws && target.ws.readyState === WebSocket.OPEN && target.ws.bufferedAmount < WS_MAX_BUFFERED) {
                target.ws.send(raw, { binary: true });
                return;
              }
            }
          }
        }

        const text = raw.toString();
        const packet = JSON.parse(text);

        if (packet.senderId && typeof packet.senderId === 'string') {
          peerId = packet.senderId;
          const currentId: string = packet.senderId;
          const existing = peers.get(currentId);

          // Crucial fix: Only update peer metadata when packet.action === 'DISCOVER'
          // Never overwrite metadata with large file chunks, SDP offers, or streams!
          const updatedMetadata =
            packet.action === 'DISCOVER' && packet.payload
              ? packet.payload
              : existing?.metadata || { id: currentId, name: packet.senderName };

          peers.set(currentId, {
            id: currentId,
            name: packet.senderName || existing?.name || 'Mesh Peer',
            ws,
            lastSeen: Date.now(),
            metadata: updatedMetadata,
          });
        }

        // Target dispatch
        const targetId = packet.targetId;

        if (!targetId || targetId === 'all') {
          // Broadcast to all other connected clients
          for (const [id, peer] of peers.entries()) {
            if (id !== peerId && peer.ws && peer.ws.readyState === WebSocket.OPEN) {
              if (peer.ws.bufferedAmount < WS_MAX_BUFFERED) {
                try {
                  peer.ws.send(text);
                } catch (e) {
                  console.warn(`[Mesh WS] Broadcast to ${id} failed:`, e);
                }
              }
            }
          }
        } else {
          // Targeted unicast
          const target = peers.get(targetId);
          if (target?.ws && target.ws.readyState === WebSocket.OPEN) {
            if (target.ws.bufferedAmount < WS_MAX_BUFFERED) {
              try {
                target.ws.send(text);
              } catch (e) {
                console.warn(`[Mesh WS] Send to ${targetId} failed:`, e);
              }
            } else {
              // Socket is backpressured, queue packet with priority retention
              enqueuePacket(targetId, packet);
            }
          } else {
            // Queue for HTTP polling or when target reconnects
            enqueuePacket(targetId, packet);
          }
        }
      } catch (err) {
        console.error('[Mesh WS] Error handling message:', err);
      }
    });

    ws.on('close', () => {
      if (peerId) {
        const peer = peers.get(peerId);
        if (peer?.ws === ws) {
          peers.delete(peerId);
          // Broadcast offline notice to others
          const offlineNotice = JSON.stringify({
            id: `pkt_off_${Date.now()}`,
            action: 'DISCOVER',
            senderId: peerId,
            senderName: peer?.name || 'Peer',
            targetId: 'all',
            timestamp: Date.now(),
            payload: { id: peerId, isOnline: false },
          });
          for (const [_, p] of peers.entries()) {
            if (p.ws && p.ws.readyState === WebSocket.OPEN && p.ws.bufferedAmount < WS_MAX_BUFFERED) {
              try {
                p.ws.send(offlineNotice);
              } catch (e) {}
            }
          }
        }
      }
    });

    ws.on('error', (err: any) => {
      console.warn('[Mesh WS] Client error:', err);
    });
  });

  // REST API Endpoints for HTTP fallback & status
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'mesh-relay',
      activePeers: peers.size,
      time: Date.now(),
    });
  });

  // HTTP Packet Relay (POST)
  app.post('/api/mesh/packet', (req, res) => {
    const packet = req.body;
    if (!packet || !packet.action) {
      return res.status(400).json({ error: 'Invalid packet structure' });
    }

    const senderId = packet.senderId;
    if (senderId) {
      const existing = peers.get(senderId);
      const updatedMetadata =
        packet.action === 'DISCOVER' && packet.payload
          ? packet.payload
          : existing?.metadata || { id: senderId, name: packet.senderName };

      peers.set(senderId, {
        id: senderId,
        name: packet.senderName || existing?.name || 'Mesh Peer',
        lastSeen: Date.now(),
        metadata: updatedMetadata,
      });
    }

    const text = JSON.stringify(packet);
    const targetId = packet.targetId;

    if (!targetId || targetId === 'all') {
      // Forward to all WebSocket clients
      for (const [id, peer] of peers.entries()) {
        if (id !== senderId && peer.ws && peer.ws.readyState === WebSocket.OPEN) {
          if (peer.ws.bufferedAmount < WS_MAX_BUFFERED) {
            try {
              peer.ws.send(text);
            } catch (e) {}
          }
        }
        // Also queue for HTTP pollers
        if (id !== senderId) {
          enqueuePacket(id, packet);
        }
      }
    } else {
      const target = peers.get(targetId);
      if (target?.ws && target.ws.readyState === WebSocket.OPEN) {
        if (target.ws.bufferedAmount < WS_MAX_BUFFERED) {
          try {
            target.ws.send(text);
          } catch (e) {}
        } else {
          enqueuePacket(targetId, packet);
        }
      } else {
        enqueuePacket(targetId, packet);
      }
    }

    res.json({ success: true, timestamp: Date.now() });
  });

  // HTTP Real Long-Poll for packets (GET with immediate wake-up)
  app.get('/api/mesh/poll', (req, res) => {
    const peerId = req.query.peerId as string;
    if (!peerId) {
      return res.status(400).json({ error: 'Missing peerId parameter' });
    }

    // Update peer presence
    const existing = peers.get(peerId);
    if (existing) {
      existing.lastSeen = Date.now();
    } else {
      peers.set(peerId, { id: peerId, name: 'Mesh Peer', lastSeen: Date.now() });
    }

    const queue = packetQueues.get(peerId) || [];
    if (queue.length > 0) {
      const packets = [...queue];
      packetQueues.set(peerId, []); // drain queue
      return res.json({ packets });
    }

    // Long-poll waiting: wait up to 8s for packets to arrive, returning immediately upon delivery
    let isFinished = false;
    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        longPollWaiters.delete(peerId);
        res.json({ packets: [] });
      }
    }, 8000);

    longPollWaiters.set(peerId, (incomingPackets) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        res.json({ packets: incomingPackets });
      }
    });

    req.on('close', () => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        longPollWaiters.delete(peerId);
      }
    });
  });

  // List active online mesh peers on this relay
  app.get('/api/mesh/peers', (_req, res) => {
    const activeList = Array.from(peers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      lastSeen: p.lastSeen,
      isOnline: Date.now() - p.lastSeen < 30000,
      metadata: p.metadata,
    }));
    res.json({ peers: activeList });
  });

  // Explicit service worker endpoint with Service-Worker-Allowed header & multi-location fallback
  app.get('/sw.js', (_req, res) => {
    const candidatePaths = [
      path.resolve(process.cwd(), 'sw.js'), // Project root sw.js
      path.resolve(__dirname, 'sw.js'), // Root or dist/sw.js
      path.resolve(__dirname, 'public/sw.js'), // When executing server.ts in local dev
      path.resolve(process.cwd(), 'dist/sw.js'), // Project root dist
      path.resolve(process.cwd(), 'public/sw.js'), // Project root public
      path.resolve(__dirname, '../public/sw.js'), // Parent public if in dist
    ];

    const swPath = candidatePaths.find((p) => fs.existsSync(p));

    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (swPath) {
      res.sendFile(swPath);
    } else {
      res.send(FALLBACK_SW_CODE);
    }
  });

  // Static files & SPA mounting
  let distDir: string | null = null;
  if (isRunningFromDist && fs.existsSync(path.resolve(__dirname, 'index.html')) && fs.existsSync(path.resolve(__dirname, 'assets'))) {
    // When executing dist/server.js directly in production
    distDir = __dirname;
  } else if (fs.existsSync(path.resolve(__dirname, 'dist', 'index.html')) && fs.existsSync(path.resolve(__dirname, 'dist', 'assets'))) {
    distDir = path.resolve(__dirname, 'dist');
  } else if (fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html')) && fs.existsSync(path.resolve(process.cwd(), 'dist', 'assets'))) {
    distDir = path.resolve(process.cwd(), 'dist');
  }

  if (isProd && distDir) {
    console.log(`[Server] Running in Production mode: serving ${distDir}`);
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir!, 'index.html'));
    });
  } else {
    console.log('[Server] Running in Development mode: mounting Vite middleware');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing in development to guarantee Vite index.html transformation
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || url.startsWith('/virtual-stream') || url === '/sw.js') {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Mesh Server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[Mesh Server] WebSocket endpoint active at ws://0.0.0.0:${PORT}/api/mesh/ws`);
  });
}

startServer().catch((err) => {
  console.error('[Mesh Server] Fatal initialization error:', err);
  process.exit(1);
});
