import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initDatabase } from './db.js';
import { authRoutes } from './routes/auth.js';
import { settingsRoutes } from './routes/settings.js';
import { setupWebSocketRelay } from './relay.js';
import { VERSION } from './version.js';

const PORT = parseInt(process.env.PORT || '3456', 10);

// Initialize database
initDatabase();

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',  // Electron app uses file:// or localhost
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/api/health', (c) => c.json({
  status: 'ok',
  version: VERSION,
  registrationDisabled: process.env.DISABLE_REGISTRATION === 'true',
}));

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/settings', settingsRoutes);

// Create a raw http.Server that skips Hono for WebSocket upgrade paths
const honoListener = getRequestListener(app.fetch);
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Skip Hono for WebSocket upgrade requests — let the 'upgrade' event handle them.
  // The browser/client sends an HTTP GET with `Connection: Upgrade` header;
  // if we let Hono handle it, it returns 404 and kills the upgrade.
  if (req.headers.upgrade?.toLowerCase() === 'websocket') {
    // Don't respond — the 'upgrade' event on the server will handle this
    return;
  }
  honoListener(req, res);
});

// Attach WebSocket relay (listens on 'upgrade' event for /ws/relay)
setupWebSocketRelay(httpServer);

// Start listening
httpServer.listen(PORT, () => {
  console.log(`[server] CC Studio server running on http://localhost:${PORT}`);
});
