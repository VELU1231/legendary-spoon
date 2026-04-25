const express = require('express');
const http = require('http');
const cors = require('cors');
const wsManager = require('./websocket');
const scheduler = require('./scheduler');
const jobsRouter = require('./routes/jobs');

const PORT = process.env.PORT || 3001;
const FETCH_INTERVAL_MS = parseInt(process.env.FETCH_INTERVAL_MS) || 60000; // 60 seconds

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api', jobsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), clients: wsManager.getClientCount() });
});

// WebSocket
wsManager.init(server);

// Connect scheduler to WebSocket broadcaster
scheduler.setBroadcast(wsManager.broadcast.bind(wsManager));

// Start job fetching
scheduler.start(FETCH_INTERVAL_MS);

// Start server
server.listen(PORT, () => {
  console.log(`[Server] Job Aggregator API running on http://localhost:${PORT}`);
  console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...');
  scheduler.stop();
  server.close(() => process.exit(0));
});

module.exports = { app, server };
