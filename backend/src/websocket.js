const WebSocket = require('ws');

let wss = null;
const clients = new Set();

function init(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to job feed' }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {}
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      clients.delete(ws);
    });
  });

  console.log('[WS] WebSocket server initialized');
  return wss;
}

function broadcast(data) {
  if (!wss || clients.size === 0) return;
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
  console.log(`[WS] Broadcast to ${clients.size} clients: ${data.type}`);
}

function getClientCount() {
  return clients.size;
}

module.exports = { init, broadcast, getClientCount };
