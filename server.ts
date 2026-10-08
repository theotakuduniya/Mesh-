import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve(__dirname, 'dist'));

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
  const MAX_QUEUE_SIZE = 100;

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

  wss.on('connection', (ws: any) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    let peerId: string | null = null;

    ws.on('message', (raw: any) => {
      try {
        const text = raw.toString();
        const packet = JSON.parse(text);

        if (packet.senderId && typeof packet.senderId === 'string') {
          peerId = packet.senderId;
          const currentId: string = packet.senderId;
          const existing = peers.get(currentId);
          peers.set(currentId, {
            id: currentId,
            name: packet.senderName || existing?.name || 'Mesh Peer',
            ws,
            lastSeen: Date.now(),
            metadata: packet.payload,
          });
        }

        // Target dispatch
        const targetId = packet.targetId;

        if (!targetId || targetId === 'all') {
          // Broadcast to all other connected clients
          for (const [id, peer] of peers.entries()) {
            if (id !== peerId && peer.ws && peer.ws.readyState === WebSocket.OPEN) {
              try {
                peer.ws.send(text);
              } catch (e) {
                console.warn(`[Mesh WS] Broadcast to ${id} failed:`, e);
              }
            }
          }
        } else {
          // Targeted unicast
          const target = peers.get(targetId);
          if (target?.ws && target.ws.readyState === WebSocket.OPEN) {
            try {
              target.ws.send(text);
            } catch (e) {
              console.warn(`[Mesh WS] Send to ${targetId} failed:`, e);
            }
          } else {
            // Queue for HTTP polling or when target reconnects
            if (!packetQueues.has(targetId)) {
              packetQueues.set(targetId, []);
            }
            const queue = packetQueues.get(targetId)!;
            queue.push(packet);
            if (queue.length > MAX_QUEUE_SIZE) queue.shift();
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
            if (p.ws && p.ws.readyState === WebSocket.OPEN) {
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
      peers.set(senderId, {
        id: senderId,
        name: packet.senderName || existing?.name || 'Mesh Peer',
        lastSeen: Date.now(),
        metadata: packet.payload,
      });
    }

    const text = JSON.stringify(packet);
    const targetId = packet.targetId;

    if (!targetId || targetId === 'all') {
      // Forward to all WebSocket clients
      for (const [id, peer] of peers.entries()) {
        if (id !== senderId && peer.ws && peer.ws.readyState === WebSocket.OPEN) {
          try {
            peer.ws.send(text);
          } catch (e) {}
        }
        // Also queue for HTTP pollers
        if (id !== senderId) {
          if (!packetQueues.has(id)) packetQueues.set(id, []);
          const q = packetQueues.get(id)!;
          q.push(packet);
          if (q.length > MAX_QUEUE_SIZE) q.shift();
        }
      }
    } else {
      const target = peers.get(targetId);
      if (target?.ws && target.ws.readyState === WebSocket.OPEN) {
        try {
          target.ws.send(text);
        } catch (e) {}
      } else {
        if (!packetQueues.has(targetId)) packetQueues.set(targetId, []);
        const q = packetQueues.get(targetId)!;
        q.push(packet);
        if (q.length > MAX_QUEUE_SIZE) q.shift();
      }
    }

    res.json({ success: true, timestamp: Date.now() });
  });

  // HTTP Long-Poll for packets (GET)
  app.get('/api/mesh/poll', (req, res) => {
    const peerId = req.query.peerId as string;
    if (!peerId) {
      return res.status(400).json({ error: 'Missing peerId parameter' });
    }

    const queue = packetQueues.get(peerId) || [];
    const packets = [...queue];
    packetQueues.set(peerId, []); // drain queue

    // Update peer presence
    const existing = peers.get(peerId);
    if (existing) {
      existing.lastSeen = Date.now();
    } else {
      peers.set(peerId, { id: peerId, name: 'Mesh Peer', lastSeen: Date.now() });
    }

    res.json({ packets });
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

  // Static files & SPA mounting
  const distDir = fs.existsSync(path.resolve(__dirname, 'dist'))
    ? path.resolve(__dirname, 'dist')
    : fs.existsSync(path.resolve(__dirname, 'index.html'))
    ? __dirname
    : null;

  if (distDir && (isProd || process.env.NODE_ENV === 'production')) {
    console.log(`[Server] Running in Production mode: serving ${distDir}`);
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    console.log('[Server] Running in Development mode: mounting Vite middleware');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
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
